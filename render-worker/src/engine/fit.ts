import * as fontkit from "fontkit";

import type { TemplateRegion } from "../../../src/schemas/template";
import type { RenderIssue } from "../../../src/types/render";

type FontMetrics = {
  unitsPerEm: number;
  layout: (text: string) => { advanceWidth: number };
};

export type FitTextInput = {
  field: string;
  text: string;
  region: TemplateRegion;
  fontPath: string;
  required: boolean;
  critical: boolean;
  maxLines: number;
};

export type FitTextResult = {
  field: string;
  sourceText: string;
  lines: string[];
  renderLines: string[];
  fontSize: number;
  lineHeight: number;
  width: number;
  height: number;
  truncated: boolean;
  overflowed: boolean;
  warnings: RenderIssue[];
  errors: RenderIssue[];
};

const fontCache = new Map<string, FontMetrics>();

function getFont(fontPath: string): FontMetrics {
  const cached = fontCache.get(fontPath);
  if (cached) return cached;
  const font = fontkit.openSync(fontPath) as unknown as FontMetrics;
  fontCache.set(fontPath, font);
  return font;
}

function measure(text: string, font: FontMetrics, fontSize: number): number {
  return (font.layout(text).advanceWidth / font.unitsPerEm) * fontSize;
}

function wrapText(text: string, font: FontMetrics, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";

  for (const character of text) {
    const candidate = `${current}${character}`;
    if (current && measure(candidate, font, fontSize) > maxWidth) {
      const breakAt = Math.max(current.lastIndexOf(" "), current.lastIndexOf("\t"));
      if (breakAt > 0) {
        lines.push(current.slice(0, breakAt + 1));
        current = `${current.slice(breakAt + 1)}${character}`;
      } else {
        lines.push(current);
        current = character;
      }
    } else {
      current = candidate;
    }
  }

  if (current || lines.length === 0) lines.push(current);
  return lines;
}

function fits(lines: string[], fontSize: number, region: TemplateRegion, lineHeight: number, maxLines: number): boolean {
  return lines.length <= maxLines && lines.length * fontSize * lineHeight <= region.h;
}

function truncateText(text: string, font: FontMetrics, fontSize: number, region: TemplateRegion, lineHeight: number, maxLines: number): string[] {
  const suffix = "…";
  let candidate = text;

  while (candidate.length > 0) {
    const lines = wrapText(`${candidate}${suffix}`, font, fontSize, region.w);
    if (fits(lines, fontSize, region, lineHeight, maxLines)) return lines;
    candidate = candidate.slice(0, -1);
  }

  return [suffix];
}

export function fitText(input: FitTextInput): FitTextResult {
  const font = getFont(input.fontPath);
  const maxSize = input.region.maxSize ?? 48;
  const minSize = input.region.minSize ?? 12;
  const lineHeight = input.region.lineHeight ?? 1.2;
  let chosenLines: string[] | undefined;
  let chosenSize = minSize;

  for (let size = maxSize; size >= minSize; size -= 1) {
    const lines = wrapText(input.text, font, size, input.region.w);
    if (fits(lines, size, input.region, lineHeight, input.maxLines)) {
      chosenLines = lines;
      chosenSize = size;
      break;
    }
  }

  if (chosenLines) {
    return {
      field: input.field,
      sourceText: input.text,
      lines: chosenLines,
      // Keep every source character, including spaces at wrapping boundaries.
      // The validator joins these recorded lines byte-for-byte for critical text.
      renderLines: chosenLines,
      fontSize: chosenSize,
      lineHeight,
      width: Math.max(...chosenLines.map((line) => measure(line, font, chosenSize))),
      height: chosenLines.length * chosenSize * lineHeight,
      truncated: false,
      overflowed: false,
      warnings: [],
      errors: [],
    };
  }

  const truncated = !input.required && !input.critical && input.region.overflow === "truncate";
  const lines = truncated ? truncateText(input.text, font, minSize, input.region, lineHeight, input.maxLines) : wrapText(input.text, font, minSize, input.region.w);
  const issue = {
    code: truncated ? "TEXT_TRUNCATED" : "TEXT_DOES_NOT_FIT",
    field: input.field,
    message: truncated ? `${input.field} was shortened to fit the template.` : `${input.field} cannot fit in its region at the minimum font size.`,
    severity: truncated ? "warning" as const : "error" as const,
  };

  return {
    field: input.field,
    sourceText: input.text,
    lines,
    renderLines: lines,
    fontSize: minSize,
    lineHeight,
    width: Math.max(...lines.map((line) => measure(line, font, minSize))),
    height: lines.length * minSize * lineHeight,
    truncated,
    overflowed: !truncated,
    warnings: truncated ? [issue] : [],
    errors: truncated ? [] : [issue],
  };
}
