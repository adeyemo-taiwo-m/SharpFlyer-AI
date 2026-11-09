import { z } from "zod";

export const FORMAT_VALUES = ["status", "ig_post", "story", "fb_post", "a4"] as const;
export const FormatSchema = z.enum(FORMAT_VALUES);
export type FlyerFormat = z.infer<typeof FormatSchema>;

export const FORMAT_SIZES: Record<FlyerFormat, { width: number; height: number }> = {
  status: { width: 1080, height: 1920 },
  ig_post: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  fb_post: { width: 1200, height: 630 },
  a4: { width: 2480, height: 3508 },
};

export const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, "Use a three-letter currency code.");
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;
