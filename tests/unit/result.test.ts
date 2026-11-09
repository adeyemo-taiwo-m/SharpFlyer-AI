import { describe, expect, expectTypeOf, it } from "vitest";
import { err, ok, type Result } from "@/types/result";

describe("Result helpers", () => {
  it("creates a successful result", () => {
    const result = ok(42);

    expect(result).toEqual({ ok: true, value: 42 });
    expect(result.ok).toBe(true);
    expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
  });

  it("creates a failed result and narrows correctly", () => {
    const result: Result<number, string> = err("failed");

    expect(result).toEqual({ ok: false, error: "failed" });
    expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
    if (!result.ok) expect(result.error).toBe("failed");
  });
});
