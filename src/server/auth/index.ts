import { z } from "zod";

import { STARTER_FREE_CREDITS } from "@/config/pricing";
import { readServerEnv } from "@/lib/env";
import { createAppError, type AppError } from "@/lib/errors";
import { enforceAuthRateLimit } from "@/server/auth/rate-limit";
import { grantCredits } from "@/server/credits";
import {
  CoreRepository,
  getDefaultCoreDataStoreState,
  type CoreDataStoreState,
} from "@/server/db/client";
import type { ProfileRow } from "@/types/database";
import { err, ok, type Result } from "@/types/result";

export type SessionUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
};

export type AuthenticatedContext = {
  user: SessionUser;
  profile: ProfileRow;
};

export type AuthProviderOptions = {
  sessionUser?: SessionUser | null;
  state?: CoreDataStoreState;
};

const emailLoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  ip: z.string().trim().min(1),
});

function ensureNonBrowser(): void {
  if (typeof window !== "undefined") {
    throw new Error("Server auth helpers cannot be imported or called in browser code.");
  }
}

/**
 * Ensures the signed-in user has a `profiles` row and receives their one-time starter credit grant
 * (`STARTER_FREE_CREDITS`, Decision D8) idempotently through `grantCredits`.
 */
export async function ensureUserBootstrapped(
  user: SessionUser,
  state: CoreDataStoreState = getDefaultCoreDataStoreState(),
): Promise<Result<ProfileRow, AppError>> {
  ensureNonBrowser();
  const serviceRepo = new CoreRepository({ role: "service_role" }, state);

  let profileRes = serviceRepo.getProfile(user.id);
  if (!profileRes.ok) {
    profileRes = serviceRepo.insertProfile({
      id: user.id,
      onboarding_state: "not_started",
      theme_preference: "system",
      is_admin: false,
      starter_credits_granted: false,
    });
    if (!profileRes.ok) return profileRes;
  }

  let profile = profileRes.value;
  if (!profile.starter_credits_granted) {
    const grantRes = await grantCredits(
      user.id,
      STARTER_FREE_CREDITS,
      "grant",
      `starter-grant:${user.id}`,
      { state, actor: { role: "service_role" } },
    );
    if (!grantRes.ok) return grantRes;

    const updatedRes = serviceRepo.updateProfile(user.id, {
      starter_credits_granted: true,
    });
    if (!updatedRes.ok) return updatedRes;
    profile = updatedRes.value;
  }

  return ok(profile);
}

/**
 * Requires an authenticated user session, bootstraps their profile and one-time starter credits on first sign-in,
 * and returns the verified user + profile context.
 */
export async function requireUser(
  options: AuthProviderOptions = {},
): Promise<Result<AuthenticatedContext, AppError>> {
  ensureNonBrowser();
  const user = options.sessionUser ?? null;
  if (!user || !user.id.trim()) {
    return err(createAppError("UNAUTHENTICATED"));
  }

  const state = options.state ?? getDefaultCoreDataStoreState();
  const profileRes = await ensureUserBootstrapped(user, state);
  if (!profileRes.ok) return profileRes;

  return ok({
    user,
    profile: profileRes.value,
  });
}

/**
 * Enforces that a user is authenticated AND has a verified account (required before flyer export per PRD 7.7).
 */
export async function requireVerifiedUser(
  options: AuthProviderOptions = {},
): Promise<Result<AuthenticatedContext, AppError>> {
  const authRes = await requireUser(options);
  if (!authRes.ok) return authRes;

  if (!authRes.value.user.emailVerified) {
    return err(
      createAppError("FORBIDDEN", "Verify your email address before exporting a flyer."),
    );
  }

  return authRes;
}

/**
 * Enforces that a user is authenticated AND has the server-side `is_admin` flag on their profile.
 * Never trusts client claims for admin authorization.
 */
