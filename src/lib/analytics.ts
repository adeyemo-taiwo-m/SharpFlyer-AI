import type { AnalyticsEventName } from "@/types/database";

export type ClientAnalyticsProperties = Record<string, string | number | boolean | null>;

export function trackClient(
  event: AnalyticsEventName,
  properties: ClientAnalyticsProperties = {},
  correlationId?: string,
): void {
  if (typeof window === "undefined") return;
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, properties, correlationId }),
    keepalive: true,
  }).catch(() => undefined);
}

