import { err, ok, type Result } from "@/types/result";
import { createAppError, type AppError } from "@/lib/errors";

const DEFAULT_MINOR_UNITS = 2;
const MINOR_UNIT_OVERRIDES: Record<string, number> = { BHD: 3, JPY: 0, KMF: 0, KRW: 0, KWD: 3, VND: 0 };

function currencyMinorUnits(currency: string): number {
  const normalized = currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new RangeError("Currency must be a three-letter ISO code.");
  return MINOR_UNIT_OVERRIDES[normalized] ?? DEFAULT_MINOR_UNITS;
}

function parseMajorValue(value: string | number, minorUnits: number): bigint {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new RangeError("Money input must be a safe integer when supplied as a number.");
  }

  const input = String(value).trim().replace(/[\s,]/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(input)) throw new RangeError("Money input must be a non-negative number.");

  const [whole, fraction = ""] = input.split(".");
  if (fraction.length > minorUnits) throw new RangeError("Money input has too many decimal places.");

  const scale = BigInt(10) ** BigInt(minorUnits);
  const fractionUnits = fraction.padEnd(minorUnits, "0") || "0";
  return BigInt(whole) * scale + BigInt(fractionUnits);
}

function asSafeNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new RangeError("Money value is outside the safe integer range.");
  return number;
}

export function toMinorUnits(value: string | number, currency = "NGN"): number {
  return asSafeNumber(parseMajorValue(value, currencyMinorUnits(currency)));
}

export function toKobo(naira: string | number): number {
  return toMinorUnits(naira, "NGN");
}

export function formatMoney(minorUnits: number, currency = "NGN", locale?: string): string {
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) throw new RangeError("Money must be a non-negative safe integer in minor units.");

  const normalizedCurrency = currency.toUpperCase();
  const digits = currencyMinorUnits(normalizedCurrency);
  const scale = BigInt(10) ** BigInt(digits);
  const amount = BigInt(minorUnits);
  const major = amount / scale;
  const remainder = amount % scale;
  const resolvedLocale = locale ?? (normalizedCurrency === "NGN" ? "en-NG" : "en-US");
  const formatter = new Intl.NumberFormat(resolvedLocale, { style: "currency", currency: normalizedCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const parts = formatter.formatToParts(major);
  const fraction = remainder.toString().padStart(digits, "0");
  const showFraction = digits > 0 && (remainder !== BigInt(0) || normalizedCurrency !== "NGN");
  let insertedFraction = false;
  let numericStarted = false;
  const output: string[] = [];

  for (const part of parts) {
    if (part.type === "integer" || part.type === "group") numericStarted = true;
    if (!insertedFraction && (part.type === "currency" || part.type === "literal") && numericStarted) {
      if (showFraction) output.push(new Intl.NumberFormat(resolvedLocale).formatToParts(1.1).find((item) => item.type === "decimal")?.value ?? ".", fraction);
      insertedFraction = true;
    }
    output.push(part.value);
  }

  if (!insertedFraction && showFraction) {
    output.push(new Intl.NumberFormat(resolvedLocale).formatToParts(1.1).find((item) => item.type === "decimal")?.value ?? ".", fraction);
  }

  return output.join("");
}

export function formatNaira(kobo: number): string {
  return formatMoney(kobo, "NGN", "en-NG");
}

export const formatCurrency = formatMoney;

export function parsePriceInput(input: string, currency = "NGN"): Result<number, AppError> {
  const normalized = input.trim().replace(/[\s,]/g, "");
  if (!/^\d+$/.test(normalized)) {
    return err(createAppError("VALIDATION_FAILED", "Enter a whole-number price without decimals or a negative sign."));
  }

  try {
    return ok(toMinorUnits(normalized, currency));
  } catch {
    return err(createAppError("VALIDATION_FAILED", "That price is too large. Enter a smaller whole-number price."));
  }
}
