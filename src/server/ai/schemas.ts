import { z } from "zod";

const SafeText = (max: number) => z.string().trim().min(1).max(max);

export const CopyRequestSchema = z.strictObject({
  flyerId: z.string().trim().min(1).max(120).optional(),
  businessType: SafeText(80),
  offerFacts: SafeText(500),
  tone: z.enum(["clear", "friendly", "pidgin"]).default("clear"),
  headlineMaxLength: z.number().int().positive().max(120).default(60),
  bodyMaxLength: z.number().int().positive().max(500).default(100),
});

export const CopySuggestionSchema = z.strictObject({
  headline: SafeText(120),
  body: SafeText(500),
  cta: SafeText(80),
});

export const CopySuggestionsSchema = z.strictObject({
  suggestions: z.array(CopySuggestionSchema).length(3),
});

export const BackgroundRemovalInputSchema = z.strictObject({
  flyerId: z.string().trim().min(1).max(120).optional(),
  imageHash: z.string().regex(/^[a-f0-9]{64}$/i),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

export type CopyRequest = z.infer<typeof CopyRequestSchema>;
export type CopySuggestion = z.infer<typeof CopySuggestionSchema>;
export type CopySuggestions = z.infer<typeof CopySuggestionsSchema>;
export type BackgroundRemovalInput = z.infer<typeof BackgroundRemovalInputSchema>;

export type AIErrorCode =
  | "AI_TIMEOUT"
  | "AI_INVALID_OUTPUT"
  | "AI_LIMIT_REACHED"
  | "AI_REFUSED"
  | "AI_PROVIDER_ERROR"
  | "AI_INPUT_INVALID"
  | "AI_UNAVAILABLE";
