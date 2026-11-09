import type { FlyerContent } from "@/schemas/flyer";
import type { FlyerFormat } from "@/schemas/format";

export type RenderIssue = {
  code: string;
  message: string;
  field?: string;
  severity?: "warning" | "error";
};

export type RenderRequest = {
  jobId: string;
  templateId: string;
  templateVersion: number;
  format: FlyerFormat;
  scale: 1 | 2;
  content: FlyerContent;
  assets: {
    logoUrl?: string;
    productImageUrls: string[];
  };
  themeId: string;
  purpose: "preview" | "export";
};

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
