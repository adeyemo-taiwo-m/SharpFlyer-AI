import { describe, expect, it } from "vitest";
import { formatCurrency, formatMoney, formatNaira, parsePriceInput, toKobo, toMinorUnits } from "@/lib/money";

describe("money helpers", () => {
  it("keeps Naira values as integer kobo", () => {
    expect(toKobo("0")).toBe(0);
    expect(toKobo("5,000")).toBe(500_000);
    expect(toKobo("12,500,000")).toBe(1_250_000_000);
    expect(formatNaira(toKobo("850,000"))).toBe("₦850,000");
  });

  it("supports dollars without floating-point arithmetic", () => {
    expect(toMinorUnits("8,500", "USD")).toBe(850_000);
    expect(formatMoney(850_000, "USD")).toBe("$8,500.00");
    expect(formatCurrency(850_000, "USD")).toBe("$8,500.00");
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });

  it("parses spaces and commas but rejects decimals, negatives, and text", () => {
    expect(parsePriceInput("  1,250,000  ")).toEqual({ ok: true, value: 125_000_000 });
    expect(parsePriceInput("12.50").ok).toBe(false);
    expect(parsePriceInput("-500").ok).toBe(false);
    expect(parsePriceInput("one thousand").ok).toBe(false);
    expect(parsePriceInput("").ok).toBe(false);
  });

  it("normalizes leading zeroes and rejects unsafe values", () => {
    expect(toKobo("000850000")).toBe(85_000_000);
    expect(parsePriceInput("9007199254740992").ok).toBe(false);
  });
});
