import { randomUUID } from "node:crypto";

import { createAppError, type AppError } from "@/lib/errors";
import {
  CoreRepository,
  getDefaultCoreDataStoreState,
  type CoreDataStoreState,
} from "@/server/db/client";
import { ANALYTICS_EVENT_NAMES, type AnalyticsEventName, type AnalyticsEventRow } from "@/types/database";
import { err, type Result } from "@/types/result";

export type AnalyticsProperty = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsProperty>;

const SENSITIVE_KEY = /(email|phone|address|name|token|secret|password|cookie|url|ip)/i;

export function sanitizeAnalyticsProperties(input: unknown): AnalyticsProperties {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const result: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(input).slice(0, 24)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof value === "string") result[key.slice(0, 60)] = value.slice(0, 160);
    else if (typeof value === "number" && Number.isFinite(value)) result[key.slice(0, 60)] = value;
    else if (typeof value === "boolean" || value === null) result[key.slice(0, 60)] = value;
  }
  return result;
}

export type TrackOptions = {
  userId?: string | null;
  correlationId?: string;
  state?: CoreDataStoreState;
};

export async function track(
  event: AnalyticsEventName,
  properties: unknown = {},
  options: TrackOptions = {},
): Promise<Result<AnalyticsEventRow, AppError>> {
  if (!ANALYTICS_EVENT_NAMES.includes(event)) return err(createAppError("VALIDATION_FAILED", "Unknown analytics event."));
  if (typeof window !== "undefined") throw new Error("Server analytics cannot be called in browser code.");
  const repo = new CoreRepository({ role: "service_role" }, options.state ?? getDefaultCoreDataStoreState());
  return repo.insertAnalyticsEvent({
    user_id: options.userId ?? null,
    event,
    properties: sanitizeAnalyticsProperties(properties),
    correlation_id: options.correlationId ?? randomUUID(),
  });
}

export type AnalyticsSummary = {
  totalEvents: number;
  eventCounts: Partial<Record<AnalyticsEventName, number>>;
  exports: { started: number; succeeded: number; failed: number };
  activeCreators: number;
};

export function getAnalyticsSummary(state: CoreDataStoreState = getDefaultCoreDataStoreState()): AnalyticsSummary {
  const rows = Array.from(state.analyticsEvents.values());
  const eventCounts: Partial<Record<AnalyticsEventName, number>> = {};
  const creators = new Set<string>();
  for (const row of rows) {
    eventCounts[row.event] = (eventCounts[row.event] ?? 0) + 1;
    if (row.user_id) creators.add(row.user_id);
  }
  return {
    totalEvents: rows.length,
    eventCounts,
    exports: {
      started: eventCounts.export_started ?? 0,
      succeeded: eventCounts.export_succeeded ?? 0,
      failed: eventCounts.export_failed ?? 0,
    },
    activeCreators: creators.size,
  };
}

