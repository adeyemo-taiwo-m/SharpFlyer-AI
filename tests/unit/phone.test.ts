import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, normalizePhone } from "@/lib/phone";

describe("phone helpers", () => {
  it.each(["0803 123 4567", "+234 803 123 4567", "2348031234567", "0803-123-4567"])("normalizes %s to E.164", (input) => {
    const result = normalizePhone(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.e164).toBe("+2348031234567");
      expect(result.value.warnings).toEqual([]);
    }
  });

  it("formats a Nigerian E.164 number for display", () => {
    expect(formatPhoneDisplay("+2348031234567")).toBe("0803 123 4567");
  });

  it("warns on plausible international numbers without rejecting them", () => {
    const result = normalizePhone("+1 202-555-0123");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.e164).toBe("+12025550123");
      expect(result.value.warnings).toContain("INTERNATIONAL_NUMBER");
    }
  });

  it.each(["123", "0803abc4567", "+234 803 123 456789", ""])("rejects %s", (input) => {
    expect(normalizePhone(input).ok).toBe(false);
  });
});
