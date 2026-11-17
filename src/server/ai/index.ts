import { createHash } from "node:crypto";

import { createAppError, type AppError } from "@/lib/errors";
import { requireUser, type SessionUser } from "@/server/auth";
import { CoreRepository, getDefaultCoreDataStoreState, type CoreDataStoreState } from "@/server/db/client";
import { err, ok, type Result } from "@/types/result";
import type { AiRequestKind, AiRequestStatus } from "@/types/database";
import {
  getDefaultBackgroundRemovalProvider,
  getDefaultLLMProvider,
  type BackgroundRemovalProvider,
  type LLMProvider,
} from "@/server/ai/providers";
import { CopyRequestSchema, BackgroundRemovalInputSchema, type CopyRequest } from "@/server/ai/schemas";
import { enforceLimits, releaseLimits } from "@/server/ai/limits";
import { buildCopyPrompt } from "@/server/ai/prompts/copy.v1";
import { filterCopySuggestions, redactSensitiveFacts } from "@/server/ai/filters";

export type AiServiceOptions = {
  sessionUser?: SessionUser | null;
  state?: CoreDataStoreState;
  ip?: string;
  nowMs?: number;
  provider?: LLMProvider;
  backgroundRemovalProvider?: BackgroundRemovalProvider;
};

export type CopySuggestionsResult = {
  suggestions: Array<{ headline: string; body: string; cta: string }>;
  promptVersion: string;
};

export type BackgroundRemovalResult = {
  bytes: Buffer;
  originalHash: string;
  outputHash: string;
  cacheHit: boolean;
  warning: string | null;
};

const COPY_TIMEOUT_MS = 8_000;
const BACKGROUND_REMOVAL_TIMEOUT_MS = 20_000;
const backgroundCache = new Map<string, BackgroundRemovalResult>();

function timeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

function filterSuggestions(input: CopyRequest, raw: unknown): Result<CopySuggestionsResult["suggestions"], AppError> {
  return filterCopySuggestions(input, raw);
}

function timeoutError(): Error {
  const error = new Error("AI call timed out");
  error.name = "AbortError";
  return error;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function runWithTimeout<T>(work: () => Promise<T>, signal: AbortSignal, timeoutMs: number): Promise<T> {
  if (signal.aborted) throw timeoutError();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(timeoutError()), timeoutMs);
    const onAbort = () => {
      clearTimeout(timer);
      reject(timeoutError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void work().then(resolve, reject).finally(() => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    });
  });
}

function statusFor(error: AppError): Exclude<AiRequestStatus, "succeeded" | "cache_hit"> {
  if (error.code === "AI_TIMEOUT") return "timed_out";
  if (error.code === "AI_REFUSED") return "refused";
  if (error.code === "AI_UNAVAILABLE") return "unavailable";
  return "failed";
}

function recordRequest(
  state: CoreDataStoreState,
  input: { userId: string; flyerId?: string; kind: AiRequestKind; provider: string; model: string | null; usage: Record<string, unknown>; costUsd: number | null; pricingCheckedAt: string | null; latencyMs: number; status: AiRequestStatus; errorCode?: string },
): void {
  const repo = new CoreRepository({ role: "service_role" }, state);
  repo.insertAiRequest({
    user_id: input.userId,
    flyer_id: input.flyerId ?? null,
    kind: input.kind,
    provider: input.provider,
    model: input.model,
    usage: input.usage,
    cost_usd: input.costUsd,
    pricing_checked_at: input.pricingCheckedAt,
    latency_ms: input.latencyMs,
    status: input.status,
    error_code: input.errorCode ?? null,
  });
}

export async function suggestCopy(rawInput: unknown, options: AiServiceOptions = {}): Promise<Result<CopySuggestionsResult, AppError>> {
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const parsed = CopyRequestSchema.safeParse(rawInput);
  if (!parsed.success) return err(createAppError("AI_INPUT_INVALID", parsed.error.issues[0]?.message ?? "Check the copy request."));

  const state = options.state ?? getDefaultCoreDataStoreState();
  const provider = options.provider ?? getDefaultLLMProvider();
  const limitInput = { userId: authRes.value.user.id, ip: options.ip, kind: "copy_suggestions" as const, flyerId: parsed.data.flyerId, nowMs: options.nowMs };
  const limitRes = enforceLimits(limitInput);
  if (!limitRes.ok) {
    recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "copy_suggestions", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs: 0, status: "failed", errorCode: limitRes.error.code });
    return limitRes;
  }
  const prompt = buildCopyPrompt(parsed.data);
  const providerInput = {
    ...parsed.data,
    businessType: redactSensitiveFacts(parsed.data.businessType),
    offerFacts: redactSensitiveFacts(parsed.data.offerFacts),
    prompt,
  };
  let lastError: AppError = createAppError("AI_INVALID_OUTPUT");
  let succeeded = false;
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now();
    const timeout = timeoutSignal(COPY_TIMEOUT_MS);
    try {
      const providerRes = await runWithTimeout(() => provider.generateCopy(providerInput, timeout.signal), timeout.signal, COPY_TIMEOUT_MS);
      const latencyMs = Date.now() - started;
      if (!providerRes.ok) {
        lastError = providerRes.error;
        recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "copy_suggestions", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs, status: statusFor(providerRes.error), errorCode: providerRes.error.code });
        return providerRes;
      }
      const filtered = filterSuggestions(parsed.data, providerRes.value.suggestions);
      if (filtered.ok) {
        recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "copy_suggestions", provider: providerRes.value.provider, model: providerRes.value.model, usage: providerRes.value.usage, costUsd: providerRes.value.costUsd, pricingCheckedAt: providerRes.value.pricingCheckedAt, latencyMs, status: "succeeded" });
        succeeded = true;
        return ok({ suggestions: filtered.value, promptVersion: "copy.v1" });
      }
      lastError = filtered.error;
      recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "copy_suggestions", provider: providerRes.value.provider, model: providerRes.value.model, usage: providerRes.value.usage, costUsd: providerRes.value.costUsd, pricingCheckedAt: providerRes.value.pricingCheckedAt, latencyMs, status: "failed", errorCode: filtered.error.code });
    } catch (error) {
      lastError = isTimeout(error) ? createAppError("AI_TIMEOUT") : createAppError("AI_PROVIDER_ERROR");
      recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "copy_suggestions", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs: Date.now() - started, status: statusFor(lastError), errorCode: lastError.code });
      if (isTimeout(error)) break;
    } finally {
      timeout.cancel();
    }
    }
  } finally {
    if (!succeeded) releaseLimits(limitInput);
  }
  return err(lastError);
}

