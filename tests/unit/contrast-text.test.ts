import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";
import { normalizeWhitespace } from "@/lib/text";

describe("contrast and text helpers", () => {
  it("matches the design system contrast reference", () => {
    expect(contrastRatio("#1D1D1F", "#FFFFFF")).toBeCloseTo(16.83, 2);
    expect(contrastRatio("#6E6E73", "#FFFFFF")).toBeCloseTo(5.07, 2);
  });

  it("is order-independent", () => {
    expect(contrastRatio("#FFFFFF", "#1D1D1F")).toBe(contrastRatio("#1D1D1F", "#FFFFFF"));
  });

  it("collapses whitespace while preserving non-whitespace characters", () => {
    expect(normalizeWhitespace("  Solar\n\tPower  —  5kVA  ")).toBe("Solar Power — 5kVA");
  });
});
