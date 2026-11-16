import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { validateTemplates } from "../src/server/templates/validate";

async function main(): Promise<void> {
  const root = resolve(process.cwd(), "templates");
  const hashesPath = join(root, ".published-hashes.json");
  const shouldRecord = process.argv.includes("--record");

  const published = JSON.parse(await readFile(hashesPath, "utf8").catch(() => "{}")) as Record<string, string>;
  const report = await validateTemplates(root, { publishedHashes: published, requirePublishedHashes: !shouldRecord });
  const current = Object.fromEntries(report.templates.map((entry) => [entry.key, entry.hash]));
  const failures = report.issues.map((issue) => `${issue.path}: ${issue.message}`);

  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
    return;
  }

  if (shouldRecord) {
    await writeFile(hashesPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    console.log(`Recorded ${Object.keys(current).length} published template hash(es).`);
  } else {
    console.log(`Validated ${report.entries} template(s).`);
  }
}

void main();
