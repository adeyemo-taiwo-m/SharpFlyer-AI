import { z } from "zod";

export const APPROVED_HEADING_FONTS = ["Inter"] as const;
export const APPROVED_BODY_FONTS = ["Inter", "Noto Sans"] as const;
export const APPROVED_LAYOUT_ARCHETYPES = ["hero-product", "price-badge", "split-photo", "bold-type", "list-offer"] as const;
export const APPROVED_DESIGN_FIELDS = ["headline", "body", "price", "oldPrice", "phone", "businessName", "productImage", "logo"] as const;
export const APPROVED_PALETTE_IDS = [
  "navy-gold", "ink-cyan", "paper-blue", "paper-green", "charcoal-orange", "charcoal-lime",
  "white-blue", "coral-cream", "leaf", "royal", "sand", "lime", "sunset", "ocean", "cream", "indigo", "fresh", "premium",
] as const;

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

export const DesignPromptRequestSchema = z.strictObject({
  flyerId: z.string().trim().min(1).max(120).optional(),
  prompt: SafeText(1200),
  businessType: SafeText(80),
  offerFacts: SafeText(500),
  tone: z.enum(["clear", "friendly", "pidgin"]).default("clear"),
  headlineMaxLength: z.number().int().positive().max(120).default(60),
  bodyMaxLength: z.number().int().positive().max(500).default(100),
});

const DesignRegionSchema = z.strictObject({
  field: z.enum(APPROVED_DESIGN_FIELDS),
  slot: z.string().trim().min(1).max(60),
  emphasis: z.enum(["low", "medium", "high"]),
});

export const DesignSpecSchema = z.strictObject({
  archetype: z.enum(APPROVED_LAYOUT_ARCHETYPES),
  paletteId: z.enum(APPROVED_PALETTE_IDS),
  fonts: z.strictObject({
    heading: z.enum(APPROVED_HEADING_FONTS),
    body: z.enum(APPROVED_BODY_FONTS),
  }),
  regions: z.array(DesignRegionSchema).max(12),
  background: z.strictObject({
    kind: z.enum(["solid", "generated"]),
    assetId: z.string().uuid().optional(),
  }),
});

export const DesignRevisionRequestSchema = z.strictObject({
  flyerId: z.string().trim().min(1).max(120).optional(),
  instruction: SafeText(300),
  currentSpec: DesignSpecSchema,
});

export const DesignRevisionPatchSchema = z.strictObject({
  changes: z.array(z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("region_emphasis"), field: z.enum(APPROVED_DESIGN_FIELDS), emphasis: z.enum(["low", "medium", "high"]) }),
    z.strictObject({ kind: z.literal("palette"), paletteId: z.enum(APPROVED_PALETTE_IDS) }),
    z.strictObject({ kind: z.literal("archetype"), archetype: z.enum(APPROVED_LAYOUT_ARCHETYPES) }),
  ])).min(1).max(4),
});

export type CopyRequest = z.infer<typeof CopyRequestSchema>;
export type CopySuggestion = z.infer<typeof CopySuggestionSchema>;
export type CopySuggestions = z.infer<typeof CopySuggestionsSchema>;
export type BackgroundRemovalInput = z.infer<typeof BackgroundRemovalInputSchema>;
export type DesignPromptRequest = z.infer<typeof DesignPromptRequestSchema>;
export type DesignSpec = z.infer<typeof DesignSpecSchema>;
export type DesignRevisionRequest = z.infer<typeof DesignRevisionRequestSchema>;
export type DesignRevisionPatch = z.infer<typeof DesignRevisionPatchSchema>;

export type AIErrorCode =
  | "AI_TIMEOUT"
  | "AI_INVALID_OUTPUT"
  | "AI_LIMIT_REACHED"
  | "AI_REFUSED"
  | "AI_PROVIDER_ERROR"
  | "AI_INPUT_INVALID"
  | "AI_UNAVAILABLE";
