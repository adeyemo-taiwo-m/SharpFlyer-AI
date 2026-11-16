import { z } from "zod";

export const LOGO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const UploadAssetKindSchema = z.enum(["logo", "product_image"]);
export type UploadAssetKind = z.infer<typeof UploadAssetKindSchema>;

export const AllowedUploadMimeSchema = z.enum([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);
export type AllowedUploadMimeType = z.infer<typeof AllowedUploadMimeSchema>;

export const UploadUrlRequestSchema = z
  .object({
    kind: UploadAssetKindSchema,
    fileName: z.string().trim().min(1).max(180),
    mimeType: AllowedUploadMimeSchema,
    sizeBytes: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "product_image" && value.mimeType === "image/svg+xml") {
      ctx.addIssue({
        code: "custom",
        path: ["mimeType"],
        message: "SVG files are allowed only for logos. Upload a PNG, JPG, or WebP product photo.",
      });
    }

    const maxBytes = value.kind === "logo" ? LOGO_MAX_BYTES : PRODUCT_IMAGE_MAX_BYTES;
    if (value.sizeBytes > maxBytes) {
      const maxMb = value.kind === "logo" ? 5 : 10;
      ctx.addIssue({
        code: "custom",
        path: ["sizeBytes"],
        message: `File is too large. Upload a file up to ${maxMb} MB.`,
      });
    }
  });

export type UploadUrlRequest = z.infer<typeof UploadUrlRequestSchema>;
