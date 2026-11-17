import { createAppError, type AppError } from "@/lib/errors";
import { CopySuggestionsSchema, type CopyRequest, type CopySuggestion } from "@/server/ai/schemas";
import { err, ok, type Result } from "@/types/result";

const CONTACT_PATTERN = /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d\s().-]{6,}\d)|\b(?:call|text|sms|whatsapp|email|dm)\s*(?:on|at|:|-)?\s*(?:\+?\d|[\w.+-]+@))/i;
const PRICE_PATTERN = /(?:₦|\bnaira\b|\bkobo\b|\$|€|£|\b(?:price|cost|discount|percent\s*off)\b)/i;
const CLAIMS = [
  "warranty",
  "guarantee",
  "certified",
  "licensed",
  "approved",
  "best",
  "number one",
  "#1",
  "cheapest",
  "lifetime",
  "free",
  "five-star",
  "limited stock",
  "while stocks last",
  "hurry",
  "last chance",
] as const;

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function numericTokens(value: string): string[] {
  return value.match(/\d[\d,.'-]*/g)?.map((token) => token.replace(/\D/g, "")).filter(Boolean) ?? [];
}

/** Removes fields that must never be sent to an AI provider from user-supplied facts. */
export function redactSensitiveFacts(value: string): string {
  return value
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[contact detail removed]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[contact detail removed]")
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, "[contact detail removed]")
    .replace(/(?:₦|\$|€|£)\s*[\d,]+(?:\.\d+)?/g, "[price removed]")
    .replace(/\b(?:naira|kobo|price|cost)\s*(?:is|of|:)?\s*[\d,]+(?:\.\d+)?/gi, "[price removed]")
    .replace(/\b[\d,]+(?:\.\d+)?\s*(?:naira|ngn|kobo)\b/gi, "[price removed]")
    .replace(/\b(?:address|located at|visit us at)\s*:[^.;,]+/gi, "[address removed]")
    .trim();
}

function hasUnsupportedClaim(text: string, facts: string): boolean {
  const normalizedText = normalize(text);
  const normalizedFacts = normalize(facts);
  return CLAIMS.some((claim) => normalizedText.includes(claim) && !normalizedFacts.includes(claim));
}

function hasUnsupportedNumber(text: string, facts: string): boolean {
  const allowed = new Set(numericTokens(facts));
  return numericTokens(text).some((token) => !allowed.has(token));
}

function isNearDuplicate(left: string, right: string): boolean {
  const a = new Set(normalize(left).split(/\W+/).filter(Boolean));
  const b = new Set(normalize(right).split(/\W+/).filter(Boolean));
  if (a.size === 0 || b.size === 0) return true;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / Math.max(a.size, b.size) >= 0.85;
}

/** Validates model output, then applies the product's copy safety rules. */
export function filterCopySuggestions(
  input: CopyRequest,
  raw: unknown,
): Result<CopySuggestion[], AppError> {
  const parsed = CopySuggestionsSchema.safeParse(raw);
  if (!parsed.success) return err(createAppError("AI_INVALID_OUTPUT"));

  const suggestions = parsed.data.suggestions.map((suggestion) => ({
    headline: suggestion.headline.trim(),
    body: suggestion.body.trim(),
    cta: suggestion.cta.trim(),
  }));
  const fields: Array<keyof CopySuggestion> = ["headline", "body", "cta"];

  for (const suggestion of suggestions) {
    for (const field of fields) {
      const value = suggestion[field];
      const maximum = field === "headline" ? input.headlineMaxLength : field === "body" ? input.bodyMaxLength : 80;
      if (!value || value.length > maximum) return err(createAppError("AI_INVALID_OUTPUT"));
      if (CONTACT_PATTERN.test(value) || PRICE_PATTERN.test(value)) return err(createAppError("AI_INVALID_OUTPUT", "Suggestions included contact or pricing details. Write your own copy."));
      if (hasUnsupportedClaim(value, input.offerFacts) || hasUnsupportedNumber(value, input.offerFacts)) return err(createAppError("AI_INVALID_OUTPUT", "Suggestions included details that were not supplied. Write your own copy."));
      if (/\[.*\]|\{.*\}|\blorem\b/i.test(value)) return err(createAppError("AI_INVALID_OUTPUT"));
    }
  }

  for (let index = 0; index < suggestions.length; index += 1) {
    for (let other = index + 1; other < suggestions.length; other += 1) {
      if (isNearDuplicate(suggestions[index].headline, suggestions[other].headline)) return err(createAppError("AI_INVALID_OUTPUT"));
    }
  }

  return ok(suggestions);
}
