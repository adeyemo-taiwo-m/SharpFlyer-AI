import { z } from "zod";

export const HexColorOptionalSchema = z.preprocess(
  (value) => value ?? "",
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^#[0-9A-Fa-f]{6}$/.test(value), "Use a six-digit hex colour.")
    .transform((value) => value || null),
);

export const BrandProfileInputSchema = z.object({
  businessName: z.string().trim().min(1, "Enter your business name.").max(80),
  phone: z.string().trim().min(1, "Enter a phone number."),
  address: z.string().trim().max(140).optional().default(""),
  logoAssetId: z.string().trim().max(240).optional().default(""),
  primaryColor: HexColorOptionalSchema.optional().default(""),
  secondaryColor: HexColorOptionalSchema.optional().default(""),
});

export const OnboardingInputSchema = BrandProfileInputSchema.extend({
  businessType: z.string().trim().min(1, "Choose what you sell.").max(80),
});

export type BrandProfileInput = z.infer<typeof BrandProfileInputSchema>;
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;
