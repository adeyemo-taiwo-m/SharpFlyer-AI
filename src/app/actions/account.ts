"use server";

import { deleteAccount, saveBrandProfile, saveOnboarding, skipOnboarding, updateTheme } from "@/server/account";
import type { AppError } from "@/lib/errors";
import type { BrandProfileRow, ProfileRow } from "@/types/database";
import type { Result } from "@/types/result";

export async function saveBrandProfileAction(input: unknown): Promise<Result<BrandProfileRow, AppError>> {
  return saveBrandProfile(input);
}

export async function saveOnboardingAction(input: unknown): Promise<Result<{ profile: ProfileRow; brand: BrandProfileRow }, AppError>> {
  return saveOnboarding(input);
}

export async function skipOnboardingAction(): Promise<Result<ProfileRow, AppError>> {
  return skipOnboarding();
}

export async function updateThemeAction(theme: "light" | "dark" | "system"): Promise<Result<ProfileRow, AppError>> {
  return updateTheme(theme);
}

export async function deleteAccountAction(): Promise<Result<true, AppError>> {
  return deleteAccount();
}
