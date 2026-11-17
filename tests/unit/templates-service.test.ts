import { beforeEach, describe, expect, it } from "vitest";

import { CoreRepository, createCoreDataStoreState } from "@/server/db/client";
import { getTemplate, listTemplates, syncTemplates } from "@/server/templates";

describe("Step 3.5: Template sync, listing, filtering, and immutability", () => {
  let state = createCoreDataStoreState();

  beforeEach(() => {
    state = createCoreDataStoreState();
  });

  it("syncs the versioned template catalog into the database state", async () => {
    const synced = await syncTemplates({ state });
    expect(synced.ok).toBe(true);
    if (!synced.ok) return;

    expect(synced.value.length).toBeGreaterThanOrEqual(15);
    expect(new Set(synced.value.map((t) => t.id)).size).toBeGreaterThanOrEqual(15);
  });

  it("lists and filters templates by category, search query, and format", async () => {
    const all = await listTemplates({}, { state });
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    expect(all.value.length).toBeGreaterThanOrEqual(15);

    const solarOnly = await listTemplates({ category: "solar" }, { state });
    expect(solarOnly.ok).toBe(true);
    if (solarOnly.ok) expect(solarOnly.value).toHaveLength(15);

    const fashionOnly = await listTemplates({ category: "fashion" }, { state });
    expect(fashionOnly.ok).toBe(true);
    if (fashionOnly.ok) expect(fashionOnly.value).toHaveLength(0);

    const searchDark = await listTemplates({ search: "dark" }, { state });
    expect(searchDark.ok).toBe(true);
    if (searchDark.ok) {
      expect(searchDark.value).toHaveLength(1);
      expect(searchDark.value[0]?.id).toBe("solar-dark-003");
    }

    const statusFormat = await listTemplates({ format: "status" }, { state });
    expect(statusFormat.ok).toBe(true);
    if (statusFormat.ok) expect(statusFormat.value).toHaveLength(15);
  });

  it("loads a single template by ID and rejects unknown or invalid IDs", async () => {
    const valid = await getTemplate("solar-bold-001");
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.value.template.meta.id).toBe("solar-bold-001");
    }

    const missing = await getTemplate("solar-missing-999");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("NOT_FOUND");
  });

  it("rejects modifying an already-published template version in place", async () => {
    await syncTemplates({ state });
    const serviceRepo = new CoreRepository({ role: "service_role" }, state);

    const mutated = serviceRepo.upsertTemplate({
      id: "solar-bold-001",
      version: 1,
      title: "Tampered Title",
      category: "solar",
      tags: ["inverter"],
      style: "bold",
      formats: ["ig_post", "status"],
      status: "published",
      license: { author: "SharpFlyer", type: "original", fonts: ["Inter"] },
      definition_hash: "different-hash-for-published-v1",
    });

    expect(mutated.ok).toBe(false);
    if (!mutated.ok) expect(mutated.error.code).toBe("VALIDATION_FAILED");
  });
});
