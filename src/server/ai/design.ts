import { randomUUID } from "node:crypto";
import { z } from "zod";

import { createAppError, type AppError } from "@/lib/errors";
import { requireUser, type SessionUser } from "@/server/auth";
import { CoreRepository, getDefaultCoreDataStoreState, type CoreDataStoreState } from "@/server/db/client";
import { enforceLimits, releaseLimits } from "@/server/ai/limits";
import { getDefaultLLMProvider, type LLMProvider } from "@/server/ai/providers";
import {
  APPROVED_LAYOUT_ARCHETYPES,
  DesignPromptRequestSchema,
  DesignRevisionPatchSchema,
  DesignRevisionRequestSchema,
  DesignSpecSchema,
  type DesignPromptRequest,
  type DesignRevisionPatch,
  type DesignRevisionRequest,
  type DesignSpec,
} from "@/server/ai/schemas";
import { buildDesignPrompt } from "@/server/ai/prompts/design.v1";
import { buildRevisionPrompt } from "@/server/ai/prompts/revision.v1";
import { DESIGN_PROMPT_VERSION } from "@/server/ai/prompts/design.v1";
import { REVISION_PROMPT_VERSION } from "@/server/ai/prompts/revision.v1";
import { loadTemplate } from "@/server/templates/load";
import { getDefaultRenderClient, type RenderClient, type RenderResponse } from "@/server/render/client";
import { FlyerContentSchema, type FlyerContent } from "@/schemas/flyer";
import type { RenderRequest } from "@/types/render";
import type { AiRequestKind, AiRequestStatus } from "@/types/database";
import { err, ok, type Result } from "@/types/result";

const DESIGN_TIMEOUT_MS = 8_000;

const ARCHETYPE_TEMPLATE_MAP: Record<(typeof APPROVED_LAYOUT_ARCHETYPES)[number], string> = {
  "hero-product": "solar-bold-001",
  "price-badge": "solar-clean-002",
  "split-photo": "solar-dark-003",
  "bold-type": "solar-premium-015",
  "list-offer": "solar-minimal-004",
};

const ARCHETYPE_SLOTS: Record<(typeof APPROVED_LAYOUT_ARCHETYPES)[number], readonly string[]> = {
  "hero-product": ["headline", "body", "price", "phone", "productImage", "logo"],
  "price-badge": ["headline", "price", "phone", "businessName", "logo"],
  "split-photo": ["headline", "body", "price", "phone", "productImage", "logo"],
  "bold-type": ["headline", "price", "phone", "businessName"],
  "list-offer": ["headline", "body", "phone", "businessName"],
};

const FIELD_DEFAULT_SLOTS: Record<string, string> = {
  headline: "headline",
  body: "body",
  price: "price",
  oldPrice: "price",
  phone: "phone",
  businessName: "businessName",
  productImage: "productImage",
  logo: "logo",
};

type DesignServiceOptions = {
  sessionUser?: SessionUser | null;
  state?: CoreDataStoreState;
  ip?: string;
  nowMs?: number;
  provider?: LLMProvider;
};

type ResolvedDesign = {
  spec: DesignSpec;
  templateId: string;
  templateVersion: number;
  themeId: string;
};

export type DesignFromPromptResult = ResolvedDesign & { promptVersion: string };
export type DesignRevisionResult = ResolvedDesign & { patch: DesignRevisionPatch; promptVersion: string };

function ensureNonBrowser(): void {
  if (typeof window !== "undefined") throw new Error("AI design helpers are server-only.");
}

function timeoutError(): Error {
  const error = new Error("AI call timed out");
  error.name = "AbortError";
  return error;
}

