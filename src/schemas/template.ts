import { z } from "zod";
import { FORMAT_VALUES, FormatSchema } from "@/schemas/format";

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Use a valid hexadecimal color.");

const FormatDefinitionSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  safeArea: z.number().int().nonnegative(),
});

const LicenseSchema = z.object({
  author: z.string().min(1),
  type: z.string().min(1),
  fonts: z.array(z.string().min(1)),
});

const TemplateFieldSchema = z.object({
  key: z.string().min(1),
  type: z.enum(["text", "price", "phone", "image", "logo"]),
  required: z.boolean(),
  maxLength: z.number().int().positive().optional(),
});

const RegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  font: z.string().min(1).optional(),
  weight: z.number().int().positive().optional(),
  minSize: z.number().positive().optional(),
  maxSize: z.number().positive().optional(),
  lineHeight: z.number().positive().optional(),
  overflow: z.enum(["shrink", "truncate", "fail"]).optional(),
  color: z.string().min(1).optional(),
  format: z.string().min(1).optional(),
  fit: z.enum(["contain", "cover", "smart-crop"]).optional(),
  shadow: z.boolean().optional(),
  mask: z.string().min(1).optional(),
});

const DecorSchema = z.object({
  type: z.enum(["shape", "image", "line", "text"]),
  kind: z.string().min(1).optional(),
  x: z.number(),
  y: z.number(),
  w: z.number().nonnegative().optional(),
  h: z.number().nonnegative().optional(),
  fill: z.string().min(1).optional(),
  stroke: z.string().min(1).optional(),
  radius: z.number().nonnegative().optional(),
  opacity: z.number().min(0).max(1).optional(),
  assetId: z.string().min(1).optional(),
});

const validateFormatKeys = (value: Record<string, unknown>, context: z.RefinementCtx) => {
  for (const key of Object.keys(value)) {
    if (!(FORMAT_VALUES as readonly string[]).includes(key)) {
      context.addIssue({ code: "custom", message: `Unsupported format: ${key}` });
    }
  }
};

export const TemplateSchema = z.object({
  meta: z.object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    title: z.string().min(1),
    category: z.string().min(1),
    tags: z.array(z.string().min(1)),
    style: z.string().min(1),
    license: LicenseSchema,
  }),
  formats: z.record(z.string(), FormatDefinitionSchema).superRefine(validateFormatKeys),
  palettes: z.array(z.object({
    id: z.string().min(1),
    roles: z.record(z.string(), HexColorSchema),
  })).min(1),
  fields: z.array(TemplateFieldSchema).min(1),
  regions: z.record(z.string(), z.record(z.string(), RegionSchema)).superRefine(validateFormatKeys),
  decor: z.array(DecorSchema),
  constraints: z.object({
    minContrast: z.number().positive(),
    maxHeadlineLines: z.number().int().positive(),
  }),
});

export type Template = z.infer<typeof TemplateSchema>;
export type TemplateField = z.infer<typeof TemplateFieldSchema>;
export type TemplateRegion = z.infer<typeof RegionSchema>;
export type TemplateFormat = z.infer<typeof FormatSchema>;
