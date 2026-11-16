import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fitText } from "../../render-worker/src/engine/fit";

const fontPath = join(process.cwd(), "templates", "solar-bold-001", "assets", "Inter-400.woff2");
const region = {
  x: 0,
  y: 0,
  w: 420,
  h: 160,
  font: "Inter",
  minSize: 20,
  maxSize: 56,
  lineHeight: 1.1,
  overflow: "shrink" as const,
};

describe("deterministic text fitting", () => {
  it("fits short and normal text without changing critical characters", () => {
    const short = fitText({ field: "headline", text: "Solar sale", region, fontPath, required: true, critical: false, maxLines: 3 });
    const normal = fitText({ field: "headline", text: "5kVA inverter and battery package", region, fontPath, required: true, critical: false, maxLines: 3 });

    expect(short.errors).toHaveLength(0);
    expect(short.lines.join("")).toBe("Solar sale");
    expect(normal.errors).toHaveLength(0);
    expect(normal.lines.join("")).toBe("5kVA inverter and battery package");
  });

  it("produces the same layout for the same input", () => {
    const input = { field: "price", text: "₦12,500,000", region, fontPath, required: true, critical: true, maxLines: 1 };
    expect(fitText(input)).toEqual(fitText(input));
  });

  it("does not truncate an extreme critical headline", () => {
    const result = fitText({ field: "headline", text: "Premium high-capacity solar inverter battery package with smart monitoring and installation support", region: { ...region, h: 48, minSize: 40 }, fontPath, required: true, critical: true, maxLines: 1 });

    expect(result.truncated).toBe(false);
    expect(result.errors.some((entry) => entry.code === "TEXT_DOES_NOT_FIT")).toBe(true);
    expect(result.lines.join("")).toBe(result.sourceText);
  });

  it("can truncate an optional field with an ellipsis", () => {
    const result = fitText({ field: "body", text: "A very long optional description that should be shortened when it cannot fit in the available region", region: { ...region, w: 160, h: 24, minSize: 20, maxSize: 20, overflow: "truncate" }, fontPath, required: false, critical: false, maxLines: 1 });

    expect(result.truncated).toBe(true);
    expect(result.warnings.some((entry) => entry.code === "TEXT_TRUNCATED")).toBe(true);
    expect(result.renderLines.join("")).toContain("…");
  });
});
