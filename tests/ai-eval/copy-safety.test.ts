import { describe, expect, it } from "vitest";

import { filterCopySuggestions } from "@/server/ai/filters";
import { AI_EVAL_CASES } from "./cases";

function modelOutput(current: (typeof AI_EVAL_CASES)[number]["suggestion"]) {
  return {
    suggestions: [
      current,
      { ...current, headline: `${current.headline} option` },
      { ...current, headline: `${current.headline} choice` },
    ],
  };
}

describe("AI copy evaluation set", () => {
  it("contains at least 50 normal, adversarial, ambiguous, and Pidgin cases", () => {
    expect(AI_EVAL_CASES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(AI_EVAL_CASES.map((item) => item.category))).toEqual(new Set(["normal", "adversarial", "ambiguous", "pidgin"]));
  });

  it("accepts safe suggestions and rejects unsafe claims or contact details", () => {
    const results = AI_EVAL_CASES.map((item) => {
      const result = filterCopySuggestions(
        {
          businessType: "small business",
          offerFacts: item.facts,
          tone: item.tone,
          headlineMaxLength: 60,
          bodyMaxLength: 100,
        },
        modelOutput(item.suggestion),
      );
      return result.ok === item.shouldPass;
    });
    expect(AI_EVAL_CASES.filter((_, index) => !results[index]).map((item) => item.id)).toEqual([]);
  });
});
