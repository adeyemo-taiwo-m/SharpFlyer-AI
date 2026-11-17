import { describe, expect, it } from "vitest";

import { filterCopySuggestions, redactSensitiveFacts } from "@/server/ai/filters";

describe("AI safety filters", () => {
  it("redacts contact details and prices before provider input is built", () => {
    const redacted = redactSensitiveFacts("Call +234 803 123 4567. Price is \u20a65,000. hello@example.com");

    expect(redacted).not.toContain("803");
    expect(redacted).not.toContain("5,000");
    expect(redacted).not.toContain("hello@example.com");
    expect(redacted).toContain("[contact detail removed]");
    expect(redacted).toContain("[price removed]");
  });

  it("allows a supplied claim but rejects an invented claim", () => {
    const input = {
      businessType: "food delivery",
      offerFacts: "Free delivery is available in Lagos.",
      tone: "clear" as const,
      headlineMaxLength: 60,
      bodyMaxLength: 100,
    };
    const safe = filterCopySuggestions(input, {
      suggestions: [
        { headline: "Free delivery today", body: "Meals are available in Lagos.", cta: "Order today" },
        { headline: "Meals for your evening", body: "Choose a meal from the menu.", cta: "View the menu" },
        { headline: "Dinner made easy", body: "Order a warm meal for your evening.", cta: "Place an order" },
      ],
    });
    expect(safe.ok).toBe(true);

    const unsafe = filterCopySuggestions(input, {
      suggestions: [
        { headline: "Guaranteed delivery", body: "Meals are available in Lagos.", cta: "Order today" },
        { headline: "Meals for your evening", body: "Choose a meal from the menu.", cta: "View the menu" },
        { headline: "Dinner made easy", body: "Order a warm meal for your evening.", cta: "Place an order" },
      ],
    });
    expect(unsafe.ok).toBe(false);
  });

  it("rejects overlong output instead of silently truncating it", () => {
    const result = filterCopySuggestions(
      { businessType: "retail", offerFacts: "Shoes are available.", tone: "clear", headlineMaxLength: 10, bodyMaxLength: 20 },
      {
        suggestions: [
          { headline: "This headline is too long", body: "Shoes are available.", cta: "Shop" },
          { headline: "Another one", body: "Choose a pair.", cta: "View" },
          { headline: "A third one", body: "Find your fit.", cta: "Browse" },
        ],
      },
    );
    expect(result.ok).toBe(false);
  });
});
