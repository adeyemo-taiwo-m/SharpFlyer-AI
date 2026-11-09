type RGB = [number, number, number];

function parseColor(color: string): RGB {
  const value = color.trim();
  const hex = value.startsWith("#") ? value.slice(1) : value;
  const expanded = hex.length === 3 ? hex.split("").map((channel) => `${channel}${channel}`).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) throw new Error("Color must be a six-digit hexadecimal value.");

  return [0, 2, 4].map((index) => Number.parseInt(expanded.slice(index, index + 2), 16)) as RGB;
}

function linearChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number {
  const [red, green, blue] = parseColor(color).map(linearChannel);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}
