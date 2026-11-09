import { readdir } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "templates");
const entries = await readdir(root, { withFileTypes: true });
const templates = entries.filter((entry) => entry.isDirectory());

console.log(
  templates.length === 0
    ? "No templates are defined yet; template validation passed."
    : `Found ${templates.length} template director${templates.length === 1 ? "y" : "ies"}; schema validation will be added with the template system.`,
);
