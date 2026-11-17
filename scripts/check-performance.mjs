import { readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve("public");
const failures = [];
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await visit(file);
    else if (/\.(png|jpe?g|webp)$/i.test(entry.name) && (await stat(file)).size > 80 * 1024) failures.push(`${relative(process.cwd(), file)} is larger than 80 KB`);
  }
}
await visit(root);
if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
else console.log("Performance asset check passed: raster public assets are within the thumbnail budget.");
