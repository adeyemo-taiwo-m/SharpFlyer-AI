import { err, ok, type Result } from "@/types/result";
import { createAppError, type AppError } from "@/lib/errors";

export type PhoneWarning = "INTERNATIONAL_NUMBER";

export type NormalizedPhone = {
  e164: string;
  warnings: PhoneWarning[];
};

function invalidPhone(): Result<never, AppError> {
  return err(createAppError("VALIDATION_FAILED", "Enter a valid phone number, like 0803 123 4567."));
}

export function normalizePhone(input: string): Result<NormalizedPhone, AppError> {
  const raw = input.trim();
  if (!raw || /[^\d+\s()-]/.test(raw) || (raw.match(/\+/g) ?? []).length > 1) return invalidPhone();

  const hasPlus = raw.startsWith("+");
  let digits = raw.replace(/[\s()-]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("+")) digits = digits.slice(1);

  if (!/^\d+$/.test(digits)) return invalidPhone();

  if (digits.startsWith("0")) {
    if (!/^0[789]\d{9}$/.test(digits)) return invalidPhone();
    return ok({ e164: `+234${digits.slice(1)}`, warnings: [] });
  }

  if (digits.startsWith("234")) {
    if (!/^234[789]\d{9}$/.test(digits)) return invalidPhone();
    return ok({ e164: `+${digits}`, warnings: [] });
  }

  if ((!hasPlus && digits.startsWith("1")) || hasPlus) {
    if (!/^[1-9]\d{7,14}$/.test(digits)) return invalidPhone();
    return ok({ e164: `+${digits}`, warnings: ["INTERNATIONAL_NUMBER"] });
  }

  return invalidPhone();
}

export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) {
    const local = `0${digits.slice(3)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }

  return e164;
}
