import type { TemplateRegion } from "../../../src/schemas/template";
import type { RenderIssue } from "../../../src/types/render";

export type LayoutField = {
  field: string;
  value?: string;
  sourceText: string;
  lines: string[];
  renderLines: string[];
  fontSize: number;
  lineHeight: number;
  width: number;
  height: number;
  region: TemplateRegion;
  required: boolean;
  critical: boolean;
  color: string;
  backgroundColor: string;
  weight: number;
  overflowed: boolean;
};

export type LayoutImage = {
  field: "logo" | "productImage";
  region: TemplateRegion;
  sourceWidth?: number;
  sourceHeight?: number;
  stretched: boolean;
  source?: string;
};

export type LayoutDocument = {
  format: string;
  width: number;
  height: number;
  safeArea: number;
  palette: Record<string, string>;
  fields: Record<string, LayoutField>;
  images: LayoutImage[];
  warnings: RenderIssue[];
  errors: RenderIssue[];
};
