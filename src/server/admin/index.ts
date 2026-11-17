import { requireAdmin, type AuthProviderOptions } from "@/server/auth";
import { getAnalyticsSummary } from "@/server/analytics";
import { CoreRepository, getDefaultCoreDataStoreState, type CoreDataStoreState } from "@/server/db/client";
import type { TemplateStatus } from "@/types/database";
import { err, ok, type Result } from "@/types/result";
import { createAppError, type AppError } from "@/lib/errors";
import { evaluateAlerts } from "@/server/observability/alerts";
import { summarizeAiCosts } from "@/server/ai/cost";

export async function updateTemplateStatus(
  templateId: string,
  version: number,
  status: TemplateStatus,
  options: AuthProviderOptions & { state?: CoreDataStoreState } = {},
): Promise<Result<true, AppError>> {
  const auth = await requireAdmin(options);
  if (!auth.ok) return auth;
  if (!Number.isInteger(version) || !templateId || !["draft", "published", "archived"].includes(status)) {
    return err(createAppError("VALIDATION_FAILED"));
  }
  const state = options.state ?? getDefaultCoreDataStoreState();
  const repo = new CoreRepository({ role: "service_role" }, state);
  const updated = repo.updateTemplateStatus(templateId, version, status);
  if (!updated.ok) return updated;
  const audit = repo.insertAuditLog({
    actor_user_id: auth.value.user.id,
    action: "template_status_changed",
    target_type: "template",
    target_id: `${templateId}@${version}`,
    metadata: { status },
  });
  if (!audit.ok) return audit;
  return ok(true);
}

export function getAdminDashboard(state: CoreDataStoreState = getDefaultCoreDataStoreState()) {
  const serviceRepo = new CoreRepository({ role: "service_role" }, state);
  const renderJobs = serviceRepo.listRenderJobs();
  const aiRequests = Array.from(state.aiRequests.values());
  return {
    users: state.profiles.size,
    templates: Array.from(state.templates.values()).filter((template) => template.status === "published").length,
    templateRows: Array.from(state.templates.values()).sort((a, b) => a.id.localeCompare(b.id) || b.version - a.version),
    analytics: getAnalyticsSummary(state),
    ai: {
      requests: aiRequests.length,
      costUsd: aiRequests.reduce((total, request) => total + (request.cost_usd ?? 0), 0),
      daily: summarizeAiCosts(state, { exportedFlyers: getAnalyticsSummary(state).exports.succeeded }),
    },
    render: {
      total: renderJobs.ok ? renderJobs.value.length : 0,
      failures: renderJobs.ok ? renderJobs.value.filter((job) => job.result === "failed").length : 0,
    },
    alerts: evaluateAlerts(state),
  };
}

