import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteAccount,
  getAccountData,
  saveBrandProfile,
  saveOnboarding,
  skipOnboarding,
  updateTheme,
} from "@/server/account";
import { createDraftFromTemplate, deleteFlyer, duplicateFlyer, listUserFlyers } from "@/server/flyers";
import { getBalance } from "@/server/credits";
import { createCoreDataStoreState } from "@/server/db/client";
import { createStorageServiceState } from "@/server/storage";

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@solar.ng",
  emailVerified: true,
};

describe("Phase 6 account, brand, and flyer management", () => {
  let state = createCoreDataStoreState();
  let storageState = createStorageServiceState();

  beforeEach(() => {
    state = createCoreDataStoreState();
    storageState = createStorageServiceState();
  });

  it("saves validated brand details and prefills new drafts", async () => {
    const brand = await saveBrandProfile(
      {
        businessName: "Sun Co",
        phone: "0803 123 4567",
        address: "Ikeja, Lagos",
        primaryColor: "#F4B400",
        secondaryColor: "#102A43",
      },
      { sessionUser: USER, state, storageState },
    );
    expect(brand.ok).toBe(true);

    const draft = await createDraftFromTemplate(
      { templateId: "solar-bold-001", format: "ig_post", themeId: "navy-gold" },
      { sessionUser: USER, state, storageState },
    );
    expect(draft.ok).toBe(true);
    if (draft.ok) {
      expect(draft.value.content.businessName).toBe("Sun Co");
      expect(draft.value.content.phone).toBe("+2348031234567");
      expect(draft.value.content.address).toBe("Ikeja, Lagos");
    }
  });

  it("supports three-step onboarding and account theme persistence", async () => {
    const onboarding = await saveOnboarding(
      { businessType: "solar", businessName: "Lagos Solar Hub", phone: "+2348031234567", address: "Ikeja", logoAssetId: "", primaryColor: "", secondaryColor: "" },
      { sessionUser: USER, state, storageState },
    );
    expect(onboarding.ok).toBe(true);
    if (onboarding.ok) expect(onboarding.value.profile.onboarding_state).toBe("completed");

    const theme = await updateTheme("dark", { sessionUser: USER, state });
    expect(theme.ok).toBe(true);
    if (theme.ok) expect(theme.value.theme_preference).toBe("dark");

    const account = await getAccountData({ sessionUser: USER, state });
    expect(account.ok).toBe(true);
    if (account.ok) {
      expect(account.value.profile.business_type).toBe("solar");
      expect(account.value.brand?.business_name).toBe("Lagos Solar Hub");
    }
  });

  it("can skip onboarding without creating a fake brand profile", async () => {
    const skipped = await skipOnboarding({ sessionUser: USER, state });
    expect(skipped.ok).toBe(true);
    if (skipped.ok) expect(skipped.value.onboarding_state).toBe("skipped");
    const account = await getAccountData({ sessionUser: USER, state });
    expect(account.ok).toBe(true);
    if (account.ok) expect(account.value.brand).toBeNull();
  });

  it("duplicates a flyer pinned to the original template version and deletes its copy", async () => {
    const original = await createDraftFromTemplate(
      { templateId: "solar-bold-001", format: "ig_post", themeId: "navy-gold" },
      { sessionUser: USER, state, storageState },
    );
    expect(original.ok).toBe(true);
    if (!original.ok) throw new Error(original.error.message);

    const copy = await duplicateFlyer(original.value.id, { sessionUser: USER, state, storageState });
    expect(copy.ok).toBe(true);
    if (copy.ok) {
      expect(copy.value.template_id).toBe(original.value.template_id);
      expect(copy.value.template_version).toBe(original.value.template_version);
      expect(copy.value.status).toBe("draft");
      expect(copy.value.title).toBe("Solar Power Package: Bold copy");
    }

    const listed = await listUserFlyers({ sessionUser: USER, state, storageState });
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value).toHaveLength(2);

    const removed = await deleteFlyer(original.value.id, { sessionUser: USER, state, storageState });
    expect(removed).toEqual({ ok: true, value: true });
    const remaining = await listUserFlyers({ sessionUser: USER, state, storageState });
    expect(remaining.ok).toBe(true);
    if (remaining.ok) expect(remaining.value).toHaveLength(1);
  });

  it("deletes user data without leaking the user's credits or flyers", async () => {
    await createDraftFromTemplate(
      { templateId: "solar-bold-001", format: "ig_post" },
      { sessionUser: USER, state, storageState },
    );
    const deleted = await deleteAccount({ sessionUser: USER, state, storageState });
    expect(deleted).toEqual({ ok: true, value: true });
    expect(await getBalance(USER.id, { state })).toEqual({ ok: true, value: 0 });
    const flyersAfterDelete = await listUserFlyers({ sessionUser: USER, state, storageState });
    expect(flyersAfterDelete).toEqual({ ok: true, value: [] });
  });
});
