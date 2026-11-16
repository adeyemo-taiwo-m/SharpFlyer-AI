import { resolve } from "node:path";

import { createAppError, type AppError } from "@/lib/errors";
import type { FlyerFormat } from "@/schemas/format";
import type { Template } from "@/schemas/template";
import {
  CoreRepository,
  getDefaultCoreDataStoreState,
  type CoreDataStoreState,
} from "@/server/db/client";
import { loadTemplate, type LoadedTemplate } from "@/server/templates/load";
import { validateTemplates } from "@/server/templates/validate";
import type { TemplateRow } from "@/types/database";
import { err, ok, type Result } from "@/types/result";

export { loadTemplate, type LoadedTemplate } from "@/server/templates/load";
export {
  validateTemplateDefinition,
  validateTemplateDirectory,
  validateTemplates,
} from "@/server/templates/validate";

export type TemplateSummary = {
  id: string;
  version: number;
  title: string;
  category: string;
  tags: string[];
  style: string;
  formats: FlyerFormat[];
  palettes: Template["palettes"];
  license: Template["meta"]["license"];
  definitionHash: string;
};

export type ListTemplatesFilters = {
  category?: string;
  search?: string;
  format?: FlyerFormat;
};

/**
 * Validates all templates in `templates/` and upserts their metadata into the `templates` table.
 * Enforces immutability: if an already-published `id@version` hash changes, sync fails.
 */
export async function syncTemplates(options?: {
  templateRoot?: string;
  state?: CoreDataStoreState;
}): Promise<Result<TemplateRow[], AppError>> {
  const templateRoot = options?.templateRoot ?? resolve(process.cwd(), "templates");
  const state = options?.state ?? getDefaultCoreDataStoreState();

  const report = await validateTemplates(templateRoot);
  if (report.issues.length > 0) {
    const details = report.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
    return err(createAppError("VALIDATION_FAILED", `Template validation failed: ${details}`));
  }

  const serviceRepo = new CoreRepository({ role: "service_role" }, state);
  const synced: TemplateRow[] = [];

  for (const item of report.templates) {
    const { meta, formats } = item.template;
    const upsertRes = serviceRepo.upsertTemplate({
      id: meta.id,
      version: meta.version,
      title: meta.title,
      category: meta.category,
      tags: meta.tags,
      style: meta.style,
      formats: Object.keys(formats) as FlyerFormat[],
      status: "published",
      license: meta.license,
      definition_hash: item.hash,
    });
    if (!upsertRes.ok) return upsertRes;
    synced.push(upsertRes.value);
  }

  return ok(synced);
}

/**
 * Lists published templates with optional filtering by `category`, `search` (title, category, tags), and `format`.
 */
export async function listTemplates(
  filters: ListTemplatesFilters = {},
  options?: { templateRoot?: string; state?: CoreDataStoreState },
): Promise<Result<TemplateSummary[], AppError>> {
  const templateRoot = options?.templateRoot ?? resolve(process.cwd(), "templates");
  const state = options?.state ?? getDefaultCoreDataStoreState();

  // Ensure templates are synced in memory if the store is empty
  if (state.templates.size === 0) {
    const syncRes = await syncTemplates({ templateRoot, state });
    if (!syncRes.ok) return syncRes;
  }

  const report = await validateTemplates(templateRoot);
  if (report.issues.length > 0) {
    return err(createAppError("VALIDATION_FAILED", "One or more templates failed validation."));
  }

  const normalizedCategory = filters.category?.trim().toLowerCase();
  const normalizedSearch = filters.search?.trim().toLowerCase();

  const summaries: TemplateSummary[] = [];
  for (const validated of report.templates) {
    const { meta, formats, palettes } = validated.template;
    const supportedFormats = Object.keys(formats) as FlyerFormat[];

    if (normalizedCategory && meta.category.toLowerCase() !== normalizedCategory) {
      continue;
    }

    if (filters.format && !supportedFormats.includes(filters.format)) {
      continue;
    }

    if (normalizedSearch) {
      const haystack = [meta.title, meta.category, meta.style, ...meta.tags]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(normalizedSearch)) {
        continue;
      }
    }

    summaries.push({
      id: meta.id,
      version: meta.version,
      title: meta.title,
      category: meta.category,
      tags: meta.tags,
      style: meta.style,
      formats: supportedFormats,
      palettes,
      license: meta.license,
      definitionHash: validated.hash,
    });
  }

  return ok(summaries);
}

/**
 * Loads a single validated template by ID.
 */
export async function getTemplate(
  templateId: string,
  options?: { templateRoot?: string },
): Promise<Result<LoadedTemplate, AppError>> {
  return loadTemplate(templateId, options?.templateRoot);
}
