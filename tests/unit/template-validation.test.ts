import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { TemplateSchema } from "../../src/schemas/template";
import { validateTemplateDefinition } from "../../src/server/templates/validate";

async function sourceTemplate(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(resolve(process.cwd(), "templates/solar-bold-001/template.json"), "utf8")) as Record<string, unknown>;
}

describe("template validation", () => {
  it("rejects an unknown field type at the schema boundary", async () => {
    const template = await sourceTemplate();
    const fields = template.fields as Array<Record<string, unknown>>;
    fields[0].type = "video";

    expect(TemplateSchema.safeParse(template).success).toBe(false);
  });

  it("rejects a missing field region in every declared format", async () => {
    const template = TemplateSchema.parse(await sourceTemplate());
    delete template.regions.status.phone;

    expect(validateTemplateDefinition(template).some((issue) => issue.message.includes("phone has no region in status"))).toBe(true);
  });

  it("rejects missing license metadata at the schema boundary", async () => {
    const template = await sourceTemplate();
    delete (template.meta as Record<string, unknown>).license;

    expect(TemplateSchema.safeParse(template).success).toBe(false);
  });
});
