import { randomUUID } from "node:crypto";

import type { CoreDataStoreState } from "@/server/db/client";
import { CoreRepository } from "@/server/db/client";
import type { FlyerFormat } from "@/schemas/format";

export function newCorrelationId(): string {
  return randomUUID();
}

export type RenderObservation = {
  jobId: string;
  correlationId?: string;
  userId?: string | null;
  templateId: string;
  templateVersion: number;
  format: FlyerFormat;
  purpose: "preview" | "export";
  durationMs?: number | null;
  result: "succeeded" | "failed";
  errorCode?: string | null;
};

export function logRenderJob(input: RenderObservation, state: CoreDataStoreState): void {
  const result = new CoreRepository({ role: "service_role" }, state).insertRenderJob({
    job_id: input.jobId,
    correlation_id: input.correlationId ?? null,
    user_id: input.userId ?? null,
    template_id: input.templateId,
    template_version: input.templateVersion,
    format: input.format,
    purpose: input.purpose,
    duration_ms: input.durationMs ?? null,
    result: input.result,
    error_code: input.errorCode ?? null,
  });
  if (!result.ok) console.error("[render-job-log-failed]", result.error.code);
}

export function captureServerError(error: unknown, context: Record<string, string | number | boolean | null> = {}): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[sharpflyer-error]", { message: message.slice(0, 300), ...context });
}

