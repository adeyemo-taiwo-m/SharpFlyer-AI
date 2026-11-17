"use client";

import { useState } from "react";

import { updateTemplateStatusAction } from "@/app/actions/admin";
import type { TemplateStatus } from "@/types/database";
import { Button } from "@/components/ui/button";

export function AdminTemplateActions({ templateId, version, status }: { templateId: string; version: number; status: TemplateStatus }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function change(nextStatus: TemplateStatus) {
    setBusy(true);
    const result = await updateTemplateStatusAction(templateId, version, nextStatus);
    setMessage(result.ok ? "Saved" : result.error.message);
    setBusy(false);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-caption text-muted-foreground">{status}</span>
      {status !== "published" && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void change("published")}>Publish</Button>}
      {status !== "archived" && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void change("archived")}>Archive</Button>}
      {message && <span className="text-caption text-muted-foreground" role="status">{message}</span>}
    </div>
  );
}

