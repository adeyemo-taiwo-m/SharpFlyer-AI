import { describe, expect, it } from "vitest";

import { requireAdmin } from "@/server/auth";
import { track } from "@/server/analytics";
import { CoreRepository, createCoreDataStoreState } from "@/server/db/client";

const user = (id: string) => ({ id, email: `${id}@example.test`, emailVerified: true });

describe("phase 11 authorization and observability boundaries", () => {
  it("does not allow an authenticated user to read another user's analytics", async () => {
    const state = createCoreDataStoreState();
    await track("flyer_created", { format: "ig_post" }, { userId: "owner", state });
    const other = new CoreRepository({ role: "authenticated", userId: "other" }, state);
    const result = other.listAnalyticsEvents("owner");
    expect(result.ok).toBe(false);
  });

  it("requires the server-side profile admin flag", async () => {
    const state = createCoreDataStoreState();
    const nonAdmin = await requireAdmin({ sessionUser: user("regular"), state });
    expect(nonAdmin.ok).toBe(false);
    const service = new CoreRepository({ role: "service_role" }, state);
    service.updateProfile("regular", { is_admin: true });
    const admin = await requireAdmin({ sessionUser: user("regular"), state });
    expect(admin.ok).toBe(true);
  });
});
