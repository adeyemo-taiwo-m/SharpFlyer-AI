export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}
