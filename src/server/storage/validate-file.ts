import { createHash } from "node:crypto";
import sharp from "sharp";

import { createAppError, type AppError } from "@/lib/errors";
import {
  LOGO_MAX_BYTES,
  PRODUCT_IMAGE_MAX_BYTES,
  type AllowedUploadMimeType,
  type UploadAssetKind,
} from "@/schemas/upload";
import { err, ok, type Result } from "@/types/result";

export type ValidatedUploadFile = {
  mimeType: AllowedUploadMimeType;
  width: number;
  height: number;
  sizeBytes: number;
  hash: string;
  sanitizedBytes: Buffer;
};

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function hasPrefix(bytes: Buffer, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, index) => bytes[index] === byte);
}

function isWebpMagic(bytes: Buffer): boolean {
  if (bytes.length < 12) return false;
  return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

function detectMagicMime(bytes: Buffer): AllowedUploadMimeType | null {
  if (hasPrefix(bytes, PNG_MAGIC)) return "image/png";
  if (hasPrefix(bytes, JPEG_MAGIC)) return "image/jpeg";
  if (isWebpMagic(bytes)) return "image/webp";

  // Check if content starts with XML/SVG markup (after optional UTF-8 BOM, XML header, comments, and whitespace)
  const head = bytes.subarray(0, 1024).toString("utf8").replace(/^\uFEFF/, "").trimStart();
  if (/^(?:<\?xml[^>]*>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE\s+svg[^>]*>\s*)*<svg[\s>]/i.test(head)) {
    return "image/svg+xml";
  }

  return null;
}

const FORBIDDEN_SVG_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /<\s*script\b/i, reason: "SVG logos cannot contain script tags." },
  { pattern: /<\s*foreignObject\b/i, reason: "SVG logos cannot contain foreignObject elements." },
  { pattern: /<\s*(?:iframe|object|embed|audio|video)\b/i, reason: "SVG logos cannot contain embedded media or frames." },
  { pattern: /\bon[a-z]+\s*=/i, reason: "SVG logos cannot contain event handler attributes." },
  { pattern: /(?:href|xlink:href|src)\s*=\s*["']\s*(?:javascript:|data:|https?:|\/\/)/i, reason: "SVG logos cannot reference external or executable URLs." },
  { pattern: /@import\b|url\(\s*["']?\s*(?:javascript:|https?:|\/\/)/i, reason: "SVG styles cannot import external resources." },
  { pattern: /<!ENTITY\b/i, reason: "SVG logos cannot declare XML entities." },
];

/**
 * Validates and sanitizes an SVG logo buffer.
 * Rejects any SVG containing scripts, event handlers, external references, or XML entity declarations,
 * and normalizes dimensions from `width`/`height` or `viewBox`.
 */
export function sanitizeAndInspectSvg(
  bytes: Buffer,
): Result<{ sanitizedBytes: Buffer; width: number; height: number }, AppError> {
  const raw = bytes.toString("utf8").replace(/^\uFEFF/, "").trim();

  if (!/<svg[\s>][\s\S]*<\/svg\s*>$/i.test(raw)) {
    return err(createAppError("UPLOAD_INVALID", "This SVG file is incomplete or corrupted."));
  }

  for (const rule of FORBIDDEN_SVG_PATTERNS) {
    if (rule.pattern.test(raw)) {
      return err(createAppError("UPLOAD_INVALID", rule.reason));
    }
  }

  // Strip XML comments and processing instructions for clean storage
  const cleaned = raw
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  const svgTagMatch = cleaned.match(/<svg\b([^>]*)>/i);
  const attrs = svgTagMatch?.[1] ?? "";

  let width = 0;
  let height = 0;

  const widthMatch = attrs.match(/\bwidth\s*=\s*["']\s*([0-9]+(?:\.[0-9]+)?)/i);
  const heightMatch = attrs.match(/\bheight\s*=\s*["']\s*([0-9]+(?:\.[0-9]+)?)/i);
  const viewBoxMatch = attrs.match(/\bviewBox\s*=\s*["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)/i);

  if (widthMatch && heightMatch) {
    width = Math.round(Number(widthMatch[1]));
    height = Math.round(Number(heightMatch[1]));
  } else if (viewBoxMatch) {
    width = Math.round(Number(viewBoxMatch[1]));
    height = Math.round(Number(viewBoxMatch[2]));
  } else {
    width = 256;
    height = 256;
  }

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 8000 || height > 8000) {
    return err(createAppError("UPLOAD_INVALID", "SVG dimensions must be between 1px and 8000px."));
  }

  return ok({
    sanitizedBytes: Buffer.from(cleaned, "utf8"),
    width,
    height,
  });
}

/**
 * Performs server-side upload validation:
 * 1. Size limit check (5 MB for logo, 10 MB for product image).
 * 2. Magic-byte inspection (never trusts file extension or client-declared MIME alone).
 * 3. SVG restriction (only allowed for `logo` and sanitized) or real raster image decode via `sharp`.
 * 4. Computes SHA-256 content hash and extracts real width & height.
 */
export async function validateUploadedBytes(input: {
  kind: UploadAssetKind;
  declaredMimeType: string;
  fileName: string;
  bytes: Buffer;
}): Promise<Result<ValidatedUploadFile, AppError>> {
  const { kind, declaredMimeType, bytes } = input;

  if (bytes.length === 0) {
    return err(createAppError("UPLOAD_INVALID", "Uploaded file is empty."));
  }

  const maxBytes = kind === "logo" ? LOGO_MAX_BYTES : PRODUCT_IMAGE_MAX_BYTES;
  if (bytes.length > maxBytes) {
    const maxMb = kind === "logo" ? 5 : 10;
    return err(createAppError("UPLOAD_INVALID", `File exceeds the ${maxMb} MB size limit.`));
  }

  const detectedMime = detectMagicMime(bytes);
  if (!detectedMime) {
    return err(
      createAppError("UPLOAD_INVALID", "Unsupported or corrupted file format. Upload a PNG, JPG, or WebP image."),
    );
  }

  if (declaredMimeType !== detectedMime) {
    return err(
      createAppError(
        "UPLOAD_INVALID",
        "File contents do not match the declared file type. Check the file and try again.",
      ),
    );
  }

  if (detectedMime === "image/svg+xml") {
    if (kind !== "logo") {
      return err(
        createAppError("UPLOAD_INVALID", "SVG files are allowed only for logos. Upload a PNG, JPG, or WebP product photo."),
      );
    }

    const svgRes = sanitizeAndInspectSvg(bytes);
    if (!svgRes.ok) return svgRes;

    const hash = createHash("sha256").update(svgRes.value.sanitizedBytes).digest("hex");
    return ok({
      mimeType: "image/svg+xml",
      width: svgRes.value.width,
      height: svgRes.value.height,
      sizeBytes: svgRes.value.sanitizedBytes.length,
      hash,
      sanitizedBytes: svgRes.value.sanitizedBytes,
    });
  }

  try {
    const metadata = await sharp(bytes).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width <= 0 || height <= 0 || width > 12000 || height > 12000) {
      return err(createAppError("UPLOAD_INVALID", "Image dimensions are invalid."));
    }

    const hash = createHash("sha256").update(bytes).digest("hex");
    return ok({
      mimeType: detectedMime,
      width,
      height,
      sizeBytes: bytes.length,
      hash,
      sanitizedBytes: bytes,
    });
  } catch {
    return err(createAppError("UPLOAD_INVALID", "This image file appears to be corrupted. Try another file."));
  }
}
