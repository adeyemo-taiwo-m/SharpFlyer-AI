import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { fixtureContent, FIXTURE_ASSETS } from "./fixtures";
import { renderFlyer } from "./engine/render";

function argument(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const template = argument("template", "solar-bold-001")!;
const fixture = argument("fixture", "normal")!;
const format = argument("format", "ig_post") as "ig_post" | "status";
const output = argument("output", resolve(process.cwd(), "render-worker", "output", `${template}-${fixture}-${format}.png`))!;
const outputType = output.toLowerCase().endsWith(".jpg") || output.toLowerCase().endsWith(".jpeg") ? "jpg" : "png";

const result = await renderFlyer({
  jobId: `${template}-${fixture}-${format}`,
  templateId: template,
  templateVersion: 1,
  format,
  scale: 1,
  content: fixtureContent(fixture, format),
  assets: FIXTURE_ASSETS,
  themeId: fixtureContent(fixture, format).themeId,
  purpose: "preview",
}, { output: outputType });

if (!result.ok || !result.outputBuffer) {
  console.error(JSON.stringify({ warnings: result.warnings, errors: result.errors }, null, 2));
  process.exit(1);
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, result.outputBuffer);
console.log(JSON.stringify({ output, warnings: result.warnings, metrics: result.metrics }, null, 2));
