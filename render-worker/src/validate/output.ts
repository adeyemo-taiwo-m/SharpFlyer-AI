import { formatCurrency } from "../../../src/lib/money";
import { formatPhoneDisplay } from "../../../src/lib/phone";
import { contrastRatio } from "../../../src/lib/contrast";
import { CRITICAL_FIELD_KEYS } from "../../../src/schemas/critical";
import type { Template } from "../../../src/schemas/template";
import type { FlyerContent } from "../../../src/schemas/flyer";
import type { RenderIssue } from "../../../src/types/render";
import type { LayoutDocument } from "../types/layout";

function issue(code: string, message: string, field?: string, severity: "warning" | "error" = "error"): RenderIssue {
  return { code, message, field, severity };
}

function expectedValue(field: string, content: FlyerContent): string | undefined {
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

function isLargeText(fontSize: number, weight: number): boolean {
  return fontSize >= 24 || (fontSize >= 19 && weight >= 600);
}

export function validateLayout(layout: LayoutDocument, template: Template, content: FlyerContent): { warnings: RenderIssue[]; errors: RenderIssue[] } {
  const warnings = [...layout.warnings];
  const errors = [...layout.errors];

  for (const field of template.fields) {
    const laidOut = layout.fields[field.key];
    const expected = expectedValue(field.key, content);
    const isImageField = field.type === "image" || field.type === "logo";
    const imageIsPresent = isImageField && layout.images.some((image) => image.field === (field.key === "logo" ? "logo" : "productImage"));

    if (field.required && (!laidOut || (isImageField ? !imageIsPresent : expected === undefined || laidOut.lines.length === 0))) {
      errors.push(issue("REQUIRED_FIELD_MISSING", `${field.key} is required but its region is empty.`, field.key));
    }

    if (!laidOut || expected === undefined || isImageField) continue;

    if (CRITICAL_FIELD_KEYS.includes(field.key as (typeof CRITICAL_FIELD_KEYS)[number])) {
      const recordedText = laidOut.lines.join("");
      const renderedText = laidOut.renderLines.join("");
      if (recordedText !== expected || renderedText !== expected || recordedText !== renderedText) {
        errors.push(issue("CRITICAL_TEXT_MISMATCH", `${field.key} changed during layout.`, field.key));
      }
    }

    if (laidOut.overflowed || laidOut.width > laidOut.region.w + 0.01 || laidOut.height > laidOut.region.h + 0.01) {
      errors.push(issue("TEXT_OVERFLOW", `${field.key} extends beyond its text region.`, field.key));
    }

    const right = laidOut.region.x + laidOut.region.w;
    const bottom = laidOut.region.y + laidOut.region.h;
    const insideSafeArea = laidOut.region.x >= layout.safeArea && laidOut.region.y >= layout.safeArea && right <= layout.width - layout.safeArea && bottom <= layout.height - layout.safeArea;
    if (!insideSafeArea) errors.push(issue("SAFE_AREA_OVERFLOW", `${field.key} extends beyond the safe area.`, field.key));

    const foreground = laidOut.color;
    const background = laidOut.backgroundColor;
    try {
      const ratio = contrastRatio(foreground, background);
      const minimum = isLargeText(laidOut.fontSize, laidOut.weight) ? 3 : 4.5;
      if (ratio < minimum) {
        warnings.push(issue("LOW_CONTRAST", `${field.key} has ${ratio.toFixed(2)}:1 contrast. Use a recommended color.`, field.key, "warning"));
      }
    } catch {
      errors.push(issue("INVALID_COLOR", `${field.key} uses a color that cannot be validated.`, field.key));
    }
  }

  for (const image of layout.images) {
    if (image.stretched) errors.push(issue("IMAGE_STRETCHED", `${image.field} is stretched instead of fitting proportionally.`, image.field));
    if (image.sourceWidth && image.sourceHeight && (image.sourceWidth < image.region.w || image.sourceHeight < image.region.h)) {
      warnings.push(issue("LOW_IMAGE_RESOLUTION", `${image.field} may look soft at this size.`, image.field, "warning"));
    }
    const right = image.region.x + image.region.w;
    const bottom = image.region.y + image.region.h;
    if (image.region.x < layout.safeArea || image.region.y < layout.safeArea || right > layout.width - layout.safeArea || bottom > layout.height - layout.safeArea) {
      errors.push(issue("SAFE_AREA_OVERFLOW", `${image.field} extends beyond the safe area.`, image.field));
    }
  }

  return { warnings, errors };
}
