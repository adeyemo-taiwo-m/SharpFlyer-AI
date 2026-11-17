import type { AppError } from "@/lib/errors";
import { err, type Result } from "@/types/result";

export const COPY_FALLBACK_MESSAGE = "Suggestions are unavailable right now. Write your own copy.";

export function copyFallback<T>(): Result<T, AppError> {
  return err({ code: "AI_UNAVAILABLE", message: COPY_FALLBACK_MESSAGE });
}

export function keepOriginalImage<T>(bytes: T): { bytes: T; usedFallback: true; warning: string } {
  return { bytes, usedFallback: true, warning: "The original image was kept because background removal was unavailable." };
}
