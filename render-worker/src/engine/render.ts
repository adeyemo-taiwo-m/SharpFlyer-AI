import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { createElement, type CSSProperties, type ReactNode } from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

import { CRITICAL_FIELD_KEYS } from "../../../src/schemas/critical";
import { FlyerContentSchema, type FlyerContent } from "../../../src/schemas/flyer";
import { formatCurrency } from "../../../src/lib/money";
import { formatPhoneDisplay } from "../../../src/lib/phone";
import { loadTemplate } from "../../../src/server/templates/load";
import type { RenderIssue, RenderRequest } from "../../../src/types/render";
import type { Template, TemplateRegion } from "../../../src/schemas/template";
import { findFontPath, loadSatoriFonts } from "./fonts";
import { fitText } from "./fit";
import type { LayoutDocument, LayoutField, LayoutImage } from "../types/layout";
import { validateLayout } from "../validate/output";

export type WorkerRenderResult = {
  ok: boolean;
  outputBuffer?: Buffer;
  warnings: RenderIssue[];
  errors: RenderIssue[];
  metrics: {
    durationMs: number;
    minFontSizeUsed: number;
  };
  layout?: LayoutDocument;
};

export type RenderOptions = {
  templateRoot?: string;
  output?: "png" | "jpg";
};

function renderIssue(code: string, message: string, fieldOrSeverity?: string, severity: "warning" | "error" = "error"): RenderIssue {
  const field = fieldOrSeverity === "warning" || fieldOrSeverity === "error" ? undefined : fieldOrSeverity;
  const resolvedSeverity = fieldOrSeverity === "warning" || fieldOrSeverity === "error" ? fieldOrSeverity : severity;
  return { code, message, field, severity: resolvedSeverity };
}

function roleColor(palette: Record<string, string>, role: string | undefined, fallback: string): string {
  if (!role) return fallback;
  return role.startsWith("#") ? role : palette[role] ?? fallback;
}

function fieldValue(field: string, content: FlyerContent): string | undefined {
  switch (field) {
    case "price":
      return content.price === undefined ? undefined : formatCurrency(content.price, content.currency);
    case "oldPrice":
      return content.oldPrice === undefined ? undefined : formatCurrency(content.oldPrice, content.currency);
    case "phone":
      return formatPhoneDisplay(content.phone);
    case "body":
      return content.body ?? content.offer;
    case "headline":
    case "businessName":
    case "address":
      return content[field] as string | undefined;
    default:
      return undefined;
  }
}

function getAssetUrl(field: "logo" | "productImage", request: RenderRequest, content: FlyerContent): string | undefined {
  if (field === "logo") return content.logoAssetId ? request.assets.logoUrl : undefined;
  return content.productImageAssetIds.length > 0 ? request.assets.productImageUrls[0] : undefined;
}

