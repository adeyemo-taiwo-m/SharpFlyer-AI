import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { CoreRepository, createCoreDataStoreState } from "@/server/db/client";
import type { FlyerContent } from "@/schemas/flyer";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

const sampleContent: FlyerContent = {
  headline: "5kVA solar package",
  body: "Includes installation",
  price: 85000000,
  currency: "NGN",
  phone: "+2348031234567",
  businessName: "BrightPower Solutions",
  productImageAssetIds: [],
  themeId: "navy-gold",
  format: "ig_post",
};

describe("Step 3.1: Core schema migration and RLS enforcement", () => {
  let state = createCoreDataStoreState();

  beforeEach(() => {
    state = createCoreDataStoreState();
  });

  it("enables RLS and defines explicit policies for every user-owned table in the SQL migration", async () => {
    const sqlPath = join(process.cwd(), "supabase", "migrations", "20261116000001_core_schema.sql");
    const sql = await readFile(sqlPath, "utf8");

    const tables = ["profiles", "templates", "assets", "brand_profiles", "flyers", "flyer_versions"];
    for (const table of tables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    }

    // Never allow USING (true) on user data
    expect(sql.toLowerCase()).not.toContain("using (true)");
  });

  it("denies cross-user reads and writes on profiles and prevents privilege escalation", () => {
    const userARepo = new CoreRepository({ role: "authenticated", userId: USER_A }, state);
    const userBRepo = new CoreRepository({ role: "authenticated", userId: USER_B }, state);

    // User A creates own profile and attempts to set is_admin = true
    const created = userARepo.insertProfile({
      id: USER_A,
      business_name_default: "Sun Co",
      is_admin: true,
      starter_credits_granted: true,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.is_admin).toBe(false);
      expect(created.value.starter_credits_granted).toBe(false);
    }

    // User B cannot read or update User A's profile
    expect(userBRepo.getProfile(USER_A).ok).toBe(false);
    expect(userBRepo.updateProfile(USER_A, { business_name_default: "Hijacked" }).ok).toBe(false);
    // User B cannot insert a profile for User A
    expect(userBRepo.insertProfile({ id: USER_A }).ok).toBe(false);
  });

  it("denies cross-user reads and writes on brand_profiles, assets, flyers, and flyer_versions", () => {
    const serviceRepo = new CoreRepository({ role: "service_role" }, state);
    const userARepo = new CoreRepository({ role: "authenticated", userId: USER_A }, state);
    const userBRepo = new CoreRepository({ role: "authenticated", userId: USER_B }, state);

    // Brand profile isolation
    const brandA = userARepo.upsertBrandProfile({
      user_id: USER_A,
      business_name: "BrightPower Solutions",
      phone_e164: "+2348031234567",
      address: "Lagos",
      logo_asset_id: null,
      primary_color: "#0B1F3A",
      secondary_color: "#FFB800",
    });
    expect(brandA.ok).toBe(true);
    expect(userBRepo.getBrandProfile(USER_A).ok).toBe(false);
    expect(
      userBRepo.upsertBrandProfile({
        user_id: USER_A,
        business_name: "Other",
        phone_e164: "+2348031234567",
        address: null,
        logo_asset_id: null,
        primary_color: null,
        secondary_color: null,
      }).ok,
    ).toBe(false);

    // Asset isolation
    const assetA = userARepo.insertAsset({
      user_id: USER_A,
      kind: "logo",
      bucket: "uploads",
      bucket_path: `${USER_A}/logo.png`,
      hash: "sha256-abc",
      width: 200,
      height: 80,
      mime_type: "image/png",
      size_bytes: 12000,
    });
    expect(assetA.ok).toBe(true);
    if (!assetA.ok) return;

    expect(userBRepo.getAsset(assetA.value.id).ok).toBe(false);
    expect(userBRepo.deleteAsset(assetA.value.id).ok).toBe(false);

    // Flyer isolation
    const flyerA = userARepo.insertFlyer({
      user_id: USER_A,
      title: "Weekend solar promo",
      template_id: "solar-bold-001",
      template_version: 1,
      format: "ig_post",
      theme_id: "navy-gold",
      content: sampleContent,
      status: "draft",
      preview_asset_id: null,
    });
    expect(flyerA.ok).toBe(true);
    if (!flyerA.ok) return;

    expect(userBRepo.getFlyer(flyerA.value.id).ok).toBe(false);
    expect(userBRepo.updateFlyer(flyerA.value.id, { title: "Tampered" }).ok).toBe(false);
    expect(userBRepo.deleteFlyer(flyerA.value.id).ok).toBe(false);

    // Flyer versions are insert-only via service_role and immutable
    expect(
      userARepo.insertFlyerVersion({
        flyer_id: flyerA.value.id,
        user_id: USER_A,
        version_number: 1,
        template_id: "solar-bold-001",
        template_version: 1,
        format: "ig_post",
        theme_id: "navy-gold",
        content_snapshot: sampleContent,
        export_asset_id: assetA.value.id,
      }).ok,
    ).toBe(false);

    const versionA = serviceRepo.insertFlyerVersion({
      flyer_id: flyerA.value.id,
      user_id: USER_A,
      version_number: 1,
      template_id: "solar-bold-001",
      template_version: 1,
      format: "ig_post",
      theme_id: "navy-gold",
      content_snapshot: sampleContent,
      export_asset_id: assetA.value.id,
    });
    expect(versionA.ok).toBe(true);
    if (!versionA.ok) return;

    expect(userARepo.getFlyerVersion(versionA.value.id).ok).toBe(true);
    expect(userBRepo.getFlyerVersion(versionA.value.id).ok).toBe(false);
    expect(serviceRepo.updateFlyerVersion().ok).toBe(false);
  });
});
