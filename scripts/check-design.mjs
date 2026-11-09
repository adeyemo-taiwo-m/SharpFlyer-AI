import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const sourceRoot = join(process.cwd(), "src");
const forbidden = /\b(?:grid|grid-cols|bg-gradient|backdrop-blur|blur-)\b/;
const rawHex = /#[0-9a-fA-F]{3,8}\b/;
const failures = [];

async function visit(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }

    if (!/\.(css|ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;

    const content = await readFile(path, "utf8");
    const location = relative(process.cwd(), path);

    if (forbidden.test(content)) {
      failures.push(`${location}: contains a forbidden layout/effect token`);
    }

    if (!location.endsWith("src\\app\\globals.css") && !location.endsWith("src/app/globals.css") && rawHex.test(content)) {
      failures.push(`${location}: contains a raw hex color outside globals.css`);
    }
  }
}

await visit(sourceRoot);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Design checks passed.");
