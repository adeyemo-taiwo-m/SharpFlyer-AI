import { randomUUID } from "node:crypto";

import { readServerEnv } from "@/lib/env";
import { createAppError, type AppError } from "@/lib/errors";
import { err, ok, type Result } from "@/types/result";
import type {
  AssetRow,
  BrandProfileRow,
  CreditLedgerRow,
  FlyerRow,
  FlyerVersionRow,
  ProfileRow,
  TemplateRow,
} from "@/types/database";

export type DbActor =
  | { role: "anon" }
  | { role: "authenticated"; userId: string }
  | { role: "service_role" };

export type CoreDataStoreState = {
  profiles: Map<string, ProfileRow>;
  brandProfiles: Map<string, BrandProfileRow>;
  templates: Map<string, TemplateRow>;
  assets: Map<string, AssetRow>;
  flyers: Map<string, FlyerRow>;
  flyerVersions: Map<string, FlyerVersionRow>;
  creditLedger: CreditLedgerRow[];
  userLocks: Map<string, Promise<void>>;
};

export function createCoreDataStoreState(): CoreDataStoreState {
  return {
    profiles: new Map(),
    brandProfiles: new Map(),
    templates: new Map(),
    assets: new Map(),
    flyers: new Map(),
    flyerVersions: new Map(),
    creditLedger: [],
    userLocks: new Map(),
  };
}

const GLOBAL_CORE_STORE_KEY = "__sharpflyer_core_store_state__";
const globalForCoreStore = globalThis as unknown as {
  [GLOBAL_CORE_STORE_KEY]?: CoreDataStoreState;
};

let defaultStoreState: CoreDataStoreState =
  globalForCoreStore[GLOBAL_CORE_STORE_KEY] ?? createCoreDataStoreState();
globalForCoreStore[GLOBAL_CORE_STORE_KEY] = defaultStoreState;

export function getDefaultCoreDataStoreState(): CoreDataStoreState {
  return defaultStoreState;
}

