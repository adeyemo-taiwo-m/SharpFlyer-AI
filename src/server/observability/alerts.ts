import type { CoreDataStoreState } from "@/server/db/client";

export type ObservabilityAlert = {
  key: "render_failures" | "webhook_failures" | "ai_cost_per_export";
  severity: "warning" | "critical";
  message: string;
};

export function evaluateAlerts(state: CoreDataStoreState): ObservabilityAlert[] {
  const alerts: ObservabilityAlert[] = [];
  const jobs = Array.from(state.renderJobs.values());
  if (jobs.length >= 10) {
    const failures = jobs.filter((job) => job.result === "failed").length;
    if (failures / jobs.length > 0.1) alerts.push({ key: "render_failures", severity: "critical", message: `${failures} of ${jobs.length} recent render jobs failed.` });
  }
  if (Array.from(state.webhookEvents.values()).some((event) => event.status === "failed")) alerts.push({ key: "webhook_failures", severity: "critical", message: "At least one payment webhook failed and needs review." });
  const exports = Array.from(state.analyticsEvents.values()).filter((event) => event.event === "export_succeeded").length;
  const cost = Array.from(state.aiRequests.values()).reduce((total, request) => total + (request.cost_usd ?? 0), 0);
  const ceiling = Number(process.env.AI_COST_PER_EXPORT_ALERT_USD ?? "0");
  if (ceiling > 0 && exports > 0 && cost / exports > ceiling) alerts.push({ key: "ai_cost_per_export", severity: "warning", message: `AI cost per exported flyer is $${(cost / exports).toFixed(4)}.` });
  return alerts;
}