async function readAsset(source: string): Promise<{ data: Buffer; width?: number; height?: number; mime: string }> {
  let data: Buffer;
  let mime = "image/png";

  if (source.startsWith("data:")) {
    const match = source.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
    if (!match) throw new Error("Asset data URL is invalid.");
    mime = match[1] ?? mime;
    data = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]));
  } else if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Asset request failed with status ${response.status}.`);
    const contentType = response.headers.get("content-type");
    mime = contentType?.split(";")[0] ?? mime;
    data = Buffer.from(await response.arrayBuffer());
  } else {
    data = await readFile(isAbsolute(source) ? source : resolve(process.cwd(), source));
  }

  const metadata = await sharp(data).metadata();
  return { data, width: metadata.width, height: metadata.height, mime };
}

function imageDataUrl(data: Buffer, mime: string): string {
  return `data:${mime};base64,${data.toString("base64")}`;
}

function textStyle(region: TemplateRegion, field: LayoutField): CSSProperties {
  return {
    position: "absolute",
    left: region.x,
    top: region.y,
    width: region.w,
    height: region.h,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontFamily: region.font ?? "Inter",
    fontSize: field.fontSize,
    fontWeight: field.weight,
    lineHeight: field.lineHeight,
    color: field.color,
    whiteSpace: "pre-wrap",
  };
}

function decorStyle(template: Template, item: Template["decor"][number], palette: Record<string, string>): CSSProperties {
  const width = item.w ?? 0;
  const height = item.h ?? 0;
  const fill = roleColor(palette, item.fill, "transparent");
  const stroke = roleColor(palette, item.stroke, "transparent");
  const isCircle = item.kind === "circle";

  return {
    position: "absolute",
    left: item.x,
    top: item.y,
    width,
    height,
    display: "flex",
    backgroundColor: fill,
    borderColor: stroke,
    borderWidth: item.stroke ? 1 : 0,
    borderStyle: "solid",
    borderRadius: isCircle ? 9999 : item.radius ?? 0,
    opacity: item.opacity ?? 1,
  };
}

function regionFor(template: Template, format: RenderRequest["format"], key: string): TemplateRegion | undefined {
  return template.regions[format]?.[key];
}

export async function renderFlyer(request: RenderRequest, options: RenderOptions = {}): Promise<WorkerRenderResult> {
  const started = Date.now();
  const warnings: RenderIssue[] = [];
  const errors: RenderIssue[] = [];
  const loaded = await loadTemplate(request.templateId, options.templateRoot, request.templateVersion);

  if (!loaded.ok) {
    return { ok: false, warnings, errors: [renderIssue(loaded.error.code, loaded.error.message)], metrics: { durationMs: Date.now() - started, minFontSizeUsed: 0 } };
  }

  const { template, directory } = loaded.value;
  if (template.meta.version !== request.templateVersion) {
    return { ok: false, warnings, errors: [renderIssue("TEMPLATE_VERSION_MISMATCH", `Template ${request.templateId} is version ${template.meta.version}, not ${request.templateVersion}.`)], metrics: { durationMs: Date.now() - started, minFontSizeUsed: 0 } };
  }

  const parsedContent = FlyerContentSchema.safeParse(request.content);
  if (!parsedContent.success) {
    return { ok: false, warnings, errors: [renderIssue("INVALID_CONTENT", parsedContent.error.issues[0]?.message ?? "Flyer content is invalid.")], metrics: { durationMs: Date.now() - started, minFontSizeUsed: 0 } };
  }
  const content = parsedContent.data;
  if (content.format !== request.format) {
    return { ok: false, warnings, errors: [renderIssue("FORMAT_MISMATCH", "Flyer content and render format must match.")], metrics: { durationMs: Date.now() - started, minFontSizeUsed: 0 } };
  }

  const format = template.formats[request.format];
  if (!format) {
    return { ok: false, warnings, errors: [renderIssue("FORMAT_UNSUPPORTED", `${request.format} is not available in this template.`)], metrics: { durationMs: Date.now() - started, minFontSizeUsed: 0 } };
  }

  const palette = template.palettes.find((candidate) => candidate.id === request.themeId)?.roles ?? template.palettes[0].roles;
  if (!template.palettes.some((candidate) => candidate.id === request.themeId)) warnings.push(renderIssue("PALETTE_FALLBACK", "The selected palette was not found, so the template default was used.", "warning"));

  const fonts = await loadSatoriFonts(directory, template.meta.license.fonts);
  const fields: Record<string, LayoutField> = {};
  const images: LayoutImage[] = [];
  let minFontSizeUsed = Number.POSITIVE_INFINITY;

  for (const definition of template.fields) {
    const region = regionFor(template, request.format, definition.key);
    if (!region) {
      errors.push(renderIssue("REGION_MISSING", `${definition.key} has no region in ${request.format}.`, definition.key));
      continue;
    }

    if (definition.type === "image" || definition.type === "logo") {
      const imageField = definition.key === "logo" ? "logo" : "productImage";
      const source = getAssetUrl(imageField, request, content);
      if (!source) continue;
      try {
        const asset = await readAsset(source);
        images.push({ field: imageField, region, sourceWidth: asset.width, sourceHeight: asset.height, stretched: false, source: imageDataUrl(asset.data, asset.mime) });
      } catch {
        warnings.push(renderIssue("ASSET_UNAVAILABLE", `${definition.key} could not be loaded and was omitted.`, "warning"));
      }
      continue;
    }

    const value = fieldValue(definition.key, content);
    if (value === undefined) continue;
    const weight = region.weight ?? 400;
    const fontPath = await findFontPath(directory, region.font ?? template.meta.license.fonts[0], weight);
    const fit = fitText({
      field: definition.key,
      text: value,
      region,
      fontPath,
      required: definition.required,
      critical: CRITICAL_FIELD_KEYS.includes(definition.key as (typeof CRITICAL_FIELD_KEYS)[number]),
      maxLines: definition.key === "headline" ? template.constraints.maxHeadlineLines : 10,
    });
    warnings.push(...fit.warnings);
    errors.push(...fit.errors);
    minFontSizeUsed = Math.min(minFontSizeUsed, fit.fontSize);
    fields[definition.key] = {
      field: definition.key,
      value,
      sourceText: fit.sourceText,
      lines: fit.lines,
      renderLines: fit.renderLines,
      fontSize: fit.fontSize,
      lineHeight: fit.lineHeight,
      width: fit.width,
      height: fit.height,
      region,
      required: definition.required,
      critical: CRITICAL_FIELD_KEYS.includes(definition.key as (typeof CRITICAL_FIELD_KEYS)[number]),
      color: roleColor(palette, region.color, palette.text ?? "#000000"),
      backgroundColor: palette.bg ?? "#FFFFFF",
      weight,
      overflowed: fit.overflowed,
    };
  }

  const layout: LayoutDocument = { format: request.format, width: format.width, height: format.height, safeArea: format.safeArea, palette, fields, images, warnings: [], errors: [] };
  const validated = validateLayout(layout, template, content);
  warnings.push(...validated.warnings);
  errors.push(...validated.errors);

  if (errors.length > 0) {
    return { ok: false, warnings, errors, metrics: { durationMs: Date.now() - started, minFontSizeUsed: Number.isFinite(minFontSizeUsed) ? minFontSizeUsed : 0 }, layout };
  }

  const children: ReactNode[] = [];
  for (const decor of template.decor) children.push(createElement("div", { key: `decor-${children.length}`, style: decorStyle(template, decor, palette) }));
  for (const image of images) {
    const position = image.field === "productImage" ? request.content.imagePosition : undefined;
    const objectPosition = position
      ? `${50 + position.x * 35}% ${50 + position.y * 35}%`
      : "center";
    children.push(createElement("img", {
      key: image.field,
      src: image.source,
      style: { position: "absolute", left: image.region.x, top: image.region.y, width: image.region.w, height: image.region.h, objectFit: image.region.fit === "cover" || image.region.fit === "smart-crop" ? "cover" : "contain", objectPosition, boxShadow: image.region.shadow ? "0 16px 32px rgba(0,0,0,0.18)" : undefined } as CSSProperties,
    }));
  }
  for (const field of Object.values(fields)) {
    children.push(createElement("div", { key: field.field, style: textStyle(field.region, field) }, field.renderLines.map((line, index) => createElement("div", { key: `${field.field}-${index}`, style: { display: "flex", height: field.fontSize * field.lineHeight } }, line))));
  }

  const tree = createElement("div", { style: { position: "relative", display: "flex", flexDirection: "column", width: format.width, height: format.height, overflow: "hidden", backgroundColor: palette.bg ?? "#FFFFFF" } as CSSProperties }, children);
  const svg = await satori(tree, { width: format.width, height: format.height, fonts: fonts.map((font) => ({ name: font.name, data: font.data as unknown as ArrayBuffer, weight: font.weight, style: font.style })) });
  const rendered = new Resvg(svg, { fitTo: { mode: "zoom", value: request.scale }, font: { loadSystemFonts: false } }).render().asPng();
  const png = Buffer.from(rendered);
  const outputBuffer = options.output === "jpg" ? await sharp(png).jpeg({ quality: 92 }).toBuffer() : png;

  return { ok: true, outputBuffer, warnings, errors: [], metrics: { durationMs: Date.now() - started, minFontSizeUsed: Number.isFinite(minFontSizeUsed) ? minFontSizeUsed : 0 }, layout };
}
