import { describe, expect, it } from "vitest";

import { TemplateSchema, type Template } from "../../src/schemas/template";
import { FlyerContentSchema } from "../../src/schemas/flyer";
import { formatCurrency, formatNaira } from "../../src/lib/money";
import { formatPhoneDisplay } from "../../src/lib/phone";
import { validateLayout } from "../../render-worker/src/validate/output";
import type { LayoutDocument, LayoutField } from "../../render-worker/src/types/layout";

const template: Template = TemplateSchema.parse({
  meta: { id: "test", version: 1, title: "Test", category: "test", tags: ["test"], style: "test", license: { author: "Test", type: "original", fonts: ["Inter"] } },
  formats: { ig_post: { width: 1080, height: 1080, safeArea: 10 } },
  palettes: [{ id: "light", roles: { bg: "#FFFFFF", text: "#000000" } }],
  fields: [
    { key: "headline", type: "text", required: true },
    { key: "price", type: "price", required: false },
    { key: "oldPrice", type: "price", required: false },
    { key: "phone", type: "phone", required: true },
    { key: "businessName", type: "text", required: true },
    { key: "address", type: "text", required: false },
    { key: "logo", type: "logo", required: false },
  ],
  regions: { ig_post: { headline: { x: 20, y: 20, w: 200, h: 40 }, price: { x: 20, y: 70, w: 200, h: 40 }, oldPrice: { x: 20, y: 120, w: 200, h: 40 }, phone: { x: 20, y: 170, w: 200, h: 40 }, businessName: { x: 20, y: 220, w: 200, h: 40 }, address: { x: 20, y: 270, w: 200, h: 40 }, logo: { x: 20, y: 320, w: 200, h: 40 } } },
  decor: [],
  constraints: { minContrast: 4.5, maxHeadlineLines: 3 },
});

const content = FlyerContentSchema.parse({ headline: "Solar sale", price: 85000000, oldPrice: 95000000, currency: "NGN", phone: "+2348031234567", businessName: "Sun Co", address: "Lagos", logoAssetId: "logo", productImageAssetIds: [], themeId: "light", format: "ig_post" });

function field(field: string, text: string, overrides: Partial<LayoutField> = {}): LayoutField {
  return { field, value: text, sourceText: text, lines: [text], renderLines: [text], fontSize: 24, lineHeight: 1.1, width: 100, height: 26, region: { x: 20, y: 20, w: 200, h: 40 }, required: false, critical: false, color: "#000000", backgroundColor: "#FFFFFF", weight: 400, overflowed: false, ...overrides };
}

function validLayout(): LayoutDocument {
  return { format: "ig_post", width: 1080, height: 1080, safeArea: 10, palette: { bg: "#FFFFFF", text: "#000000" }, fields: {
    headline: field("headline", "Solar sale", { required: true }),
    price: field("price", formatCurrency(content.price!, content.currency), { critical: true, region: { x: 20, y: 70, w: 200, h: 40 } }),
    oldPrice: field("oldPrice", formatCurrency(content.oldPrice!, content.currency), { critical: true, region: { x: 20, y: 120, w: 200, h: 40 } }),
    phone: field("phone", formatPhoneDisplay(content.phone), { required: true, critical: true, region: { x: 20, y: 170, w: 200, h: 40 } }),
    businessName: field("businessName", "Sun Co", { required: true, critical: true, region: { x: 20, y: 220, w: 200, h: 40 } }),
    address: field("address", "Lagos", { critical: true, region: { x: 20, y: 270, w: 200, h: 40 } }),
  }, images: [], warnings: [], errors: [] };
}

describe("render output validation", () => {
  it("accepts valid output and exact critical text", () => {
    const result = validateLayout(validLayout(), template, content);
    expect(result.errors).toHaveLength(0);
  });

  it("catches corrupted critical text", () => {
    const layout = validLayout();
    layout.fields.price.lines = [formatNaira(99900000)];
    expect(validateLayout(layout, template, content).errors.some((entry) => entry.code === "CRITICAL_TEXT_MISMATCH")).toBe(true);
  });

  it("catches corruption in the exact lines sent to the renderer", () => {
    const layout = validLayout();
    layout.fields.phone.renderLines = ["0803 123 4568"];
    expect(validateLayout(layout, template, content).errors.some((entry) => entry.code === "CRITICAL_TEXT_MISMATCH")).toBe(true);
  });

  it("catches overflow and safe-area violations", () => {
    const layout = validLayout();
    layout.fields.headline.width = 400;
    layout.fields.headline.region = { x: 0, y: 0, w: 200, h: 40 };
    expect(validateLayout(layout, template, content).errors.map((entry) => entry.code)).toEqual(expect.arrayContaining(["TEXT_OVERFLOW", "SAFE_AREA_OVERFLOW"]));
  });

  it("warns when contrast is below the text threshold", () => {
    const layout = validLayout();
    layout.fields.headline.color = "#777777";
    layout.fields.headline.fontSize = 18;
    expect(validateLayout(layout, template, content).warnings.some((entry) => entry.code === "LOW_CONTRAST")).toBe(true);
  });

  it("catches stretched images and warns on low resolution", () => {
    const layout = validLayout();
    layout.images.push({ field: "productImage", region: { x: 20, y: 360, w: 400, h: 400, fit: "contain" }, sourceWidth: 80, sourceHeight: 80, stretched: true });
    const result = validateLayout(layout, template, content);
    expect(result.errors.some((entry) => entry.code === "IMAGE_STRETCHED")).toBe(true);
    expect(result.warnings.some((entry) => entry.code === "LOW_IMAGE_RESOLUTION")).toBe(true);
  });
});
