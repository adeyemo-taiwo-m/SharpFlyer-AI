import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const templateRoot = resolve(process.cwd(), "templates");
const entries = await readdir(templateRoot, { withFileTypes: true });
const directories = entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));

const rows = [];
for (const dir of directories) {
  const filePath = join(templateRoot, dir.name, "template.json");
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const hash = createHash("sha256").update(raw, "utf8").digest("hex");

  rows.push({
    id: parsed.meta.id,
    version: parsed.meta.version,
    title: parsed.meta.title,
    category: parsed.meta.category,
    tags: parsed.meta.tags ?? [],
    style: parsed.meta.style,
    formats: Object.keys(parsed.formats ?? {}),
    status: "published",
    license: parsed.meta.license,
    definition_hash: hash,
  });
}

if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/templates?on_conflict=id,version`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(rows),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(`Failed to sync templates to Supabase: ${response.status} ${body}`);
    process.exit(1);
  }
  console.log(`Synced ${rows.length} template(s) to Supabase.`);
} else {
  console.log(`Validated and prepared ${rows.length} template(s) for sync (${rows.map((r) => `${r.id}@${r.version}`).join(", ")}).`);
}
