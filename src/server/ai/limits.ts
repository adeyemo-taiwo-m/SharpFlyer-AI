import { createAppError, type AppError } from "@/lib/errors";
import { err, ok, type Result } from "@/types/result";
import type { AiRequestKind } from "@/types/database";

type Counter = { count: number; resetAtMs: number };

export type AiLimitInput = {
  userId: string;
  ip?: string;
  kind: AiRequestKind;
  flyerId?: string;
  nowMs?: number;
};

export type AiLimitConfig = {
  userWindowMs: number;
  ipWindowMs: number;
  flyerWindowMs: number;
  maxPerUser: number;
  maxPerIp: number;
  maxPerFlyer: number;
};

export const DEFAULT_AI_LIMITS: Record<AiRequestKind, AiLimitConfig> = {
  copy_suggestions: {
    userWindowMs: 24 * 60 * 60 * 1000,
    ipWindowMs: 60 * 1000,
    flyerWindowMs: 24 * 60 * 60 * 1000,
    maxPerUser: 20,
    maxPerIp: 20,
    maxPerFlyer: 3,
  },
  background_removal: {
    userWindowMs: 24 * 60 * 60 * 1000,
    ipWindowMs: 60 * 1000,
    flyerWindowMs: 24 * 60 * 60 * 1000,
    maxPerUser: 5,
    maxPerIp: 20,
    maxPerFlyer: 3,
  },
  design_specs: { userWindowMs: 24 * 60 * 60 * 1000, ipWindowMs: 60 * 1000, flyerWindowMs: 24 * 60 * 60 * 1000, maxPerUser: 5, maxPerIp: 10, maxPerFlyer: 3 },
  design_revisions: { userWindowMs: 24 * 60 * 60 * 1000, ipWindowMs: 60 * 1000, flyerWindowMs: 24 * 60 * 60 * 1000, maxPerUser: 10, maxPerIp: 20, maxPerFlyer: 5 },
};

const userCounters = new Map<string, Counter>();
const ipCounters = new Map<string, Counter>();
const flyerCounters = new Map<string, Counter>();

function consume(map: Map<string, Counter>, key: string, max: number, windowMs: number, nowMs: number): boolean {
  const existing = map.get(key);
  if (!existing || nowMs >= existing.resetAtMs) {
    map.set(key, { count: 1, resetAtMs: nowMs + windowMs });
    return true;
  }
  if (existing.count >= max) return false;
  existing.count += 1;
  return true;
}

export function enforceLimits(input: AiLimitInput, config = DEFAULT_AI_LIMITS[input.kind]): Result<true, AppError> {
  const nowMs = input.nowMs ?? Date.now();
  const ip = input.ip?.trim() || "unknown-ip";
  const userKey = `${input.userId}:${input.kind}`;
  const ipKey = `${ip}:${input.kind}`;
  const flyerKey = input.flyerId ? `${input.userId}:${input.flyerId}:${input.kind}` : null;

  const consumed: Array<[Map<string, Counter>, string]> = [];
  if (consume(userCounters, userKey, config.maxPerUser, config.userWindowMs, nowMs)) consumed.push([userCounters, userKey]);
  else return err(createAppError("AI_LIMIT_REACHED"));

  if (consume(ipCounters, ipKey, config.maxPerIp, config.ipWindowMs, nowMs)) consumed.push([ipCounters, ipKey]);
  else {
    releaseCounters(consumed, nowMs);
    return err(createAppError("RATE_LIMITED"));
  }

  if (flyerKey && !consume(flyerCounters, flyerKey, config.maxPerFlyer, config.flyerWindowMs, nowMs)) {
    releaseCounters(consumed, nowMs);
    return err(createAppError("AI_LIMIT_REACHED", "Try a different flyer or write your own copy for now."));
  }
  if (flyerKey) consumed.push([flyerCounters, flyerKey]);
  return ok(true);
}

function releaseCounters(consumed: Array<[Map<string, Counter>, string]>, nowMs: number): void {
  for (const [map, key] of consumed) {
    const counter = map.get(key);
    if (!counter || nowMs >= counter.resetAtMs) continue;
    if (counter.count <= 1) map.delete(key);
    else counter.count -= 1;
  }
}

/** Releases one reservation when a provider call fails, so failures do not consume allowance. */
export function releaseLimits(input: AiLimitInput): void {
  const nowMs = input.nowMs ?? Date.now();
  const ip = input.ip?.trim() || "unknown-ip";
  const keys: Array<[Map<string, Counter>, string]> = [
    [userCounters, `${input.userId}:${input.kind}`],
    [ipCounters, `${ip}:${input.kind}`],
  ];
  if (input.flyerId) keys.push([flyerCounters, `${input.userId}:${input.flyerId}:${input.kind}`]);
  releaseCounters(keys, nowMs);
}

export function resetAiLimits(): void {
  userCounters.clear();
  ipCounters.clear();
  flyerCounters.clear();
}
