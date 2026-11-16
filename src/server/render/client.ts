import { createAppError, type AppError } from "@/lib/errors";
import { RenderRequestSchema, RenderWorkerResponseSchema } from "@/schemas/render";
import { err, ok, type Result } from "@/types/result";
import type { RenderIssue, RenderRequest } from "@/types/render";

export type RenderResponse = {
  jobId: string;
  outputBuffer: Buffer;
  warnings: RenderIssue[];
  errors: RenderIssue[];
  metrics: {
    durationMs: number;
    minFontSizeUsed: number;
  };
};

export type RenderError = AppError & {
  warnings?: RenderIssue[];
  issues?: RenderIssue[];
};

export interface RenderClient {
  render(request: RenderRequest): Promise<Result<RenderResponse, RenderError>>;
}

export class HttpRenderClient implements RenderClient {
  constructor(private readonly baseUrl: string, private readonly secret: string) {}

  async render(request: RenderRequest): Promise<Result<RenderResponse, RenderError>> {
    const validRequest = RenderRequestSchema.safeParse(request);
    if (!validRequest.success) return err(createAppError("VALIDATION_FAILED", validRequest.error.issues[0]?.message ?? "Render request is invalid."));

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/render`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-render-worker-secret": this.secret },
        body: JSON.stringify(validRequest.data),
      });
      const parsed = RenderWorkerResponseSchema.safeParse(await response.json());
      if (!parsed.success) return err(createAppError("RENDER_FAILED", "The render worker returned an invalid response."));
      const payload = parsed.data;

      if (!response.ok || !payload.ok || !payload.outputBase64 || !payload.jobId) {
        const validationFailure = payload.errors.some((entry) => entry.severity === "error" && entry.code !== "INVALID_REQUEST");
        const baseError = createAppError(
          validationFailure ? "RENDER_VALIDATION_FAILED" : "RENDER_FAILED",
          payload.errors[0]?.message,
        );
        return err({
          ...baseError,
          warnings: payload.warnings ?? [],
          issues: payload.errors ?? [],
        });
      }

      return ok({ jobId: payload.jobId, outputBuffer: Buffer.from(payload.outputBase64, "base64"), warnings: payload.warnings ?? [], errors: payload.errors ?? [], metrics: payload.metrics });
    } catch {
      return err(createAppError("RENDER_FAILED"));
    }
  }
}

export class LocalRenderClient implements RenderClient {
  async render(request: RenderRequest): Promise<Result<RenderResponse, RenderError>> {
    const validRequest = RenderRequestSchema.safeParse(request);
    if (!validRequest.success) {
      return err(
        createAppError(
          "VALIDATION_FAILED",
          validRequest.error.issues[0]?.message ?? "Render request is invalid.",
        ),
      );
    }

    try {
      const { renderFlyer } = await import("../../../render-worker/src/engine/render");
      const result = await renderFlyer(validRequest.data, {
        output: validRequest.data.fileType ?? "png",
      });

      if (!result.ok || !result.outputBuffer) {
        const validationFailure = result.errors.some(
          (entry) => entry.severity === "error" && entry.code !== "INVALID_REQUEST",
        );
        const baseError = createAppError(
          validationFailure ? "RENDER_VALIDATION_FAILED" : "RENDER_FAILED",
          result.errors[0]?.message,
        );
        return err({
          ...baseError,
          warnings: result.warnings ?? [],
          issues: result.errors ?? [],
        });
      }

      return ok({
        jobId: validRequest.data.jobId,
        outputBuffer: result.outputBuffer,
        warnings: result.warnings ?? [],
        errors: result.errors ?? [],
        metrics: result.metrics,
      });
    } catch {
      return err(createAppError("RENDER_FAILED"));
    }
  }
}

export function getDefaultRenderClient(): RenderClient {
  const url = process.env.RENDER_WORKER_URL;
  const secret = process.env.RENDER_WORKER_SECRET;
  if (url && secret) {
    return new HttpRenderClient(url, secret);
  }
  return new LocalRenderClient();
}
