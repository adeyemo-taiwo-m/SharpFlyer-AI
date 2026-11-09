import { describe, expect, it } from "vitest";
import { CRITICAL_FIELD_KEYS } from "@/schemas/critical";
import { FlyerContentSchema } from "@/schemas/flyer";
import { FORMAT_SIZES, FORMAT_VALUES } from "@/schemas/format";
import { TemplateSchema } from "@/schemas/template";

const validTemplate = {
  meta: {
    id: "solar-bold-001",
    version: 1,
    title: "Solar Power Package: Bold",
    category: "solar",
    tags: ["inverter", "battery", "package"],
    style: "bold",
    license: { author: "Designer Name", type: "work-for-hire", fonts: ["Inter", "Poppins"] },
  },
  formats: {
    ig_post: { width: 1080, height: 1080, safeArea: 48 },
    status: { width: 1080, height: 1920, safeArea: 64 },
  },
  palettes: [{ id: "navy", roles: { bg: "#0B1F3A", primary: "#FFB800", text: "#FFFFFF", muted: "#9FB3C8" } }],
  fields: [
    { key: "headline", type: "text", required: true, maxLength: 60 },
    { key: "price", type: "price", required: false },
    { key: "phone", type: "phone", required: true },
    { key: "productImage", type: "image", required: false },
    { key: "logo", type: "logo", required: false },
  ],
  regions: {
    ig_post: {
      headline: { x: 60, y: 90, w: 700, h: 220, font: "Poppins", weight: 800, minSize: 44, maxSize: 88, lineHeight: 1.05, overflow: "shrink", color: "text" },
      price: { x: 60, y: 760, w: 520, h: 140, font: "Inter", weight: 800, minSize: 48, maxSize: 96, color: "primary", format: "naira" },
      phone: { x: 60, y: 960, w: 600, h: 60, font: "Inter", weight: 600, minSize: 28, maxSize: 36, color: "text" },
      productImage: { x: 580, y: 260, w: 460, h: 560, fit: "contain", shadow: true },
      logo: { x: 60, y: 40, w: 180, h: 60, fit: "contain" },
    },
  },
  decor: [{ type: "shape", kind: "rect", x: 0, y: 0, w: 1080, h: 1080, fill: "bg" }],
  constraints: { minContrast: 4.5, maxHeadlineLines: 3 },
};

const validContent = {
  headline: "5kVA inverter and battery package",
  body: "Reliable power for your home",
  price: 85_000_000,
  oldPrice: 95_000_000,
  currency: "NGN",
  phone: "+2348031234567",
  businessName: "BrightPower Solutions",
  address: "Lagos",
  logoAssetId: "asset-logo",
  productImageAssetIds: ["asset-product"],
  themeId: "navy",
  format: "status",
};

describe("format and template schemas", () => {
  it("accepts the canonical template shape", () => {
    expect(TemplateSchema.safeParse(validTemplate).success).toBe(true);
  });

  it("rejects a template without its license metadata", () => {
    const invalid = structuredClone(validTemplate);
    delete (invalid.meta as { license?: unknown }).license;

    expect(TemplateSchema.safeParse(invalid).success).toBe(false);
  });

  it("exposes the required format sizes", () => {
    expect(FORMAT_VALUES).toEqual(["status", "ig_post", "story", "fb_post", "a4"]);
    expect(FORMAT_SIZES.status).toEqual({ width: 1080, height: 1920 });
    expect(FORMAT_SIZES.story).toEqual({ width: 1080, height: 1920 });
    expect(FORMAT_SIZES.ig_post).toEqual({ width: 1080, height: 1080 });
  });
});

describe("flyer content schema", () => {
  it("accepts valid structured content", () => {
    expect(FlyerContentSchema.safeParse(validContent).success).toBe(true);
  });

  it("rejects an old price that is not greater than the price", () => {
    expect(FlyerContentSchema.safeParse({ ...validContent, oldPrice: validContent.price }).success).toBe(false);
    expect(FlyerContentSchema.safeParse({ ...validContent, oldPrice: validContent.price - 1 }).success).toBe(false);
  });

  it("keeps critical fields in one shared list", () => {
    expect(CRITICAL_FIELD_KEYS).toEqual(["businessName", "price", "oldPrice", "phone", "address", "logo"]);
  });
});
