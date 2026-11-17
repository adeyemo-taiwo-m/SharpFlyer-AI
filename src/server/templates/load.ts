import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { createAppError, type AppError } from "@/lib/errors";
import { err, ok, type Result } from "@/types/result";
import { TemplateSchema, type Template } from "@/schemas/template";

export type LoadedTemplate = {
  template: Template;
  directory: string;
  path: string;
};

export async function loadTemplate(
  templateId: string,
  templateRoot = resolve(process.cwd(), "templates"),
  requestedVersion?: number,
): Promise<Result<LoadedTemplate, AppError>> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(templateId)) {
    return err(createAppError("VALIDATION_FAILED", `Template id ${templateId} is invalid.`));
  }

  const templateDirectory = join(templateRoot, templateId);

  try {
    const candidates = requestedVersion === undefined
      ? [
          join(templateDirectory, "template.json"),
          ...await versionDirectories(templateDirectory),
        ]
      : [
          join(templateDirectory, "template.json"),
          join(templateDirectory, `v${requestedVersion}`, "template.json"),
          join(templateDirectory, "versions", String(requestedVersion), "template.json"),
        ];

    let selectedPath: string | undefined;
    let raw: string | undefined;
    let selectedParsed: Template | undefined;
    for (const candidate of candidates) {
      try {
        const candidateRaw = await readFile(candidate, "utf8");
        const candidateJson: unknown = JSON.parse(candidateRaw);
        const candidateParsed = TemplateSchema.safeParse(candidateJson);
        if (!candidateParsed.success) continue;
        if (requestedVersion !== undefined && candidateParsed.data.meta.version !== requestedVersion) continue;
        if (!selectedParsed || candidateParsed.data.meta.version > selectedParsed.meta.version) {
          selectedPath = candidate;
          raw = candidateRaw;
          selectedParsed = candidateParsed.data;
        }
      } catch {
        // Try the next version candidate.
      }
    }

    if (!selectedPath || !raw || !selectedParsed) {
      return err(createAppError("NOT_FOUND", `Template ${templateId}${requestedVersion ? ` version ${requestedVersion}` : ""} was not found.`));
    }

    const path = selectedPath;
    const directory = dirname(path);
    const parsedJson: unknown = JSON.parse(raw);
    const parsed = TemplateSchema.safeParse(parsedJson);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join("; ");
      return err(createAppError("VALIDATION_FAILED", `Template ${templateId} is invalid: ${details || "check its fields"}.`));
    }

    return ok({ template: parsed.data, directory: resolve(directory), path });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return err(createAppError("NOT_FOUND", `Template ${templateId} was not found.`));
    return err(createAppError("VALIDATION_FAILED", `Template ${templateId} could not be loaded.`));
  }
}

async function versionDirectories(templateDirectory: string): Promise<string[]> {
  try {
    const entries = await readdir(templateDirectory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && (/^v\d+$/.test(entry.name) || /^\d+$/.test(entry.name)))
      .sort((a, b) => Number.parseInt(b.name.replace(/^v/, ""), 10) - Number.parseInt(a.name.replace(/^v/, ""), 10))
      .map((entry) => join(templateDirectory, entry.name, "template.json"));
  } catch {
    return [];
  }
}
