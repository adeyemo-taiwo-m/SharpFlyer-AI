import { describe, expect, it } from "vitest";

import { fixtureContent, FIXTURE_ASSETS } from "../../render-worker/src/fixtures";
import { renderFlyer } from "../../render-worker/src/engine/render";

describe("render worker output contract", () => {
  it("never returns bytes when validation has errors", async () => {
    const content = {
      ...fixtureContent("normal", "ig_post"),
      headline: "X".repeat(120),
    };
    const result = await renderFlyer({
      jobId: "validation-error",
      templateId: "solar-bold-001",
      templateVersion: 1,
      format: "ig_post",
      scale: 1,
      content,
      assets: FIXTURE_ASSETS,
      themeId: "navy-gold",
      purpose: "export",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.outputBuffer).toBeUndefined();
  });
});
