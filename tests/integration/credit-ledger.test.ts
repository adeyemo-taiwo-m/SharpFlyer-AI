import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { createCoreDataStoreState } from "@/server/db/client";
import {
  consumeCredit,
  getBalance,
  grantCredits,
  listLedgerEntries,
  refundCredit,
} from "@/server/credits";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

describe("Step 3.2: Append-only credit ledger and atomic operations", () => {
  let state = createCoreDataStoreState();

  beforeEach(() => {
    state = createCoreDataStoreState();
  });

  it("enforces append-only rules, RLS, and advisory locks in the SQL migration", async () => {
    const sqlPath = join(process.cwd(), "supabase", "migrations", "20261116000002_credit_ledger.sql");
    const sql = await readFile(sqlPath, "utf8");

    expect(sql).toContain("alter table public.credit_ledger enable row level security;");
    expect(sql).toContain("before update or delete on public.credit_ledger");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("revoke all on function public.consume_credit(uuid, text) from public, anon, authenticated;");
  });

  it("derives balance strictly as the sum of ledger deltas", async () => {
    await grantCredits(USER_A, 3, "grant", "starter-grant", { state });
    await grantCredits(USER_A, 10, "purchase", "payment-001", { state });
    await consumeCredit(USER_A, "flyer-version-1", { state });
    await consumeCredit(USER_A, "flyer-version-2", { state });
    await refundCredit(USER_A, "flyer-version-2", { state });

    const balanceResult = await getBalance(USER_A, { state });
    const entriesResult = await listLedgerEntries(USER_A, { state });

    expect(balanceResult.ok).toBe(true);
    expect(entriesResult.ok).toBe(true);
    if (balanceResult.ok && entriesResult.ok) {
      const ledgerSum = entriesResult.value.reduce((acc, row) => acc + row.delta, 0);
      expect(balanceResult.value).toBe(ledgerSum);
      expect(balanceResult.value).toBe(12); // +3 +10 -1 -1 +1 = 12
      expect(entriesResult.value).toHaveLength(5);
    }
  });

  it("allows only one export to succeed when concurrent exports run with a balance of 1", async () => {
    await grantCredits(USER_A, 1, "grant", "starter-1", { state });

    const [res1, res2, res3] = await Promise.all([
      consumeCredit(USER_A, "concurrent-version-1", { state }),
      consumeCredit(USER_A, "concurrent-version-2", { state }),
      consumeCredit(USER_A, "concurrent-version-3", { state }),
    ]);

    const successes = [res1, res2, res3].filter((r) => r.ok);
    const failures = [res1, res2, res3].filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(2);
    for (const failure of failures) {
      if (!failure.ok) {
        expect(failure.error.code).toBe("INSUFFICIENT_CREDITS");
      }
    }

    const finalBalance = await getBalance(USER_A, { state });
    expect(finalBalance).toEqual({ ok: true, value: 0 });
  });

  it("leaves balance unchanged via automatic refund when a render fails after deduction", async () => {
    await grantCredits(USER_A, 2, "grant", "starter-2", { state });

    const deducted = await consumeCredit(USER_A, "failed-render-v1", { state });
    expect(deducted).toEqual({ ok: true, value: 1 });

    // Simulate render failure path issuing an automatic refund
    const refunded = await refundCredit(USER_A, "failed-render-v1", { state });
    expect(refunded).toEqual({ ok: true, value: 2 });

    const entries = await listLedgerEntries(USER_A, { state });
    if (entries.ok) {
      // Append-only: both the export (-1) and refund (+1) rows are preserved
      expect(entries.value.map((e) => e.delta)).toEqual([2, -1, 1]);
    }
  });

  it("is idempotent on duplicate grant, consume, and refund requests", async () => {
    const g1 = await grantCredits(USER_A, 3, "grant", "welcome-grant", { state });
    const g2 = await grantCredits(USER_A, 3, "grant", "welcome-grant", { state });
    expect(g1).toEqual({ ok: true, value: 3 });
    expect(g2).toEqual({ ok: true, value: 3 });

    const c1 = await consumeCredit(USER_A, "export-v1", { state });
    const c2 = await consumeCredit(USER_A, "export-v1", { state });
    expect(c1).toEqual({ ok: true, value: 2 });
    expect(c2).toEqual({ ok: true, value: 2 });

    const r1 = await refundCredit(USER_A, "export-v1", { state });
    const r2 = await refundCredit(USER_A, "export-v1", { state });
    expect(r1).toEqual({ ok: true, value: 3 });
    expect(r2).toEqual({ ok: true, value: 3 });

    const entries = await listLedgerEntries(USER_A, { state });
    if (entries.ok) {
      expect(entries.value).toHaveLength(3);
    }
  });

  it("forbids client actors from writing to the ledger or reading another user's balance", async () => {
    await grantCredits(USER_A, 3, "grant", "starter", { state });

    const userAActor = { role: "authenticated" as const, userId: USER_A };
    const userBActor = { role: "authenticated" as const, userId: USER_B };

    expect((await getBalance(USER_A, { state, actor: userAActor })).ok).toBe(true);
    expect((await getBalance(USER_A, { state, actor: userBActor })).ok).toBe(false);
    expect((await grantCredits(USER_A, 10, "grant", "hack", { state, actor: userAActor })).ok).toBe(false);
    expect((await consumeCredit(USER_A, "v1", { state, actor: userAActor })).ok).toBe(false);
  });
});
