import { createAppError, type AppError } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import { BrandProfileInputSchema, OnboardingInputSchema, type BrandProfileInput, type OnboardingInput } from "@/schemas/account";
import { requireUser, type SessionUser } from "@/server/auth";
import {
  CoreRepository,
  getDefaultCoreDataStoreState,
  type CoreDataStoreState,
} from "@/server/db/client";
import { getDefaultStorageServiceState, type StorageServiceState } from "@/server/storage";
import type { BrandProfileRow, ProfileRow } from "@/types/database";
import { err, ok, type Result } from "@/types/result";

export type AccountServiceOptions = {
  sessionUser?: SessionUser | null;
  state?: CoreDataStoreState;
  storageState?: StorageServiceState;
};

function normalizeBrandInput(input: BrandProfileInput | OnboardingInput): Result<{
  businessName: string;
  phoneE164: string;
  address: string | null;
  logoAssetId: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}, AppError> {
  const parsed = ("businessType" in input ? OnboardingInputSchema : BrandProfileInputSchema).safeParse(input);
  if (!parsed.success) return err(createAppError("VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Check your details and try again."));
  const phone = normalizePhone(parsed.data.phone);
  if (!phone.ok) return phone;
  return ok({
    businessName: parsed.data.businessName,
    phoneE164: phone.value.e164,
    address: parsed.data.address?.trim() || null,
    logoAssetId: parsed.data.logoAssetId?.trim() || null,
    primaryColor: parsed.data.primaryColor || null,
    secondaryColor: parsed.data.secondaryColor || null,
  });
}

export async function getAccountData(options: AccountServiceOptions = {}): Promise<Result<{ profile: ProfileRow; brand: BrandProfileRow | null }, AppError>> {
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const state = options.state ?? getDefaultCoreDataStoreState();
  const repo = new CoreRepository({ role: "authenticated", userId: authRes.value.user.id }, state);
  const brandRes = repo.getBrandProfile(authRes.value.user.id);
  return ok({ profile: authRes.value.profile, brand: brandRes.ok ? brandRes.value : null });
}

export async function saveBrandProfile(
  rawInput: unknown,
  options: AccountServiceOptions = {},
): Promise<Result<BrandProfileRow, AppError>> {
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const parsed = BrandProfileInputSchema.safeParse(rawInput);
  if (!parsed.success) return err(createAppError("VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Check your brand details and try again."));
  const normalized = normalizeBrandInput(parsed.data);
  if (!normalized.ok) return normalized;

  const state = options.state ?? getDefaultCoreDataStoreState();
  const repo = new CoreRepository({ role: "authenticated", userId: authRes.value.user.id }, state);
  if (normalized.value.logoAssetId) {
    const assetRes = repo.getAsset(normalized.value.logoAssetId);
    if (!assetRes.ok || assetRes.value.kind !== "logo") return err(createAppError("VALIDATION_FAILED", "Choose a valid uploaded logo."));
  }
  return repo.upsertBrandProfile({
    user_id: authRes.value.user.id,
    business_name: normalized.value.businessName,
    phone_e164: normalized.value.phoneE164,
    address: normalized.value.address,
    logo_asset_id: normalized.value.logoAssetId,
    primary_color: normalized.value.primaryColor,
    secondary_color: normalized.value.secondaryColor,
  });
}

export async function saveOnboarding(
  rawInput: unknown,
  options: AccountServiceOptions = {},
): Promise<Result<{ profile: ProfileRow; brand: BrandProfileRow }, AppError>> {
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const parsed = OnboardingInputSchema.safeParse(rawInput);
  if (!parsed.success) return err(createAppError("VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Complete the required details."));
  const normalized = normalizeBrandInput(parsed.data);
  if (!normalized.ok) return normalized;

  const state = options.state ?? getDefaultCoreDataStoreState();
  const repo = new CoreRepository({ role: "authenticated", userId: authRes.value.user.id }, state);
  if (normalized.value.logoAssetId) {
    const assetRes = repo.getAsset(normalized.value.logoAssetId);
    if (!assetRes.ok || assetRes.value.kind !== "logo") return err(createAppError("VALIDATION_FAILED", "Choose a valid uploaded logo."));
  }
  const brandRes = repo.upsertBrandProfile({
    user_id: authRes.value.user.id,
    business_name: normalized.value.businessName,
    phone_e164: normalized.value.phoneE164,
    address: normalized.value.address,
    logo_asset_id: normalized.value.logoAssetId,
    primary_color: normalized.value.primaryColor,
    secondary_color: normalized.value.secondaryColor,
  });
  if (!brandRes.ok) return brandRes;
  const profileRes = repo.updateProfile(authRes.value.user.id, {
    business_name_default: normalized.value.businessName,
    business_type: parsed.data.businessType,
    onboarding_state: "completed",
  });
  if (!profileRes.ok) return profileRes;
  return ok({ profile: profileRes.value, brand: brandRes.value });
}

export async function skipOnboarding(options: AccountServiceOptions = {}): Promise<Result<ProfileRow, AppError>> {
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const state = options.state ?? getDefaultCoreDataStoreState();
  const repo = new CoreRepository({ role: "authenticated", userId: authRes.value.user.id }, state);
  return repo.updateProfile(authRes.value.user.id, { onboarding_state: "skipped" });
}

export async function updateTheme(
  theme: ProfileRow["theme_preference"],
  options: AccountServiceOptions = {},
): Promise<Result<ProfileRow, AppError>> {
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  if (theme !== "light" && theme !== "dark" && theme !== "system") return err(createAppError("VALIDATION_FAILED", "Choose Light, Dark, or System."));
  const state = options.state ?? getDefaultCoreDataStoreState();
  const repo = new CoreRepository({ role: "authenticated", userId: authRes.value.user.id }, state);
  return repo.updateProfile(authRes.value.user.id, { theme_preference: theme });
}

export async function deleteAccount(options: AccountServiceOptions = {}): Promise<Result<true, AppError>> {
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const state = options.state ?? getDefaultCoreDataStoreState();
  const storageState = options.storageState ?? getDefaultStorageServiceState();
  const userId = authRes.value.user.id;
  for (const [assetId, asset] of state.assets.entries()) {
    if (asset.user_id === userId) {
      storageState.storedObjects.delete(asset.bucket_path);
      state.assets.delete(assetId);
    }
  }
  for (const [versionId, version] of state.flyerVersions.entries()) {
    if (version.user_id === userId) state.flyerVersions.delete(versionId);
  }
  for (const [flyerId, flyer] of state.flyers.entries()) {
    if (flyer.user_id === userId) state.flyers.delete(flyerId);
  }
  for (const [paymentId, payment] of state.payments.entries()) {
    if (payment.user_id === userId) state.payments.delete(paymentId);
  }
  for (const [subscriptionId, subscription] of state.subscriptions.entries()) {
    if (subscription.user_id === userId) state.subscriptions.delete(subscriptionId);
  }
  state.creditLedger = state.creditLedger.filter((entry) => entry.user_id !== userId);
  state.brandProfiles.delete(userId);
  state.profiles.delete(userId);
  return ok(true);
}
