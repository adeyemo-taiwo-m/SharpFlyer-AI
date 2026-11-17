import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { expect, it } from "vitest";

import { validateTemplates } from "../../src/server/templates/validate";

it("ships a versioned 15-template catalog with every requested format", async () => {
  const root = resolve(process.cwd(), "templates");
  const directories = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"));
  expect(directories.length).toBeGreaterThanOrEqual(15);
  const report = await validateTemplates(root);
  expect(report.issues).toEqual([]);
  for (const item of report.templates.filter((item) => item.template.meta.version > 1 || !["solar-bold-001", "solar-clean-002", "solar-dark-003"].includes(item.template.meta.id))) {
    expect(Object.keys(item.template.formats)).toEqual(expect.arrayContaining(["story", "fb_post", "a4"]));
  }
  expect(await readFile(join(root, "solar-bold-001", "v2", "template.json"), "utf8")).toContain('"version":2');
});
