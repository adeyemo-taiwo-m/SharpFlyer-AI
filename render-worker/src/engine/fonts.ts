import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Font } from "satori";

export type TemplateFont = Font & { path: string };

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else files.push(path);
  }

  return files;
}

export async function findFontPath(templateDirectory: string, fontName: string, weight: number): Promise<string> {
  const directories = [join(templateDirectory, "assets"), join(process.cwd(), "templates", "solar-bold-001", "assets")];
  let parent = dirname(templateDirectory);
  for (let depth = 0; depth < 2; depth += 1) {
    directories.push(join(parent, "assets"));
    parent = dirname(parent);
  }
  const fileLists = await Promise.all(directories.map((directory) => listFiles(directory).catch(() => [] as string[])));
  const files = fileLists.flat();
  const name = fontName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const matching = files.filter((file) => file.toLowerCase().replace(/[^a-z0-9]/g, "").includes(name) && /\.(woff2?|ttf|otf)$/i.test(file));
  const weighted = matching.find((file) => file.includes(`-${weight}.`)) ?? matching[0];

  if (!weighted) throw new Error(`Font ${fontName} is missing from ${templateDirectory}/assets.`);
  return weighted;
}

export async function loadSatoriFonts(templateDirectory: string, fontNames: string[]): Promise<TemplateFont[]> {
  const fonts: TemplateFont[] = [];

  for (const name of fontNames) {
    for (const weight of [400, 700]) {
      const path = await findFontPath(templateDirectory, name, weight);
      fonts.push({ name, data: await readFile(path), weight: weight as 400 | 700, style: "normal", path });
    }
  }

  return fonts;
}
