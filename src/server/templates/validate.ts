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
  expectedId?: string;
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
  const folderId = options.expectedId ?? basename(dirname(templatePath));
  if (template.meta.id !== folderId) {
    issues.push({ path: relativeTemplatePath, message: `meta.id ${template.meta.id} must match the template directory ${folderId}.` });
  }

  issues.push(...validateTemplateDefinition(template).map((issue) => ({ path: relativeTemplatePath, message: `${issue.path}: ${issue.message}` })));

  const assetDirectories = [join(templateDirectory, "assets")];
  if (assetDirectories[0] && !(await fileExists(assetDirectories[0]))) {
    const parentAssets = join(dirname(templateDirectory), "assets");
    if (await fileExists(parentAssets)) assetDirectories.push(parentAssets);
  }
  const assetFiles = (await Promise.all(assetDirectories.map((directory) => listFiles(directory).catch(() => [] as string[])))).flat();
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

  const directories = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith("_")).sort((a, b) => a.name.localeCompare(b.name));
  let discovered = 0;
  for (const entry of directories) {
    const templateId = entry.name;
    const templateDirectories = await findTemplateDirectories(join(templateRoot, entry.name));
    for (const directory of templateDirectories) {
      const report = await validateTemplateDirectory(directory, { ...options, expectedId: templateId });
      templates.push(...report.templates);
      issues.push(...report.issues);
      discovered += report.entries;
    }
  }

  return { entries: discovered, templates, issues };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function findTemplateDirectories(root: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(directory: string): Promise<void> {
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      if (entries.some((entry) => entry.isFile() && entry.name === "template.json")) result.push(directory);
      for (const entry of entries) {
        if (entry.isDirectory() && (directory === root || /^v\d+$/.test(entry.name) || /^\d+$/.test(entry.name))) {
          await visit(join(directory, entry.name));
        }
      }
    } catch {
      // The directory is reported by the caller if its template is missing.
    }
  }
  await visit(root);
  return result.sort((a, b) => a.localeCompare(b));
}
