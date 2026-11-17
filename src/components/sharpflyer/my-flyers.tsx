"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { deleteFlyerAction, duplicateFlyerAction } from "@/app/actions/flyers";
import { Button } from "@/components/ui/button";
import { FORMAT_SIZES, type FlyerFormat } from "@/schemas/format";
import type { FlyerListItem } from "@/server/flyers";
import { cn } from "@/lib/utils";

const FORMAT_LABELS: Record<FlyerFormat, string> = {
  ig_post: "Instagram Post",
  status: "WhatsApp Status",
  story: "Story",
  fb_post: "Facebook Post",
  a4: "A4 Print",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

export function MyFlyers({ flyers }: { flyers: FlyerListItem[] }) {
  const router = useRouter();
  const [workingId, setWorkingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function duplicate(flyerId: string) {
    setError(null);
    setWorkingId(flyerId);
    const result = await duplicateFlyerAction(flyerId);
    setWorkingId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.push(`/app/create/${result.value.draftId}`);
  }

  async function remove(flyer: FlyerListItem) {
    if (!window.confirm(`Delete '${flyer.title}'? This removes the flyer and its exports.`)) return;
    setError(null);
    setWorkingId(flyer.id);
    const result = await deleteFlyerAction(flyer.id);
    setWorkingId(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  if (flyers.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-center justify-center gap-4 px-5 py-16 text-center md:px-8">
        <h1 className="text-h2 text-foreground">No flyers yet</h1>
        <p className="max-w-sm text-small text-muted-foreground">Choose a design from the gallery to create your first promotional flyer.</p>
        <Button asChild variant="brand"><Link href="/app/templates">Choose a design</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-7 px-5 py-8 md:px-8 lg:px-10">
      <div className="flex flex-col gap-2"><h1 className="text-h1 text-foreground">My flyers</h1><p className="text-body text-muted-foreground">Open a draft, make a copy, or manage your exported designs.</p></div>
      {error && <p role="alert" className="rounded-xl bg-danger-tint px-4 py-3 text-small text-danger-text">{error}</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-8">
        {flyers.map((flyer) => {
          const dimensions = FORMAT_SIZES[flyer.format];
          const working = workingId === flyer.id;
          return (
            <article key={flyer.id} className="flex min-w-0 basis-full flex-col gap-3 sm:basis-[calc(50%-0.625rem)] lg:basis-[calc(33.333%-0.84rem)]">
              <Link href={`/app/create/${flyer.id}`} className="group overflow-hidden rounded-[20px] bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-surface-2" style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}>
                  {flyer.previewUrl ? <img src={flyer.previewUrl} alt={`${flyer.title} preview`} className="h-full w-full object-cover transition-opacity group-hover:opacity-90" /> : <span className="px-6 text-center text-small text-muted-foreground">Generate a preview to see your flyer here.</span>}
                </div>
              </Link>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0"><h2 className="truncate text-callout text-foreground">{flyer.title}</h2><p className="mt-1 text-caption text-muted-foreground">{FORMAT_LABELS[flyer.format]} · {formatDate(flyer.updated_at)}</p></div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-caption", flyer.status === "exported" ? "bg-success-tint text-success" : "bg-surface text-muted-foreground")}>{flyer.status === "exported" ? "Exported" : flyer.status === "rendered" ? "Preview ready" : "Draft"}</span>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="secondary" size="sm" className="flex-1"><Link href={`/app/create/${flyer.id}`}><ExternalLink /> Open</Link></Button>
                <Button variant="ghost" size="sm" aria-label={`Duplicate ${flyer.title}`} onClick={() => void duplicate(flyer.id)} disabled={working}><Copy /> <span className="sr-only sm:not-sr-only">Duplicate</span></Button>
                <Button variant="ghost" size="sm" aria-label={`Delete ${flyer.title}`} className="text-danger-text hover:bg-danger-tint" onClick={() => void remove(flyer)} disabled={working}>{working ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
