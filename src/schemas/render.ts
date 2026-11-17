import { z } from "zod";

import { FlyerContentSchema } from "@/schemas/flyer";
import { FormatSchema } from "@/schemas/format";

const NonBlankString = z.string().min(1);

export const RenderRequestSchema = z.object({
  jobId: NonBlankString.max(200),
  correlationId: NonBlankString.max(200).optional(),
  templateId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  templateVersion: z.number().int().positive(),
  format: FormatSchema,
  scale: z.union([z.literal(1), z.literal(2)]),
  content: FlyerContentSchema,
  assets: z.object({
    logoUrl: z.string().min(1).optional(),
    productImageUrls: z.array(z.string().min(1)).max(8),
  }),
  themeId: NonBlankString.max(120),
  purpose: z.enum(["preview", "export"]),
  fileType: z.enum(["png", "jpg"]).default("png").optional(),
});

export const RenderIssueSchema = z.object({
  code: NonBlankString,
  message: NonBlankString,
  field: NonBlankString.optional(),
  severity: z.enum(["warning", "error"]).optional(),
});

export const RenderMetricsSchema = z.object({
  durationMs: z.number().nonnegative(),
  minFontSizeUsed: z.number().nonnegative(),
});

export const RenderWorkerResponseSchema = z.object({
  ok: z.boolean(),
  jobId: NonBlankString.optional(),
  outputBase64: z.string().min(1).optional(),
  warnings: z.array(RenderIssueSchema),
  errors: z.array(RenderIssueSchema),
  metrics: RenderMetricsSchema,
});

export type RenderRequestInput = z.infer<typeof RenderRequestSchema>;
