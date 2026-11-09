import { z } from "zod";
import { CurrencyCodeSchema, FormatSchema } from "@/schemas/format";

const NonNegativeMinorUnitsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const NonBlankString = (max: number) => z.string().max(max).refine((value) => value.trim().length > 0, "This field cannot be empty.");

export const FlyerContentSchema = z.object({
  headline: NonBlankString(120),
  body: z.string().max(500).optional(),
  offer: z.string().max(500).optional(),
  price: NonNegativeMinorUnitsSchema.optional(),
  oldPrice: NonNegativeMinorUnitsSchema.optional(),
  currency: CurrencyCodeSchema.default("NGN"),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Use a normalized E.164 phone number."),
  businessName: NonBlankString(120),
  address: z.string().max(240).optional(),
  logoAssetId: NonBlankString(240).optional(),
  productImageAssetIds: z.array(NonBlankString(240)).default([]),
  themeId: NonBlankString(120),
  format: FormatSchema,
}).superRefine((content, context) => {
  if (content.body && content.offer) {
    context.addIssue({ code: "custom", path: ["body"], message: "Use body or offer, not both." });
  }

  if (content.oldPrice !== undefined && content.price === undefined) {
    context.addIssue({ code: "custom", path: ["price"], message: "Add a current price before adding an old price." });
  }

  if (content.oldPrice !== undefined && content.price !== undefined && content.oldPrice <= content.price) {
    context.addIssue({ code: "custom", path: ["oldPrice"], message: "Old price must be higher than the new price." });
  }
});

export type FlyerContent = z.infer<typeof FlyerContentSchema>;
