import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { getBalance } from "@/server/credits";
import {
  removeBackground,
  resetBackgroundRemovalCache,
  suggestCopy,
  summarizeAiCosts,
} from "@/server/ai";
import { resetAiLimits } from "@/server/ai/limits";
import type {
  BackgroundRemovalGeneration,
  BackgroundRemovalProvider,
  CopyGeneration,
  LLMProvider,
} from "@/server/ai/providers";
import { createCoreDataStoreState } from "@/server/db/client";
import type { SessionUser } from "@/server/auth";
import { ensureUserBootstrapped } from "@/server/auth";
import { ok } from "@/types/result";

const USER: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "ai@solar.ng",
  emailVerified: true,
};

const REQUEST = {
  flyerId: "flyer-copy-1",
  businessType: "Food delivery",
  offerFacts: "Jollof rice delivery is available in Lagos.",
  tone: "clear" as const,
  headlineMaxLength: 40,
  bodyMaxLength: 80,
};

function validGeneration(): CopyGeneration {
  return {
    suggestions: {
      suggestions: [
        { headline: "Dinner made easy", body: "Order a warm meal for your evening.", cta: "Order today" },
        { headline: "Lagos meals, delivered", body: "Choose a meal and get it delivered.", cta: "See the menu" },
        { headline: "Make tonight delicious", body: "Freshly prepared meals are ready to order.", cta: "Place an order" },
      ],
    },
    provider: "fake-llm",
    model: "fake-model",
    usage: { inputTokens: 20, outputTokens: 30 },
    costUsd: 0.004,
    pricingCheckedAt: "2026-11-17",
  };
}

class FakeLlm implements LLMProvider {
  readonly name = "fake-llm";
  readonly model = "fake-model";
  calls = 0;
  outputs: unknown[] = [validGeneration().suggestions];

  async generateCopy(): Promise<ReturnType<typeof ok<CopyGeneration>>> {
    this.calls += 1;
    return ok({ ...validGeneration(), suggestions: this.outputs[Math.min(this.calls - 1, this.outputs.length - 1)] });
  }
}

class FakeBackgroundRemoval implements BackgroundRemovalProvider {
  readonly name = "fake-background";
  readonly model = "fake-remover";
  calls = 0;

  async removeBackground(): Promise<ReturnType<typeof ok<BackgroundRemovalGeneration>>> {
    this.calls += 1;
    return ok({
      bytes: Buffer.from("processed-image"),
      provider: this.name,
      model: this.model,
      usage: { images: 1 },
      costUsd: 0.01,
      pricingCheckedAt: "2026-11-17",
      artifactScore: 0.1,
    });
  }
}

describe("Phase 8 AI service", () => {
  let state = createCoreDataStoreState();

  beforeEach(() => {
    state = createCoreDataStoreState();
    resetAiLimits();
    resetBackgroundRemovalCache();
  });

  it("returns three provider suggestions, logs the request, and never consumes credits", async () => {
    const provider = new FakeLlm();
    await ensureUserBootstrapped(USER, state);
    const before = await getBalance(USER.id, { state });
    const result = await suggestCopy(REQUEST, { sessionUser: USER, state, provider, ip: "10.0.0.1" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.suggestions).toHaveLength(3);
    expect(provider.calls).toBe(1);
    expect(await getBalance(USER.id, { state })).toEqual(before);
    expect(Array.from(state.aiRequests.values())).toMatchObject([
      { user_id: USER.id, flyer_id: REQUEST.flyerId, kind: "copy_suggestions", status: "succeeded", cost_usd: 0.004 },
    ]);
  });

  it("retries invalid provider output once and then succeeds", async () => {
    const provider = new FakeLlm();
    provider.outputs = [{ suggestions: [{ headline: "Only one", body: "Not enough", cta: "Try" }] }, validGeneration().suggestions];

    const result = await suggestCopy(REQUEST, { sessionUser: USER, state, provider, ip: "10.0.0.2" });

    expect(result.ok).toBe(true);
    expect(provider.calls).toBe(2);
    expect(Array.from(state.aiRequests.values()).map((row) => row.status)).toEqual(["failed", "succeeded"]);
  });

  it("rejects critical details from the provider and leaves the editor fallback available", async () => {
    const provider = new FakeLlm();
    provider.outputs = [
      {
        suggestions: [
          { headline: "Call +2348012345678", body: "Order a meal", cta: "Call now" },
          { headline: "Meal one", body: "Order a meal", cta: "Order" },
          { headline: "Meal two", body: "Order a meal", cta: "Order" },
        ],
      },
    ];

    const result = await suggestCopy(REQUEST, { sessionUser: USER, state, provider, ip: "10.0.0.3" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AI_INVALID_OUTPUT");
    expect(provider.calls).toBe(2);
    expect(Array.from(state.aiRequests.values()).every((row) => row.status === "failed")).toBe(true);
  });

  it("enforces the per-flyer regeneration limit", async () => {
    const provider = new FakeLlm();
    for (let index = 0; index < 3; index += 1) {
      expect((await suggestCopy(REQUEST, { sessionUser: USER, state, provider, ip: "10.0.0.4" })).ok).toBe(true);
    }

    const fourth = await suggestCopy(REQUEST, { sessionUser: USER, state, provider, ip: "10.0.0.4" });
    expect(fourth).toEqual({ ok: false, error: { code: "AI_LIMIT_REACHED", message: "Try a different flyer or write your own copy for now." } });
    expect(provider.calls).toBe(3);
  });

  it("caches background removal by user and image hash while preserving the original", async () => {
    const original = Buffer.from("original-image");
    const imageHash = createHash("sha256").update(original).digest("hex");
    const provider = new FakeBackgroundRemoval();
    const input = { flyerId: "flyer-image-1", imageHash, mimeType: "image/png" as const };

    const first = await removeBackground(input, original, { sessionUser: USER, state, backgroundRemovalProvider: provider, ip: "10.0.0.5" });
    const second = await removeBackground(input, original, { sessionUser: USER, state, backgroundRemovalProvider: provider, ip: "10.0.0.5" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.cacheHit).toBe(false);
      expect(second.value.cacheHit).toBe(true);
      expect(first.value.originalHash).toBe(imageHash);
      expect(second.value.bytes).toEqual(Buffer.from("processed-image"));
    }
    expect(provider.calls).toBe(1);
    expect(original).toEqual(Buffer.from("original-image"));
    expect(summarizeAiCosts(state, { exportedFlyers: 1 }).costPerExportedFlyerUsd).toBe(0.01);
  });
});
