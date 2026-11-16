import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";

import { TemplateSchema, type Template } from "@/schemas/template";

export type TemplateValidationIssue = {
  path: string;
  message: string;
};

export type ValidatedTemplate = {
  template: Template;
  templatePath: string;
  raw: string;
  hash: string;
  key: string;
};

export type TemplateValidationOptions = {
  publishedHashes?: Record<string, string>;
  requirePublishedHashes?: boolean;
};

export type TemplateValidationReport = {
  entries: number;
  templates: ValidatedTemplate[];
  issues: TemplateValidationIssue[];
};

type TemplateDirectoryEntry = { name: string; isDirectory: () => boolean };

function normalizeAssetName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else files.push(path);
  }

  return files;
}

export function validateTemplateDefinition(template: Template): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = [];
  const fieldKeys = new Set(template.fields.map((field) => field.key));

  for (const format of Object.keys(template.formats)) {
    const regions = template.regions[format];
    if (!regions) {
      issues.push({ path: `regions.${format}`, message: `Missing regions for format ${format}.` });
      continue;
    }
    for (const field of fieldKeys) {
      if (!regions[field]) issues.push({ path: `regions.${format}.${field}`, message: `${field} has no region in ${format}.` });
    }
    for (const regionField of Object.keys(regions)) {
      if (!fieldKeys.has(regionField)) issues.push({ path: `regions.${format}.${regionField}`, message: `${regionField} is not declared as a template field.` });
    }
  }

  return issues;
}

function addSchemaIssues(issues: TemplateValidationIssue[], templatePath: string, parsed: { issues: Array<{ path: PropertyKey[]; message: string }> }): void {
  for (const issue of parsed.issues) {
    const issuePath = issue.path.map((part) => String(part)).join(".");
    issues.push({ path: templatePath, message: issuePath ? `${issuePath}: ${issue.message}` : issue.message });
  }
}

export async function validateTemplateDirectory(templateDirectory: string, options: TemplateValidationOptions = {}): Promise<TemplateValidationReport> {
  const templatePath = join(templateDirectory, "template.json");
  const relativeTemplatePath = relative(process.cwd(), templatePath);
  const issues: TemplateValidationIssue[] = [];
  const templates: ValidatedTemplate[] = [];

  let raw: string;
  try {
    raw = await readFile(templatePath, "utf8");
  } catch (error) {
    issues.push({ path: relativeTemplatePath, message: error instanceof Error ? error.message : String(error) });
    return { entries: 1, templates, issues };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    issues.push({ path: relativeTemplatePath, message: error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON." });
    return { entries: 1, templates, issues };
  }

  const parsed = TemplateSchema.safeParse(json);
  if (!parsed.success) {
    addSchemaIssues(issues, relativeTemplatePath, parsed.error);
    return { entries: 1, templates, issues };
  }

  const template = parsed.data;
  const folderId = basename(dirname(templatePath));
  if (template.meta.id !== folderId) {
    issues.push({ path: relativeTemplatePath, message: `meta.id ${template.meta.id} must match the template directory ${folderId}.` });
  }

  issues.push(...validateTemplateDefinition(template).map((issue) => ({ path: relativeTemplatePath, message: `${issue.path}: ${issue.message}` })));

  const assetsDirectory = join(templateDirectory, "assets");
  const assetFiles = await listFiles(assetsDirectory).catch(() => [] as string[]);
  const fontAssetNames = assetFiles
    .filter((asset) => /\.(woff2?|ttf|otf)$/i.test(asset))
    .map((asset) => normalizeAssetName(basename(asset)));

  if (!template.meta.license.author.trim() || !template.meta.license.type.trim() || template.meta.license.fonts.length === 0) {
    issues.push({ path: relativeTemplatePath, message: "License author, type, and at least one licensed font are required." });
  }
  if (!assetFiles.some((asset) => basename(asset).toLowerCase() === "license.md")) {
    issues.push({ path: relativeTemplatePath, message: "assets/license.md is required so the asset license is present." });
  }

  for (const font of template.meta.license.fonts) {
    const normalizedFont = normalizeAssetName(font);
    if (!fontAssetNames.some((asset) => asset.includes(normalizedFont))) {
      issues.push({ path: relativeTemplatePath, message: `Licensed font ${font} is missing from assets.` });
    }
  }

  const key = `${template.meta.id}@${template.meta.version}`;
  const hash = createHash("sha256").update(raw, "utf8").digest("hex");
  const publishedHash = options.publishedHashes?.[key];
  if (publishedHash && publishedHash !== hash) {
    issues.push({ path: relativeTemplatePath, message: `Published ${key} changed without a version bump.` });
  }
  if (options.requirePublishedHashes && !publishedHash) {
    issues.push({ path: relativeTemplatePath, message: `Published hash for ${key} is missing; run templates:validate -- --record after publishing a new version.` });
  }

  templates.push({ template, templatePath, raw, hash, key });
  return { entries: 1, templates, issues };
}

export async function validateTemplates(templateRoot: string, options: TemplateValidationOptions = {}): Promise<TemplateValidationReport> {
  const issues: TemplateValidationIssue[] = [];
  const templates: ValidatedTemplate[] = [];
  let entries: TemplateDirectoryEntry[];

  try {
    entries = await readdir(templateRoot, { withFileTypes: true }) as unknown as TemplateDirectoryEntry[];
  } catch (error) {
    return { entries: 0, templates, issues: [{ path: templateRoot, message: error instanceof Error ? error.message : String(error) }] };
  }

  const directories = entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of directories) {
    const report = await validateTemplateDirectory(join(templateRoot, entry.name), options);
    templates.push(...report.templates);
    issues.push(...report.issues);
  }

  return { entries: directories.length, templates, issues };
}
