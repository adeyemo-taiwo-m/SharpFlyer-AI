import type { AiRequestKind, AiRequestRow } from "@/types/database";
import type { CoreDataStoreState } from "@/server/db/client";

export type AiCostSummary = {
  day: string;
  byKind: Record<AiRequestKind, { requests: number; costUsd: number | null }>;
  totalCostUsd: number | null;
  alertThresholdUsd: number | null;
  alertExceeded: boolean;
  costPerExportedFlyerUsd: number | null;
};

function dayKey(value: string | number | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

function alertThreshold(): number | null {
  const value = Number(process.env.AI_DAILY_COST_ALERT_USD ?? "");
  return Number.isFinite(value) && value > 0 ? value : null;
}

function sumKnownCost(rows: AiRequestRow[]): number | null {
  const known = rows.filter((row) => row.cost_usd !== null);
  return known.length > 0 ? known.reduce((sum, row) => sum + (row.cost_usd ?? 0), 0) : null;
}

export function summarizeAiCosts(
  state: CoreDataStoreState,
  options: { userId?: string; day?: string; exportedFlyers?: number } = {},
): AiCostSummary {
  const day = options.day ?? dayKey(Date.now());
  const rows = Array.from(state.aiRequests.values()).filter((row) => dayKey(row.created_at) === day && (!options.userId || row.user_id === options.userId));
  const byKind = {
    copy_suggestions: rows.filter((row) => row.kind === "copy_suggestions"),
    background_removal: rows.filter((row) => row.kind === "background_removal"),
    design_specs: rows.filter((row) => row.kind === "design_specs"),
    design_revisions: rows.filter((row) => row.kind === "design_revisions"),
  };
  const totalCostUsd = sumKnownCost(rows);
  const threshold = alertThreshold();
  const exports = options.exportedFlyers ?? 0;
  return {
    day,
    byKind: {
      copy_suggestions: { requests: byKind.copy_suggestions.length, costUsd: sumKnownCost(byKind.copy_suggestions) },
      background_removal: { requests: byKind.background_removal.length, costUsd: sumKnownCost(byKind.background_removal) },
      design_specs: { requests: byKind.design_specs.length, costUsd: sumKnownCost(byKind.design_specs) },
      design_revisions: { requests: byKind.design_revisions.length, costUsd: sumKnownCost(byKind.design_revisions) },
    },
    totalCostUsd,
    alertThresholdUsd: threshold,
    alertExceeded: threshold !== null && totalCostUsd !== null && totalCostUsd >= threshold,
    costPerExportedFlyerUsd: totalCostUsd !== null && exports > 0 ? totalCostUsd / exports : null,
  };
}
