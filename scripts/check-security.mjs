import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve("src");
const forbidden = ["SUPABASE_SERVICE_ROLE_KEY", "PAYSTACK_SECRET_KEY", "LLM_API_KEY", "BG_REMOVAL_API_KEY"];
const failures = [];
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await visit(file);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && (relative(root, file).startsWith("components") || relative(root, file).startsWith("app"))) {
      const source = await readFile(file, "utf8");
      for (const secret of forbidden) if (source.includes(secret)) failures.push(`${relative(process.cwd(), file)} references ${secret}`);
    }
  }
}
await visit(root);
if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
else console.log("Security bundle check passed: server-only secrets are absent from app and component source.");