async function runProvider<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs = DESIGN_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => reject(timeoutError()), timeoutMs);
      void work(controller.signal).then(resolve, reject).finally(() => clearTimeout(timeout));
    });
  } finally {
    clearTimeout(timer);
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function statusFor(error: AppError): Exclude<AiRequestStatus, "succeeded" | "cache_hit"> {
  if (error.code === "AI_TIMEOUT") return "timed_out";
  if (error.code === "AI_REFUSED") return "refused";
  if (error.code === "AI_UNAVAILABLE") return "unavailable";
  return "failed";
}

function recordRequest(
  state: CoreDataStoreState,
  input: {
    userId: string;
    flyerId?: string;
    kind: AiRequestKind;
    provider: string;
    model: string | null;
    usage: Record<string, unknown>;
    costUsd: number | null;
    pricingCheckedAt: string | null;
    latencyMs: number;
    status: AiRequestStatus;
    errorCode?: string;
  },
): void {
  new CoreRepository({ role: "service_role" }, state).insertAiRequest({
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

async function resolveDesign(spec: unknown): Promise<Result<ResolvedDesign, AppError>> {
  const parsed = DesignSpecSchema.safeParse(spec);
  if (!parsed.success) return err(createAppError("AI_INVALID_OUTPUT", "The design specification was not approved."));

  const allowedSlots = ARCHETYPE_SLOTS[parsed.data.archetype];
  const seenFields = new Set<string>();
  for (const region of parsed.data.regions) {
    if (!allowedSlots.includes(region.slot) || seenFields.has(region.field)) {
      return err(createAppError("AI_INVALID_OUTPUT", "The design used an unsupported or repeated region."));
    }
    seenFields.add(region.field);
  }

  if (parsed.data.background.kind === "generated" && !parsed.data.background.assetId) {
    return err(createAppError("AI_INVALID_OUTPUT", "Generated backgrounds need an approved asset."));
  }

  const templateId = ARCHETYPE_TEMPLATE_MAP[parsed.data.archetype];
  const templateRes = await loadTemplate(templateId);
  if (!templateRes.ok) return err(createAppError("AI_INVALID_OUTPUT", "The selected design archetype is unavailable."));
  const template = templateRes.value.template;
  const palette = template.palettes.find((candidate) => candidate.id === parsed.data.paletteId);
  if (!palette || !template.meta.license.fonts.includes(parsed.data.fonts.heading) || !template.meta.license.fonts.includes(parsed.data.fonts.body)) {
    return err(createAppError("AI_INVALID_OUTPUT", "The design selected an unapproved palette or font."));
  }

  return ok({ spec: parsed.data, templateId, templateVersion: template.meta.version, themeId: palette.id });
}

function parsePatch(raw: unknown): Result<DesignRevisionPatch, AppError> {
  const parsed = DesignRevisionPatchSchema.safeParse(raw);
  return parsed.success ? ok(parsed.data) : err(createAppError("AI_INVALID_OUTPUT", "The revision was not an approved change."));
}

export function applyDesignRevision(spec: DesignSpec, patch: DesignRevisionPatch): Result<DesignSpec, AppError> {
  const parsedSpec = DesignSpecSchema.safeParse(spec);
  const parsedPatch = DesignRevisionPatchSchema.safeParse(patch);
  if (!parsedSpec.success || !parsedPatch.success) return err(createAppError("AI_INVALID_OUTPUT", "The revision could not be applied."));

  let next: DesignSpec = parsedSpec.data;
  for (const change of parsedPatch.data.changes) {
    if (change.kind === "palette") {
      next = { ...next, paletteId: change.paletteId };
      continue;
    }
    if (change.kind === "archetype") {
      const allowed = ARCHETYPE_SLOTS[change.archetype];
      next = {
        ...next,
        archetype: change.archetype,
        regions: next.regions.filter((region) => allowed.includes(region.slot)),
      };
      continue;
    }
    const existing = next.regions.find((region) => region.field === change.field);
    if (existing) {
      next = { ...next, regions: next.regions.map((region) => region.field === change.field ? { ...region, emphasis: change.emphasis } : region) };
      continue;
    }
    const slot = FIELD_DEFAULT_SLOTS[change.field];
    if (!slot || !ARCHETYPE_SLOTS[next.archetype].includes(slot)) return err(createAppError("AI_INVALID_OUTPUT", "That field is not available in this layout."));
    next = { ...next, regions: [...next.regions, { field: change.field, slot, emphasis: change.emphasis }] };
  }
  return ok(next);
}

export async function designFromPrompt(rawInput: unknown, options: DesignServiceOptions = {}): Promise<Result<DesignFromPromptResult, AppError>> {
  ensureNonBrowser();
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const parsed = DesignPromptRequestSchema.safeParse(rawInput);
  if (!parsed.success) return err(createAppError("AI_INPUT_INVALID", parsed.error.issues[0]?.message ?? "Check the design request."));

  const state = options.state ?? getDefaultCoreDataStoreState();
  const provider = options.provider ?? getDefaultLLMProvider();
  const limitInput = { userId: authRes.value.user.id, ip: options.ip, kind: "design_specs" as const, flyerId: parsed.data.flyerId, nowMs: options.nowMs };
  const limitRes = enforceLimits(limitInput);
  if (!limitRes.ok) {
    recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "design_specs", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs: 0, status: "failed", errorCode: limitRes.error.code });
    return limitRes;
  }
  if (!provider.generateDesign) {
    recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "design_specs", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs: 0, status: "unavailable", errorCode: "AI_UNAVAILABLE" });
    releaseLimits(limitInput);
    return err(createAppError("AI_UNAVAILABLE"));
  }

  const prompt = buildDesignPrompt(parsed.data);
  let lastError: AppError = createAppError("AI_INVALID_OUTPUT");
  let succeeded = false;
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const started = Date.now();
      try {
        const generated = await runProvider((signal) => provider.generateDesign!({ prompt, signal }));
        const latencyMs = Date.now() - started;
        if (!generated.ok) {
          recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "design_specs", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs, status: statusFor(generated.error), errorCode: generated.error.code });
          return generated;
        }
        const resolved = await resolveDesign(generated.value.spec);
        if (resolved.ok) {
          recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "design_specs", provider: generated.value.provider, model: generated.value.model, usage: generated.value.usage, costUsd: generated.value.costUsd, pricingCheckedAt: generated.value.pricingCheckedAt, latencyMs, status: "succeeded" });
          succeeded = true;
          return ok({ ...resolved.value, promptVersion: DESIGN_PROMPT_VERSION });
        }
        lastError = resolved.error;
        recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "design_specs", provider: generated.value.provider, model: generated.value.model, usage: generated.value.usage, costUsd: generated.value.costUsd, pricingCheckedAt: generated.value.pricingCheckedAt, latencyMs, status: "failed", errorCode: resolved.error.code });
      } catch (error) {
        lastError = createAppError(isTimeout(error) ? "AI_TIMEOUT" : "AI_PROVIDER_ERROR");
        recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "design_specs", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs: Date.now() - started, status: statusFor(lastError), errorCode: lastError.code });
        break;
      }
    }
  } finally {
    if (!succeeded) releaseLimits(limitInput);
  }
  return err(lastError);
}

