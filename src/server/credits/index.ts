import { randomUUID } from "node:crypto";

import { createAppError, type AppError } from "@/lib/errors";
import {
  getDefaultCoreDataStoreState,
  type CoreDataStoreState,
  type DbActor,
} from "@/server/db/client";
import type { CreditLedgerRow, CreditReason } from "@/types/database";
import { err, ok, type Result } from "@/types/result";

export type CreditServiceOptions = {
  state?: CoreDataStoreState;
  actor?: DbActor;
};

function ensureNonBrowser(): void {
  if (typeof window !== "undefined") {
    throw new Error("Credit service cannot be imported or called in client code.");
  }
}

/**
 * Serializes ledger operations per user in-process, mirroring `pg_advisory_xact_lock(hashtext(p_user_id::text))`.
 */
async function withUserAdvisoryLock<T>(
  state: CoreDataStoreState,
  userId: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  const previous = state.userLocks.get(userId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  state.userLocks.set(
    userId,
    previous.then(() => current),
  );

  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

function computeLedgerBalance(state: CoreDataStoreState, userId: string): number {
  let sum = 0;
  for (const row of state.creditLedger) {
    if (row.user_id === userId) {
      sum += row.delta;
    }
  }
  return sum;
}

/**
 * Returns the user's credit balance derived strictly as `SUM(delta)` from `credit_ledger`.
 * Enforces RLS: authenticated users can only read their own balance.
 */
export async function getBalance(
  userId: string,
  options: CreditServiceOptions = {},
): Promise<Result<number, AppError>> {
  ensureNonBrowser();
  if (!userId.trim()) {
    return err(createAppError("VALIDATION_FAILED", "User ID is required."));
  }

  const state = options.state ?? getDefaultCoreDataStoreState();
  const actor: DbActor = options.actor ?? { role: "service_role" };

  if (actor.role !== "service_role" && (actor.role !== "authenticated" || actor.userId !== userId)) {
    return err(createAppError("FORBIDDEN", "You do not have permission to access this balance."));
  }

  return ok(computeLedgerBalance(state, userId));
}

/**
 * Returns the user's immutable ledger history (`SELECT` own rows only under RLS).
 */
export async function listLedgerEntries(
  userId: string,
  options: CreditServiceOptions = {},
): Promise<Result<CreditLedgerRow[], AppError>> {
  ensureNonBrowser();
  const state = options.state ?? getDefaultCoreDataStoreState();
  const actor: DbActor = options.actor ?? { role: "service_role" };

  if (actor.role !== "service_role" && (actor.role !== "authenticated" || actor.userId !== userId)) {
    return err(createAppError("FORBIDDEN", "You do not have permission to access this ledger."));
  }

  const rows = state.creditLedger
    .filter((entry) => entry.user_id === userId)
    .map((entry) => ({ ...entry }));
  return ok(rows);
}

/**
 * Atomically consumes 1 credit for a flyer export (`reason = 'export'`).
 * - Idempotent on `(userId, 'export', referenceId)`.
 * - Acquires a per-user lock so concurrent exports with balance 1 never race.
 * - Callable only by server (`service_role`).
 */
export async function consumeCredit(
  userId: string,
  referenceId: string,
  options: CreditServiceOptions = {},
): Promise<Result<number, AppError>> {
  ensureNonBrowser();
  const state = options.state ?? getDefaultCoreDataStoreState();
  const actor: DbActor = options.actor ?? { role: "service_role" };

  if (actor.role !== "service_role") {
    return err(createAppError("FORBIDDEN", "Credit deductions can only be executed by the server."));
  }

  if (!userId.trim() || !referenceId.trim()) {
    return err(createAppError("VALIDATION_FAILED", "User ID and export reference ID are required."));
  }

  return withUserAdvisoryLock(state, userId, () => {
    const existing = state.creditLedger.find(
      (entry) =>
        entry.user_id === userId &&
        entry.reason === "export" &&
        entry.reference_id === referenceId,
    );
    if (existing) {
      return ok(computeLedgerBalance(state, userId));
    }

    const currentBalance = computeLedgerBalance(state, userId);
    if (currentBalance < 1) {
      return err(createAppError("INSUFFICIENT_CREDITS"));
    }

    const row: CreditLedgerRow = {
      id: randomUUID(),
      user_id: userId,
      delta: -1,
      reason: "export",
      reference_id: referenceId,
      created_at: new Date().toISOString(),
    };
    state.creditLedger.push(row);
    return ok(currentBalance - 1);
  });
}

/**
 * Atomically refunds 1 credit when a render or export fails after deduction (`reason = 'refund'`).
 * - Idempotent on `(userId, 'refund', referenceId)`.
 * - Requires a matching prior `'export'` deduction for the same `referenceId`.
 */
export async function refundCredit(
  userId: string,
  referenceId: string,
  options: CreditServiceOptions = {},
): Promise<Result<number, AppError>> {
  ensureNonBrowser();
  const state = options.state ?? getDefaultCoreDataStoreState();
  const actor: DbActor = options.actor ?? { role: "service_role" };

  if (actor.role !== "service_role") {
    return err(createAppError("FORBIDDEN", "Credit refunds can only be executed by the server."));
  }

  if (!userId.trim() || !referenceId.trim()) {
    return err(createAppError("VALIDATION_FAILED", "User ID and export reference ID are required."));
  }

  return withUserAdvisoryLock(state, userId, () => {
    const alreadyRefunded = state.creditLedger.find(
      (entry) =>
        entry.user_id === userId &&
        entry.reason === "refund" &&
        entry.reference_id === referenceId,
    );
    if (alreadyRefunded) {
      return ok(computeLedgerBalance(state, userId));
    }

    const originalExport = state.creditLedger.find(
      (entry) =>
        entry.user_id === userId &&
        entry.reason === "export" &&
        entry.reference_id === referenceId,
    );
    if (!originalExport) {
      return err(createAppError("NOT_FOUND", "No matching export deduction was found to refund."));
    }

    const row: CreditLedgerRow = {
      id: randomUUID(),
      user_id: userId,
      delta: 1,
      reason: "refund",
      reference_id: referenceId,
      created_at: new Date().toISOString(),
    };
    state.creditLedger.push(row);
    return ok(computeLedgerBalance(state, userId));
  });
}

/**
 * Atomically grants positive credits (`reason` must be `'grant' | 'purchase' | 'adjustment'`).
 * - Idempotent on `(userId, reason, referenceId)`.
 * - Callable only by server (`service_role`).
 */
export async function grantCredits(
  userId: string,
  amount: number,
  reason: Extract<CreditReason, "grant" | "purchase" | "adjustment">,
  referenceId: string,
  options: CreditServiceOptions = {},
): Promise<Result<number, AppError>> {
  ensureNonBrowser();
  const state = options.state ?? getDefaultCoreDataStoreState();
  const actor: DbActor = options.actor ?? { role: "service_role" };

  if (actor.role !== "service_role") {
    return err(createAppError("FORBIDDEN", "Credit grants can only be executed by the server."));
  }

  if (!userId.trim() || !referenceId.trim() || !Number.isInteger(amount) || amount <= 0) {
    return err(createAppError("VALIDATION_FAILED", "Grant amount must be a positive whole number."));
  }

  if (reason !== "grant" && reason !== "purchase" && reason !== "adjustment") {
    return err(createAppError("VALIDATION_FAILED", "Invalid credit grant reason."));
  }

  return withUserAdvisoryLock(state, userId, () => {
    const existing = state.creditLedger.find(
      (entry) =>
        entry.user_id === userId &&
        entry.reason === reason &&
        entry.reference_id === referenceId,
    );
    if (existing) {
      return ok(computeLedgerBalance(state, userId));
    }

    const row: CreditLedgerRow = {
      id: randomUUID(),
      user_id: userId,
      delta: amount,
      reason,
      reference_id: referenceId,
      created_at: new Date().toISOString(),
    };
    state.creditLedger.push(row);
    return ok(computeLedgerBalance(state, userId));
  });
}
