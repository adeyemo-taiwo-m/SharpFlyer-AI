import type { RenderRequestInput } from "@/schemas/render";

export type RenderIssue = {
  code: string;
  message: string;
  field?: string;
  severity?: "warning" | "error";
};

export type RenderRequest = RenderRequestInput;

export type RenderResult = {
  jobId: string;
  ok: boolean;
  outputUrl?: string;
  warnings: RenderIssue[];
  errors: RenderIssue[];
  metrics: {
    durationMs: number;
    minFontSizeUsed: number;
  };
};