export async function reviseDesign(rawInput: unknown, options: DesignServiceOptions = {}): Promise<Result<DesignRevisionResult, AppError>> {
  ensureNonBrowser();
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const parsed = DesignRevisionRequestSchema.safeParse(rawInput);
  if (!parsed.success) return err(createAppError("AI_INPUT_INVALID", parsed.error.issues[0]?.message ?? "Check the revision."));

  const state = options.state ?? getDefaultCoreDataStoreState();
  const provider = options.provider ?? getDefaultLLMProvider();
  const limitInput = { userId: authRes.value.user.id, ip: options.ip, kind: "design_revisions" as const, flyerId: parsed.data.flyerId, nowMs: options.nowMs };
  const limitRes = enforceLimits(limitInput);
  if (!limitRes.ok) {
    recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "design_revisions", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs: 0, status: "failed", errorCode: limitRes.error.code });
    return limitRes;
  }
  if (!provider.generateRevision) {
    recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "design_revisions", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs: 0, status: "unavailable", errorCode: "AI_UNAVAILABLE" });
    releaseLimits(limitInput);
    return err(createAppError("AI_UNAVAILABLE"));
  }

  const prompt = buildRevisionPrompt(parsed.data);
  let lastError: AppError = createAppError("AI_INVALID_OUTPUT");
  let succeeded = false;
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const started = Date.now();
      try {
        const generated = await runProvider((signal) => provider.generateRevision!({ prompt, signal }));
        const latencyMs = Date.now() - started;
        if (!generated.ok) {
          recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "design_revisions", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs, status: statusFor(generated.error), errorCode: generated.error.code });
          return generated;
        }
        const patch = parsePatch(generated.value.patch);
        const applied = patch.ok ? applyDesignRevision(parsed.data.currentSpec, patch.value) : patch;
        const resolved = applied.ok ? await resolveDesign(applied.value) : applied;
        if (resolved.ok && patch.ok) {
          recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "design_revisions", provider: generated.value.provider, model: generated.value.model, usage: generated.value.usage, costUsd: generated.value.costUsd, pricingCheckedAt: generated.value.pricingCheckedAt, latencyMs, status: "succeeded" });
          succeeded = true;
          return ok({ ...resolved.value, patch: patch.value, promptVersion: REVISION_PROMPT_VERSION });
        }
        lastError = resolved.ok ? createAppError("AI_INVALID_OUTPUT") : resolved.error;
        recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "design_revisions", provider: generated.value.provider, model: generated.value.model, usage: generated.value.usage, costUsd: generated.value.costUsd, pricingCheckedAt: generated.value.pricingCheckedAt, latencyMs, status: "failed", errorCode: lastError.code });
      } catch (error) {
        lastError = createAppError(isTimeout(error) ? "AI_TIMEOUT" : "AI_PROVIDER_ERROR");
        recordRequest(state, { userId: authRes.value.user.id, flyerId: parsed.data.flyerId, kind: "design_revisions", provider: provider.name, model: provider.model, usage: {}, costUsd: null, pricingCheckedAt: null, latencyMs: Date.now() - started, status: statusFor(lastError), errorCode: lastError.code });
        break;
      }
    }
  } finally {
    if (!succeeded) releaseLimits(limitInput);
  }
  return err(lastError);
}