export function resetDefaultCoreDataStoreState(): void {
  defaultStoreState = createCoreDataStoreState();
  globalForCoreStore[GLOBAL_CORE_STORE_KEY] = defaultStoreState;
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureNonBrowser(): void {
  if (typeof window !== "undefined") {
    throw new Error("Database client cannot be used in browser code.");
  }
}

function forbidCrossUser(actor: DbActor, targetUserId: string): Result<true, AppError> {
  if (actor.role === "service_role") return ok(true);
  if (actor.role === "authenticated" && actor.userId === targetUserId) return ok(true);
  return err(createAppError("FORBIDDEN", "You do not have permission to access this item."));
}

/**
 * RLS-enforcing repository for core tables (`profiles`, `brand_profiles`, `templates`, `assets`, `flyers`, `flyer_versions`).
 * Mirrors the exact PostgreSQL constraints and RLS policies in `20261116000001_core_schema.sql`.
 */
export class CoreRepository {
  private readonly state: CoreDataStoreState;
  private readonly actor: DbActor;

  constructor(actor: DbActor, state: CoreDataStoreState = defaultStoreState) {
    ensureNonBrowser();
    this.actor = actor;
    this.state = state;
  }

  // --- profiles ---
  getProfile(userId: string): Result<ProfileRow, AppError> {
    const allowed = forbidCrossUser(this.actor, userId);
    if (!allowed.ok) return allowed;

    const row = this.state.profiles.get(userId);
    if (!row) return err(createAppError("NOT_FOUND", "We could not find that item."));
    return ok({ ...row });
  }

  insertProfile(
    input: Pick<ProfileRow, "id"> &
      Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">>,
  ): Result<ProfileRow, AppError> {
    const allowed = forbidCrossUser(this.actor, input.id);
    if (!allowed.ok) return allowed;

    if (this.state.profiles.has(input.id)) {
      return err(createAppError("VALIDATION_FAILED", "Profile already exists."));
    }

    const isService = this.actor.role === "service_role";
    const timestamp = nowIso();
    const row: ProfileRow = {
      id: input.id,
      business_name_default: input.business_name_default ?? null,
      business_type: input.business_type ?? null,
      onboarding_state: input.onboarding_state ?? "not_started",
      theme_preference: input.theme_preference ?? "system",
      // Trigger protect_profile_privileged_columns enforces false for non-service-role
      is_admin: isService ? Boolean(input.is_admin) : false,
      starter_credits_granted: isService ? Boolean(input.starter_credits_granted) : false,
      created_at: timestamp,
      updated_at: timestamp,
    };

    this.state.profiles.set(row.id, row);
    return ok({ ...row });
  }

  updateProfile(
    userId: string,
    patch: Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">>,
  ): Result<ProfileRow, AppError> {
    const allowed = forbidCrossUser(this.actor, userId);
    if (!allowed.ok) return allowed;

    const existing = this.state.profiles.get(userId);
    if (!existing) return err(createAppError("NOT_FOUND", "We could not find that item."));

    const isService = this.actor.role === "service_role";
    const updated: ProfileRow = {
      ...existing,
      business_name_default:
        patch.business_name_default !== undefined
          ? patch.business_name_default
          : existing.business_name_default,
      business_type: patch.business_type !== undefined ? patch.business_type : existing.business_type,
      onboarding_state: patch.onboarding_state ?? existing.onboarding_state,
      theme_preference: patch.theme_preference ?? existing.theme_preference,
      is_admin: isService && patch.is_admin !== undefined ? patch.is_admin : existing.is_admin,
      starter_credits_granted:
        isService && patch.starter_credits_granted !== undefined
          ? patch.starter_credits_granted
          : existing.starter_credits_granted,
      updated_at: nowIso(),
    };

    this.state.profiles.set(userId, updated);
    return ok({ ...updated });
  }

  // --- templates ---
  listTemplates(options?: { category?: string; includeUnpublished?: boolean }): Result<TemplateRow[], AppError> {
    const canSeeAll = this.actor.role === "service_role" && options?.includeUnpublished;
    const rows = Array.from(this.state.templates.values()).filter((row) => {
      if (!canSeeAll && row.status !== "published") return false;
      if (options?.category && row.category !== options.category) return false;
      return true;
    });
    return ok(rows.map((r) => ({ ...r })));
  }

  upsertTemplate(
    input: Omit<TemplateRow, "created_at" | "updated_at">,
  ): Result<TemplateRow, AppError> {
    if (this.actor.role !== "service_role") {
      return err(createAppError("FORBIDDEN", "Only the server can modify templates."));
    }
    const key = `${input.id}@${input.version}`;
    const existing = this.state.templates.get(key);
    if (existing && existing.status === "published" && existing.definition_hash !== input.definition_hash) {
      return err(
        createAppError("VALIDATION_FAILED", `Published template ${key} is immutable and cannot be changed in place.`),
      );
    }
    const timestamp = nowIso();
    const row: TemplateRow = {
      ...input,
      created_at: existing?.created_at ?? timestamp,
      updated_at: timestamp,
    };
    this.state.templates.set(key, row);
    return ok({ ...row });
  }

  // --- assets ---
  insertAsset(
    input: Omit<AssetRow, "id" | "created_at" | "deleted_at"> & { id?: string },
  ): Result<AssetRow, AppError> {
    const allowed = forbidCrossUser(this.actor, input.user_id);
    if (!allowed.ok) return allowed;

    const row: AssetRow = {
      ...input,
      id: input.id ?? randomUUID(),
      deleted_at: null,
      created_at: nowIso(),
    };
    this.state.assets.set(row.id, row);
    return ok({ ...row });
  }

  getAsset(assetId: string): Result<AssetRow, AppError> {
    const row = this.state.assets.get(assetId);
    if (!row) return err(createAppError("NOT_FOUND", "We could not find that item."));
    const allowed = forbidCrossUser(this.actor, row.user_id);
    if (!allowed.ok) return allowed;
    return ok({ ...row });
  }

  deleteAsset(assetId: string): Result<AssetRow, AppError> {
    const row = this.state.assets.get(assetId);
    if (!row) return err(createAppError("NOT_FOUND", "We could not find that item."));
    const allowed = forbidCrossUser(this.actor, row.user_id);
    if (!allowed.ok) return allowed;
    this.state.assets.delete(assetId);
    return ok({ ...row });
  }

  // --- brand_profiles ---
  upsertBrandProfile(
    input: Omit<BrandProfileRow, "id" | "created_at" | "updated_at">,
  ): Result<BrandProfileRow, AppError> {
    const allowed = forbidCrossUser(this.actor, input.user_id);
    if (!allowed.ok) return allowed;

    if (!/^\+[1-9][0-9]{6,14}$/.test(input.phone_e164)) {
      return err(createAppError("VALIDATION_FAILED", "Phone number must be stored in E.164 format."));
    }

    const existing = this.state.brandProfiles.get(input.user_id);
    const timestamp = nowIso();
    const row: BrandProfileRow = {
      ...input,
      id: existing?.id ?? randomUUID(),
      created_at: existing?.created_at ?? timestamp,
      updated_at: timestamp,
    };
    this.state.brandProfiles.set(input.user_id, row);
    return ok({ ...row });
  }

  getBrandProfile(userId: string): Result<BrandProfileRow, AppError> {
    const allowed = forbidCrossUser(this.actor, userId);
    if (!allowed.ok) return allowed;
    const row = this.state.brandProfiles.get(userId);
    if (!row) return err(createAppError("NOT_FOUND", "We could not find that item."));
    return ok({ ...row });
  }

  // --- flyers ---
  insertFlyer(
    input: Omit<FlyerRow, "id" | "created_at" | "updated_at" | "deleted_at"> & { id?: string },
  ): Result<FlyerRow, AppError> {
    const allowed = forbidCrossUser(this.actor, input.user_id);
    if (!allowed.ok) return allowed;

    const timestamp = nowIso();
    const row: FlyerRow = {
      ...input,
      id: input.id ?? randomUUID(),
      deleted_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    this.state.flyers.set(row.id, row);
    return ok({ ...row });
  }

  getFlyer(flyerId: string): Result<FlyerRow, AppError> {
    const row = this.state.flyers.get(flyerId);
    if (!row) return err(createAppError("NOT_FOUND", "We could not find that item."));
    const allowed = forbidCrossUser(this.actor, row.user_id);
    if (!allowed.ok) return allowed;
    return ok({ ...row });
  }

  updateFlyer(
    flyerId: string,
    patch: Partial<Pick<FlyerRow, "title" | "format" | "theme_id" | "content" | "status" | "preview_asset_id" | "deleted_at">>,
  ): Result<FlyerRow, AppError> {
    const existing = this.state.flyers.get(flyerId);
    if (!existing) return err(createAppError("NOT_FOUND", "We could not find that item."));
    const allowed = forbidCrossUser(this.actor, existing.user_id);
    if (!allowed.ok) return allowed;

    const updated: FlyerRow = {
      ...existing,
      ...patch,
      // template_id and template_version are pinned and never mutated on update
      template_id: existing.template_id,
      template_version: existing.template_version,
      updated_at: nowIso(),
    };
    this.state.flyers.set(flyerId, updated);
    return ok({ ...updated });
  }

  deleteFlyer(flyerId: string): Result<FlyerRow, AppError> {
    const existing = this.state.flyers.get(flyerId);
    if (!existing) return err(createAppError("NOT_FOUND", "We could not find that item."));
    const allowed = forbidCrossUser(this.actor, existing.user_id);
    if (!allowed.ok) return allowed;
    this.state.flyers.delete(flyerId);
    return ok({ ...existing });
  }

  // --- flyer_versions (immutable snapshots; server-only insert, user select own) ---
  insertFlyerVersion(
    input: Omit<FlyerVersionRow, "id" | "created_at"> & { id?: string },
  ): Result<FlyerVersionRow, AppError> {
    if (this.actor.role !== "service_role") {
      return err(
        createAppError("FORBIDDEN", "Flyer versions can only be created by server export functions."),
      );
    }
    const row: FlyerVersionRow = {
      ...input,
      id: input.id ?? randomUUID(),
      created_at: nowIso(),
    };
    this.state.flyerVersions.set(row.id, row);
    return ok({ ...row });
  }

  getFlyerVersion(versionId: string): Result<FlyerVersionRow, AppError> {
    const row = this.state.flyerVersions.get(versionId);
    if (!row) return err(createAppError("NOT_FOUND", "We could not find that item."));
    const allowed = forbidCrossUser(this.actor, row.user_id);
    if (!allowed.ok) return allowed;
    return ok({ ...row });
  }

  listFlyerVersions(flyerId: string): Result<FlyerVersionRow[], AppError> {
    const flyer = this.state.flyers.get(flyerId);
    if (!flyer) return err(createAppError("NOT_FOUND", "We could not find that item."));
    const allowed = forbidCrossUser(this.actor, flyer.user_id);
    if (!allowed.ok) return allowed;

    const versions = Array.from(this.state.flyerVersions.values())
      .filter((v) => v.flyer_id === flyerId)
      .sort((a, b) => a.version_number - b.version_number)
      .map((v) => ({ ...v }));
    return ok(versions);
  }

  attachFlyerVersionExportAsset(
    versionId: string,
    exportAssetId: string,
  ): Result<FlyerVersionRow, AppError> {
    if (this.actor.role !== "service_role") {
      return err(
        createAppError("FORBIDDEN", "Only server export functions can attach export assets."),
      );
    }
    const existing = this.state.flyerVersions.get(versionId);
    if (!existing) return err(createAppError("NOT_FOUND", "We could not find that item."));
    const updated: FlyerVersionRow = {
      ...existing,
      export_asset_id: exportAssetId,
    };
    this.state.flyerVersions.set(versionId, updated);
    return ok({ ...updated });
  }

  updateFlyerVersion(): Result<never, AppError> {
    return err(
      createAppError("FORBIDDEN", "flyer_versions rows are immutable snapshots and cannot be updated."),
    );
  }
}

/**
 * Server-side Supabase REST/RPC helper using standard `fetch`.
 * Uses the user's JWT when provided, or the service-role key exclusively on the server.
 */
export async function callSupabaseRpc<T>(
  fnName: string,
  args: Record<string, unknown>,
  options?: { useServiceRole?: boolean; accessToken?: string },
): Promise<Result<T, AppError>> {
  ensureNonBrowser();
  const env = readServerEnv();
  const apiKey = options?.useServiceRole ? env.SUPABASE_SERVICE_ROLE_KEY : env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const bearer = options?.useServiceRole
    ? env.SUPABASE_SERVICE_ROLE_KEY
    : (options?.accessToken ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  try {
    const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      if (errorBody.includes("insufficient_credits")) {
        return err(createAppError("INSUFFICIENT_CREDITS"));
      }
      return err(createAppError("INTERNAL"));
    }

    const data = (await response.json()) as T;
    return ok(data);
  } catch {
    return err(createAppError("INTERNAL"));
  }
}
