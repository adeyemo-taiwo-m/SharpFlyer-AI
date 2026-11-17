import { beforeEach, describe, expect, it } from "vitest";

import {
  applyDesignRevision,
  designFromPrompt,
  renderDesignSpec,
  reviseDesign,
} from "@/server/ai";
import { resetAiLimits } from "@/server/ai/limits";
import type { DesignGeneration, LLMProvider, RevisionGeneration } from "@/server/ai/providers";
import { createCoreDataStoreState } from "@/server/db/client";
import type { SessionUser } from "@/server/auth";
import { DesignSpecSchema, type DesignSpec } from "@/server/ai/schemas";
import { ok } from "@/types/result";
import type { RenderRequest } from "@/types/render";
import type { RenderResponse } from "@/server/render/client";

const USER: SessionUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "design@solar.ng",
  emailVerified: true,
};

const SPEC: DesignSpec = {
  archetype: "hero-product",
  paletteId: "navy-gold",
  fonts: { heading: "Inter", body: "Inter" },
  regions: [
    { field: "headline", slot: "headline", emphasis: "high" },
    { field: "price", slot: "price", emphasis: "medium" },
    { field: "phone", slot: "phone", emphasis: "medium" },
    { field: "productImage", slot: "productImage", emphasis: "medium" },
  ],
  background: { kind: "solid" },
};

function generation(spec: unknown): DesignGeneration {
  return { spec, provider: "fake-design", model: "fake-model", usage: { inputTokens: 80, outputTokens: 40 }, costUsd: 0.01, pricingCheckedAt: "2026-11-17" };
}

function revisionGeneration(patch: unknown): RevisionGeneration {
  return { patch, provider: "fake-design", model: "fake-model", usage: { inputTokens: 30, outputTokens: 10 }, costUsd: 0.002, pricingCheckedAt: "2026-11-17" };
}

class FakeDesignProvider implements LLMProvider {
  readonly name = "fake-design";
  readonly model = "fake-model";
  designCalls = 0;
  revisionCalls = 0;
  designOutputs: unknown[] = [{ html: "<script>alert(1)</script>" }, SPEC];

  async generateCopy() {
    return ok({ suggestions: { suggestions: [] }, provider: this.name, model: this.model, usage: {}, costUsd: 0, pricingCheckedAt: "2026-11-17" });
  }

  async generateDesign(): Promise<ReturnType<typeof ok<DesignGeneration>>> {
    this.designCalls += 1;
    return ok(generation(this.designOutputs[Math.min(this.designCalls - 1, this.designOutputs.length - 1)]));
  }

  async generateRevision(): Promise<ReturnType<typeof ok<RevisionGeneration>>> {
    this.revisionCalls += 1;
    return ok(revisionGeneration({ changes: [{ kind: "region_emphasis", field: "price", emphasis: "high" }] }));
  }
}

describe("Phase 12 constrained AI design", () => {
  beforeEach(() => resetAiLimits());

  it("retries invalid design output, resolves an approved template, and logs both attempts", async () => {
    const state = createCoreDataStoreState();
    const provider = new FakeDesignProvider();
    const result = await designFromPrompt({
      prompt: "A trustworthy solar package layout",
      businessType: "solar and inverter",
      offerFacts: "Inverter and battery package for homes.",
    }, { sessionUser: USER, state, provider, ip: "10.10.0.1" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.templateId).toBe("solar-bold-001");
      expect(result.value.templateVersion).toBe(2);
      expect(result.value.promptVersion).toBe("design.v1");
    }
    expect(provider.designCalls).toBe(2);
    expect(Array.from(state.aiRequests.values()).map((row) => row.status)).toEqual(["failed", "succeeded"]);
    expect(Array.from(state.aiRequests.values()).map((row) => row.kind)).toEqual(["design_specs", "design_specs"]);
  });

  it("applies a natural-language revision as a safe structured patch", async () => {
    const state = createCoreDataStoreState();
    const provider = new FakeDesignProvider();
    const result = await reviseDesign({ instruction: "Make the price bigger", currentSpec: SPEC }, { sessionUser: USER, state, provider, ip: "10.10.0.2" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.spec.regions.find((region) => region.field === "price")?.emphasis).toBe("high");
    expect(provider.revisionCalls).toBe(1);
    expect(Array.from(state.aiRequests.values())).toMatchObject([{ kind: "design_revisions", status: "succeeded" }]);
  });

  it("never applies arbitrary markup or an unsupported field", () => {
    expect(DesignSpecSchema.safeParse({ ...SPEC, html: "<script>alert(1)</script>" }).success).toBe(false);
    expect(applyDesignRevision(SPEC, { changes: [{ kind: "region_emphasis", field: "price", emphasis: "high" }] }).ok).toBe(true);
    expect(applyDesignRevision(SPEC, { changes: [{ kind: "region_emphasis", field: "logo", emphasis: "high" }] }).ok).toBe(true);
  });

  it("passes the approved selection through the existing render client", async () => {
    let captured: RenderRequest | undefined;
    const renderClient = {
      render: async (request: RenderRequest): Promise<ReturnType<typeof ok<RenderResponse>>> => {
        captured = request;
        return ok({ jobId: request.jobId, outputBuffer: Buffer.from("png"), warnings: [], errors: [], metrics: { durationMs: 1, minFontSizeUsed: 12 } });
      },
    };
    const result = await renderDesignSpec(SPEC, {
      headline: "Solar sale",
      price: 500000,
      currency: "NGN",
      phone: "+2348031234567",
      businessName: "Sun Co",
      productImageAssetIds: [],
      imagePosition: { x: 0, y: 0 },
      themeId: "wrong-theme",
      format: "story",
    }, { renderClient, assets: { productImageUrls: [] }, scale: 1, purpose: "preview", fileType: "png" });

    expect(result.ok).toBe(true);
    expect(captured?.templateId).toBe("solar-bold-001");
    expect(captured?.templateVersion).toBe(2);
    expect(captured?.themeId).toBe("navy-gold");
    expect(captured?.format).toBe("story");
  });
});
