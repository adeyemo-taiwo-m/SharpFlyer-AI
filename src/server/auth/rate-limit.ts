import { createAppError, type AppError } from "@/lib/errors";
import { err, ok, type Result } from "@/types/result";

type RateBucket = {
  count: number;
  resetAtMs: number;
};

export type AuthRateLimitConfig = {
  windowMs: number;
  maxPerIdentifier: number;
  maxPerIp: number;
};

const DEFAULT_AUTH_RATE_LIMIT: AuthRateLimitConfig = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxPerIdentifier: 5,
  maxPerIp: 15,
};

const identifierBuckets = new Map<string, RateBucket>();
const ipBuckets = new Map<string, RateBucket>();

function consumeToken(
  buckets: Map<string, RateBucket>,
  key: string,
  maxAllowed: number,
  windowMs: number,
  nowMs: number,
): boolean {
  const existing = buckets.get(key);
  if (!existing || nowMs >= existing.resetAtMs) {
    buckets.set(key, { count: 1, resetAtMs: nowMs + windowMs });
    return true;
  }

  if (existing.count >= maxAllowed) {
    return false;
  }

  existing.count += 1;
  return true;
}

/**
 * Enforces rate limits on login and magic-link endpoints per identifier (email/phone) and per IP.
 */
export function enforceAuthRateLimit(
  input: { identifier: string; ip: string; nowMs?: number },
  config: AuthRateLimitConfig = DEFAULT_AUTH_RATE_LIMIT,
): Result<true, AppError> {
  const nowMs = input.nowMs ?? Date.now();
  const normalizedId = input.identifier.trim().toLowerCase();
  const normalizedIp = input.ip.trim() || "unknown-ip";

  const ipAllowed = consumeToken(ipBuckets, normalizedIp, config.maxPerIp, config.windowMs, nowMs);
  if (!ipAllowed) {
    return err(createAppError("RATE_LIMITED"));
  }

  if (normalizedId) {
    const idAllowed = consumeToken(
      identifierBuckets,
      normalizedId,
      config.maxPerIdentifier,
      config.windowMs,
      nowMs,
    );
    if (!idAllowed) {
      return err(createAppError("RATE_LIMITED"));
    }
  }

  return ok(true);
}

export function resetAuthRateLimits(): void {
  identifierBuckets.clear();
  ipBuckets.clear();
}