const RenderDesignOptionsSchema = z.object({
  assets: z.object({ logoUrl: z.string().min(1).optional(), productImageUrls: z.array(z.string().min(1)).max(8) }).default({ productImageUrls: [] }),
  scale: z.union([z.literal(1), z.literal(2)]).default(1),
  purpose: z.enum(["preview", "export"]).default("preview"),
  fileType: z.enum(["png", "jpg"]).default("png"),
  correlationId: z.string().min(1).max(200).optional(),
});

export type RenderDesignOptions = z.infer<typeof RenderDesignOptionsSchema> & { renderClient?: RenderClient; jobId?: string };

export async function renderDesignSpec(spec: unknown, content: unknown, options: RenderDesignOptions = { assets: { productImageUrls: [] }, scale: 1, purpose: "preview", fileType: "png" }): Promise<Result<RenderResponse, AppError>> {
  ensureNonBrowser();
  const resolved = DesignSpecSchema.safeParse(spec);
  if (!resolved.success) return err(createAppError("AI_INPUT_INVALID", "The design specification is invalid."));
  const validDesign = await resolveDesign(resolved.data);
  if (!validDesign.ok) return validDesign;
  const validContent = FlyerContentSchema.safeParse(content);
  if (!validContent.success) return err(createAppError("AI_INPUT_INVALID", "The flyer content is invalid."));
  const validOptions = RenderDesignOptionsSchema.safeParse(options);
  if (!validOptions.success) return err(createAppError("AI_INPUT_INVALID", "The render options are invalid."));
  const templateRes = await loadTemplate(validDesign.value.templateId, undefined, validDesign.value.templateVersion);
  if (!templateRes.ok || !Object.keys(templateRes.value.template.formats).includes(validContent.data.format)) return err(createAppError("AI_INPUT_INVALID", "The selected format is unavailable for this design."));

  const request: RenderRequest = {
    jobId: options.jobId ?? randomUUID(),
    correlationId: validOptions.data.correlationId,
    templateId: validDesign.value.templateId,
    templateVersion: validDesign.value.templateVersion,
    format: validContent.data.format,
    scale: validOptions.data.scale,
    content: { ...validContent.data, themeId: validDesign.value.themeId },
    assets: validOptions.data.assets,
    themeId: validDesign.value.themeId,
    purpose: validOptions.data.purpose,
    fileType: validOptions.data.fileType,
  };
  return (options.renderClient ?? getDefaultRenderClient()).render(request);
}

export type { DesignPromptRequest, DesignRevisionPatch, DesignRevisionRequest, DesignSpec, FlyerContent };
