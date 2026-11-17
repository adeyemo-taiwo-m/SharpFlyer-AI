"use server";

import { updateTemplateStatus } from "@/server/admin";
import type { TemplateStatus } from "@/types/database";
import type { AppError } from "@/lib/errors";
import { err, type Result } from "@/types/result";

export async function updateTemplateStatusAction(
  templateId: string,
  version: number,
  status: TemplateStatus,
): Promise<Result<true, AppError>> {
  if (!Number.isInteger(version)) return err({ code: "VALIDATION_FAILED", message: "Invalid template version." });
  return updateTemplateStatus(templateId, version, status);
}