export async function removeBackground(
  rawInput: unknown,
  bytes: Buffer,
  options: AiServiceOptions = {},
): Promise<Result<BackgroundRemovalResult, AppError>> {
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const parsed = BackgroundRemovalInputSchema.safeParse(rawInput);
  if (!parsed.success) return err(createAppError("AI_INPUT_INVALID", parsed.error.issues[0]?.message ?? "The image request is invalid."));
  const originalHash = createHash("sha256").update(bytes).digest("hex");
  if (originalHash.toLowerCase() !== parsed.data.imageHash.toLowerCase()) return err(createAppError("AI_INPUT_INVALID", "The image changed before processing. Upload it again."));

  const state = options.state ?? getDefaultCoreDataStoreState();
  const provider = options.backgroundRemovalProvider ?? getDefaultBackgroundRemovalProvider();
  const limitInput = { userId: authRes.value.user.id, ip: options.ip, kind: "background_removal" as const, flyerId: parsed.data.flyerId, nowMs: options.nowMs };
  const limitRes = enforceLimits(limitInput);
  if (!limitRes.ok) {
    recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "background_removal", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs: 0, status: "failed", errorCode: limitRes.error.code });
    return limitRes;
  }
  const cacheKey = `${authRes.value.user.id}:${originalHash}`;
  const cached = backgroundCache.get(cacheKey);
  if (cached) {
    releaseLimits(limitInput);
    recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "background_removal", provider: provider.name, model: provider.model, usage: {}, costUsd: 0, pricingCheckedAt: null, latencyMs: 0, status: "cache_hit" });
    return ok({ ...cached, bytes: Buffer.from(cached.bytes), cacheHit: true });
  }

  const started = Date.now();
  const timeout = timeoutSignal(BACKGROUND_REMOVAL_TIMEOUT_MS);
  let succeeded = false;
  try {
    const providerRes = await runWithTimeout(() => provider.removeBackground({ bytes, mimeType: parsed.data.mimeType, signal: timeout.signal }), timeout.signal, BACKGROUND_REMOVAL_TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (!providerRes.ok) {
      recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "background_removal", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs, status: statusFor(providerRes.error), errorCode: providerRes.error.code });
      return providerRes;
    }
    if (providerRes.value.artifactScore !== undefined && providerRes.value.artifactScore > 0.35) {
      recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "background_removal", provider: providerRes.value.provider, model: providerRes.value.model, usage: providerRes.value.usage, costUsd: providerRes.value.costUsd, pricingCheckedAt: providerRes.value.pricingCheckedAt, latencyMs, status: "failed", errorCode: "ARTIFACTS_DETECTED" });
      return err(createAppError("AI_INVALID_OUTPUT", "The result had visible artifacts. Keep the original image."));
    }
    const result: BackgroundRemovalResult = { bytes: Buffer.from(providerRes.value.bytes), originalHash, outputHash: createHash("sha256").update(providerRes.value.bytes).digest("hex"), cacheHit: false, warning: null };
    backgroundCache.set(cacheKey, result);
    recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "background_removal", provider: providerRes.value.provider, model: providerRes.value.model, usage: providerRes.value.usage, costUsd: providerRes.value.costUsd, pricingCheckedAt: providerRes.value.pricingCheckedAt, latencyMs, status: "succeeded" });
    succeeded = true;
    return ok({ ...result, bytes: Buffer.from(result.bytes) });
  } catch (error) {
    const appError = createAppError(isTimeout(error) ? "AI_TIMEOUT" : "AI_PROVIDER_ERROR", isTimeout(error) ? undefined : "Background removal failed. Keep the original image.");
    recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "background_removal", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs: Date.now() - started, status: statusFor(appError), errorCode: appError.code });
    return err(appError);
  } finally {
    timeout.cancel();
    if (!succeeded) releaseLimits(limitInput);
  }
}

export function resetBackgroundRemovalCache(): void {
  backgroundCache.clear();
}

export { summarizeAiCosts } from "@/server/ai/cost";
export { applyDesignRevision, designFromPrompt, renderDesignSpec, reviseDesign } from "@/server/ai/design";
export type { DesignFromPromptResult, DesignRevisionResult, RenderDesignOptions } from "@/server/ai/design";
export type { BackgroundRemovalProvider, ImageProvider, LLMProvider } from "@/server/ai/providers";