export async function requireAdmin(
  options: AuthProviderOptions = {},
): Promise<Result<AuthenticatedContext, AppError>> {
  const authRes = await requireUser(options);
  if (!authRes.ok) return authRes;

  if (!authRes.value.profile.is_admin) {
    return err(createAppError("FORBIDDEN"));
  }

  return authRes;
}

/**
 * Enforces ownership of a resource on top of authentication.
 */
export async function requireResourceOwner(
  resourceUserId: string,
  options: AuthProviderOptions = {},
): Promise<Result<AuthenticatedContext, AppError>> {
  const authRes = await requireUser(options);
  if (!authRes.ok) return authRes;

  if (authRes.value.user.id !== resourceUserId) {
    return err(createAppError("FORBIDDEN"));
  }

  return authRes;
}

export type MagicLinkResponse = {
  sent: true;
  message: string;
};

const UNIFORM_MAGIC_LINK_MESSAGE =
  "If that email address can receive mail, we sent a sign-in link. Check your inbox.";

/**
 * Requests a Supabase Auth magic link (Decision D4).
 * - Rate-limited per email and per IP.
 * - Always returns a uniform response so login/recovery flows never reveal whether an account exists.
 */
export async function requestEmailMagicLink(
  rawInput: unknown,
  options?: { sendOtp?: (email: string) => Promise<void>; nowMs?: number },
): Promise<Result<MagicLinkResponse, AppError>> {
  ensureNonBrowser();
  const parsed = emailLoginSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      createAppError("VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Enter a valid email address."),
    );
  }

  const rateCheck = enforceAuthRateLimit({
    identifier: parsed.data.email,
    ip: parsed.data.ip,
    nowMs: options?.nowMs,
  });
  if (!rateCheck.ok) return rateCheck;

  try {
    if (options?.sendOtp) {
      await options.sendOtp(parsed.data.email);
    } else if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const env = readServerEnv();
      await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: parsed.data.email,
          create_user: true,
          email_redirect_to: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        }),
      });
    }
  } catch {
    // Swallow provider existence/lookup errors so response never reveals account existence
  }

  return ok({
    sent: true,
    message: UNIFORM_MAGIC_LINK_MESSAGE,
  });
}

/**
 * Builds the Google OAuth sign-in URL via Supabase Auth (Decision D4).
 */
export function getGoogleSignInUrl(redirectPath = "/app"): Result<string, AppError> {
  ensureNonBrowser();
  const env = readServerEnv();
  const safePath = redirectPath.startsWith("/") && !redirectPath.startsWith("//") ? redirectPath : "/app";
  const callbackUrl = new URL("/auth/callback", env.NEXT_PUBLIC_APP_URL);
  callbackUrl.searchParams.set("next", safePath);

  const authUrl = new URL("/auth/v1/authorize", env.NEXT_PUBLIC_SUPABASE_URL);
  authUrl.searchParams.set("provider", "google");
  authUrl.searchParams.set("redirect_to", callbackUrl.toString());

  return ok(authUrl.toString());
}

/**
 * Evaluates route access for `/app/*` and `/admin/*` paths (used by middleware and route tests).
 */
export function evaluateRouteProtection(input: {
  pathname: string;
  isAuthenticated: boolean;
  isAdmin: boolean;
}): { allowed: boolean; redirectTo?: string; status?: 401 | 403 } {
  const { pathname, isAuthenticated, isAdmin } = input;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!isAuthenticated) {
      return { allowed: false, redirectTo: `/auth?next=${encodeURIComponent(pathname)}`, status: 401 };
    }
    if (!isAdmin) {
      return { allowed: false, redirectTo: "/app", status: 403 };
    }
    return { allowed: true };
  }

  if (pathname === "/app" || pathname.startsWith("/app/")) {
    if (!isAuthenticated) {
      return { allowed: false, redirectTo: `/auth?next=${encodeURIComponent(pathname)}`, status: 401 };
    }
    return { allowed: true };
  }

  return { allowed: true };
}
