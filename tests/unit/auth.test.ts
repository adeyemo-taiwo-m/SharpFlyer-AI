import { beforeEach, describe, expect, it } from "vitest";

import { STARTER_FREE_CREDITS } from "@/config/pricing";
import {
  evaluateRouteProtection,
  requestEmailMagicLink,
  requireAdmin,
  requireResourceOwner,
  requireUser,
  requireVerifiedUser,
} from "@/server/auth";
import { resetAuthRateLimits } from "@/server/auth/rate-limit";
import { getBalance } from "@/server/credits";
import { CoreRepository, createCoreDataStoreState } from "@/server/db/client";

const USER_A = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "chidi@solar.ng",
  emailVerified: true,
};

const USER_B_UNVERIFIED = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "tunde@solar.ng",
  emailVerified: false,
};

describe("Step 3.3: Authentication, route protection, rate limiting, and starter credits", () => {
  let state = createCoreDataStoreState();

  beforeEach(() => {
    state = createCoreDataStoreState();
    resetAuthRateLimits();
  });

  it("denies unauthenticated access on requireUser, requireVerifiedUser, and requireAdmin", async () => {
    const u1 = await requireUser({ sessionUser: null, state });
    const u2 = await requireVerifiedUser({ sessionUser: null, state });
    const u3 = await requireAdmin({ sessionUser: null, state });

    expect(u1.ok).toBe(false);
    expect(u2.ok).toBe(false);
    expect(u3.ok).toBe(false);
    if (!u1.ok) expect(u1.error.code).toBe("UNAUTHENTICATED");
  });

  it("creates profile and grants starter free credits exactly once on first sign-in", async () => {
    const firstSignIn = await requireUser({ sessionUser: USER_A, state });
    expect(firstSignIn.ok).toBe(true);
    if (firstSignIn.ok) {
      expect(firstSignIn.value.profile.starter_credits_granted).toBe(true);
      expect(firstSignIn.value.profile.is_admin).toBe(false);
    }

    const balanceAfterFirst = await getBalance(USER_A.id, { state });
    expect(balanceAfterFirst).toEqual({ ok: true, value: STARTER_FREE_CREDITS });

    // Second sign-in does not duplicate starter credits
    const secondSignIn = await requireUser({ sessionUser: USER_A, state });
    expect(secondSignIn.ok).toBe(true);
    const balanceAfterSecond = await getBalance(USER_A.id, { state });
    expect(balanceAfterSecond).toEqual({ ok: true, value: STARTER_FREE_CREDITS });
  });

  it("blocks wrong-user resource access and non-admin access to admin routes", async () => {
    const ownerCheck = await requireResourceOwner(USER_B_UNVERIFIED.id, {
      sessionUser: USER_A,
      state,
    });
    expect(ownerCheck.ok).toBe(false);
    if (!ownerCheck.ok) expect(ownerCheck.error.code).toBe("FORBIDDEN");

    const nonAdmin = await requireAdmin({ sessionUser: USER_A, state });
    expect(nonAdmin.ok).toBe(false);
    if (!nonAdmin.ok) expect(nonAdmin.error.code).toBe("FORBIDDEN");

    // Promote USER_A via service_role only
    const serviceRepo = new CoreRepository({ role: "service_role" }, state);
    serviceRepo.updateProfile(USER_A.id, { is_admin: true });

    const adminRes = await requireAdmin({ sessionUser: USER_A, state });
    expect(adminRes.ok).toBe(true);
  });

  it("requires a verified account before export", async () => {
    const unverified = await requireVerifiedUser({ sessionUser: USER_B_UNVERIFIED, state });
    expect(unverified.ok).toBe(false);
    if (!unverified.ok) expect(unverified.error.code).toBe("FORBIDDEN");

    const verified = await requireVerifiedUser({ sessionUser: USER_A, state });
    expect(verified.ok).toBe(true);
  });

  it("protects /app/* and /admin/* routes in middleware evaluation", () => {
    expect(
      evaluateRouteProtection({ pathname: "/app/templates", isAuthenticated: false, isAdmin: false }),
    ).toEqual({
      allowed: false,
      redirectTo: "/auth?next=%2Fapp%2Ftemplates",
      status: 401,
    });

    expect(
      evaluateRouteProtection({ pathname: "/admin", isAuthenticated: true, isAdmin: false }),
    ).toEqual({
      allowed: false,
      redirectTo: "/app",
      status: 403,
    });

    expect(
      evaluateRouteProtection({ pathname: "/admin/users", isAuthenticated: true, isAdmin: true }),
    ).toEqual({
      allowed: true,
    });
  });

  it("rate-limits magic link requests and never reveals whether an account exists", async () => {
    const existingRes = await requestEmailMagicLink(
      { email: "existing@solar.ng", ip: "102.89.1.10" },
      {
        sendOtp: async () => {
          // succeeds
        },
      },
    );
    const missingRes = await requestEmailMagicLink(
      { email: "nonexistent@solar.ng", ip: "102.89.1.11" },
      {
        sendOtp: async () => {
          throw new Error("User not found");
        },
      },
    );

    expect(existingRes.ok).toBe(true);
    expect(missingRes.ok).toBe(true);
    if (existingRes.ok && missingRes.ok) {
      expect(existingRes.value.message).toBe(missingRes.value.message);
    }

    // Exceed per-identifier rate limit (5 requests in 5 minutes)
    for (let i = 0; i < 4; i += 1) {
      await requestEmailMagicLink(
        { email: "existing@solar.ng", ip: `102.89.2.${i}` },
        { sendOtp: async () => {} },
      );
    }
    const sixth = await requestEmailMagicLink(
      { email: "existing@solar.ng", ip: "102.89.2.99" },
      { sendOtp: async () => {} },
    );
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.error.code).toBe("RATE_LIMITED");
  });
});
