import { notFound, redirect } from "next/navigation";

import { AdminTemplateActions } from "@/components/sharpflyer/admin-template-actions";
import { requireAdmin } from "@/server/auth";
import { getAdminDashboard } from "@/server/admin";

export default async function AdminPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.error.code === "UNAUTHENTICATED") redirect("/auth?next=%2Fadmin");
    notFound();
  }
  const dashboard = getAdminDashboard();
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div>
        <p className="text-caption text-muted-foreground">SharpFlyer operations</p>
        <h1 className="mt-2 text-h1 text-foreground">Admin</h1>
        <p className="mt-2 max-w-2xl text-body text-muted-foreground">Usage, template publication, AI cost, and render health. Admin actions are recorded in the audit log.</p>
      </div>
      <section className="flex flex-wrap gap-3" aria-label="Admin summary">
        <Summary label="Users" value={dashboard.users} />
        <Summary label="Published templates" value={dashboard.templates} />
        <Summary label="Exports" value={dashboard.analytics.exports.succeeded} />
        <Summary label="AI cost" value={`$${dashboard.ai.costUsd.toFixed(4)}`} />
        <Summary label="Render failures" value={dashboard.render.failures} />
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="admin-templates-heading">
        <h2 id="admin-templates-heading" className="text-h3 text-foreground">Templates</h2>
        <div className="flex flex-col divide-y divide-border rounded-2xl bg-surface">
          {dashboard.templateRows.map((template) => (
            <div key={`${template.id}@${template.version}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div><p className="text-callout text-foreground">{template.title}</p><p className="text-caption text-muted-foreground">{template.id} · v{template.version}</p></div>
              <AdminTemplateActions templateId={template.id} version={template.version} status={template.status} />
            </div>
          ))}
        </div>
      </section>
      {dashboard.alerts.length > 0 && <section className="flex flex-col gap-2" aria-labelledby="admin-alerts-heading"><h2 id="admin-alerts-heading" className="text-h3 text-foreground">Alerts</h2>{dashboard.alerts.map((alert) => <p key={alert.key} className="rounded-xl bg-danger-tint p-3 text-small text-danger-text" role="alert">{alert.message}</p>)}</section>}
      <section className="flex flex-col gap-2" aria-labelledby="admin-events-heading">
        <h2 id="admin-events-heading" className="text-h3 text-foreground">Measurement</h2>
        <p className="text-body text-muted-foreground">{dashboard.analytics.activeCreators} creators have generated tracked activity across {dashboard.analytics.totalEvents} privacy-minimal events.</p>
      </section>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-36 rounded-2xl bg-surface p-4"><p className="text-caption text-muted-foreground">{label}</p><p className="mt-1 text-h3 text-foreground">{value}</p></div>;
}

