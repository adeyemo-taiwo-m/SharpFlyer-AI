import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { createAppError, type AppError } from "@/lib/errors";
import { err, ok, type Result } from "@/types/result";
import { TemplateSchema, type Template } from "@/schemas/template";

export type LoadedTemplate = {
  template: Template;
  directory: string;
  path: string;
};

export async function loadTemplate(templateId: string, templateRoot = resolve(process.cwd(), "templates")): Promise<Result<LoadedTemplate, AppError>> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(templateId)) {
    return err(createAppError("VALIDATION_FAILED", `Template id ${templateId} is invalid.`));
  }

  const directory = join(templateRoot, templateId);
  const path = join(directory, "template.json");

  try {
    const raw = await readFile(path, "utf8");
    const parsedJson: unknown = JSON.parse(raw);
    const parsed = TemplateSchema.safeParse(parsedJson);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join("; ");
      return err(createAppError("VALIDATION_FAILED", `Template ${templateId} is invalid: ${details || "check its fields"}.`));
    }

    return ok({ template: parsed.data, directory, path });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return err(createAppError("NOT_FOUND", `Template ${templateId} was not found.`));
    return err(createAppError("VALIDATION_FAILED", `Template ${templateId} could not be loaded.`));
  }
}
