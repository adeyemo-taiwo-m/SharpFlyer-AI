import { describe, expect, it } from "vitest";
import { APP_ERROR_MESSAGES, APP_ERROR_CODES, createAppError } from "@/lib/errors";

describe("application errors", () => {
  it("has a friendly message for every stable code", () => {
    for (const code of APP_ERROR_CODES) {
      expect(APP_ERROR_MESSAGES[code]).toMatch(/^[A-Z].+\.$/);
      expect(APP_ERROR_MESSAGES[code]).not.toMatch(/sorry|oops|!/i);
    }
  });

  it("allows a stable code with its default message", () => {
    expect(createAppError("NOT_FOUND")).toEqual({
      code: "NOT_FOUND",
      message: APP_ERROR_MESSAGES.NOT_FOUND,
    });
  });
});
