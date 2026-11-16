import { createHash } from "node:crypto";

import sharp from "sharp";
import { expect, it } from "vitest";

import { fixtureContent, FIXTURE_ASSETS } from "../../render-worker/src/fixtures";
import { renderFlyer } from "../../render-worker/src/engine/render";

const templates = [
  { id: "solar-bold-001", themeId: "navy-gold" },
  { id: "solar-clean-002", themeId: "paper-blue" },
  { id: "solar-dark-003", themeId: "charcoal-orange" },
] as const;
const formats = ["ig_post", "status"] as const;
const fixtures = ["short", "normal", "long", "extreme"] as const;

function assetsForFixture(fixture: (typeof fixtures)[number]) {
  switch (fixture) {
    case "short":
      return { productImageUrls: [] };
    case "normal":
      return { logoUrl: FIXTURE_ASSETS.transparentLogoUrl, productImageUrls: [FIXTURE_ASSETS.smallProductImageUrl] };
    case "long":
      return { logoUrl: FIXTURE_ASSETS.logoUrl, productImageUrls: [FIXTURE_ASSETS.wideProductImageUrl] };
    case "extreme":
      return { logoUrl: FIXTURE_ASSETS.transparentLogoUrl, productImageUrls: FIXTURE_ASSETS.productImageUrls };
  }
}

for (const template of templates) {
  for (const format of formats) {
    for (const fixture of fixtures) {
      it(`renders ${template.id} / ${format} / ${fixture}`, async () => {
        const content = { ...fixtureContent(fixture, format), themeId: template.themeId };
        const result = await renderFlyer({
          jobId: `visual-${template.id}-${format}-${fixture}`,
          templateId: template.id,
          templateVersion: 1,
          format,
          scale: 1,
          content,
          assets: assetsForFixture(fixture),
          themeId: content.themeId,
          purpose: "preview",
        });

        expect(result.ok, JSON.stringify(result.errors)).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.outputBuffer).toBeDefined();

        const buffer = result.outputBuffer!;
        const metadata = await sharp(buffer).metadata();
        const snapshot = {
          sha256: createHash("sha256").update(buffer).digest("hex"),
          width: metadata.width,
          height: metadata.height,
          warningCodes: result.warnings.map((warning) => warning.code),
          minFontSizeUsed: result.metrics.minFontSizeUsed,
        };

        expect(snapshot).toMatchSnapshot();
      });
    }
  }
}
