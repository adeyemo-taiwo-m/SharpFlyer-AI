"use client";

import * as React from "react";
import { CircleAlert, Loader2, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";

import { designFromPromptAction, reviseDesignAction } from "@/app/actions/ai";
import { useDesignAction as createDesignAction } from "@/app/actions/flyers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DesignFromPromptResult } from "@/server/ai";

export function DesignPromptPage() {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState("Create a clear solar package flyer for a family home.");
  const [businessType, setBusinessType] = React.useState("solar and inverter");
  const [offerFacts, setOfferFacts] = React.useState("Inverter and battery package for homes.");
  const [tone, setTone] = React.useState<"clear" | "friendly" | "pidgin">("clear");
  const [revision, setRevision] = React.useState("");
  const [result, setResult] = React.useState<DesignFromPromptResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleDesign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await designFromPromptAction({ prompt, businessType, offerFacts, tone });
    if (response.ok) setResult(response.value);
    else setError(response.error.message);
    setBusy(false);
  }

  async function handleRevision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result || !revision.trim()) return;
    setBusy(true);
    setError(null);
    const response = await reviseDesignAction({ instruction: revision, currentSpec: result.spec });
    if (response.ok) {
      setResult(response.value);
      setRevision("");
    } else setError(response.error.message);
    setBusy(false);
  }

  async function handleUseDesign() {
    if (!result) return;
    setBusy(true);
    setError(null);
    const response = await createDesignAction({ templateId: result.templateId, themeId: result.themeId, format: "ig_post" });
    if (response.ok) router.push(`/app/create/${response.value.draftId}`);
    else {
      setError(response.error.message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-8 px-5 py-8 md:px-8 lg:px-10">
      <div className="flex flex-col gap-2">
        <p className="text-caption text-muted-foreground">Alternative creation flow</p>
        <h1 className="text-h1 text-foreground">Create with AI</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          Describe the direction you want. AI proposes a constrained design that uses approved SharpFlyer layouts and stays editable in the flyer editor.
        </p>
      </div>

      {error && (
        <Alert variant="danger">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <AlertTitle>Could not create the design</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      <form className="flex flex-col gap-5 rounded-2xl bg-surface p-5 md:p-6" onSubmit={handleDesign}>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-foreground"><MessageSquare className="size-5" /></span>
          <div>
            <h2 className="text-h4 text-foreground">Describe your flyer</h2>
            <p className="text-caption text-muted-foreground">Do not include phone numbers, prices, or addresses in the description.</p>
          </div>
        </div>
        <label className="flex flex-col gap-2 text-callout text-foreground" htmlFor="design-prompt">
          Design direction
          <Textarea id="design-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={1200} required rows={4} placeholder="A bold, trustworthy flyer for..." />
        </label>
        <div className="flex flex-col gap-5 md:flex-row">
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-callout text-foreground" htmlFor="design-business-type">
            Business type
            <Input id="design-business-type" value={businessType} onChange={(event) => setBusinessType(event.target.value)} maxLength={80} required />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-callout text-foreground" htmlFor="design-tone">
            Tone
            <select id="design-tone" value={tone} onChange={(event) => setTone(event.target.value as typeof tone)} className="h-11 rounded-xl border border-border bg-background px-3 text-callout text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="clear">Clear</option>
              <option value="friendly">Friendly</option>
              <option value="pidgin">Pidgin (optional)</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-2 text-callout text-foreground" htmlFor="design-offer-facts">
          Offer facts
          <Textarea id="design-offer-facts" value={offerFacts} onChange={(event) => setOfferFacts(event.target.value)} maxLength={500} required rows={3} placeholder="What is actually included?" />
        </label>
        <Button type="submit" variant="brand" size="lg" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {busy ? "Preparing design…" : "Suggest a design"}
        </Button>
      </form>

      {result && (
        <section className="flex flex-col gap-5 rounded-2xl border border-border bg-background p-5 md:p-6" aria-live="polite">
          <div className="flex flex-col gap-2">
            <p className="text-caption text-muted-foreground">Structured proposal · {result.promptVersion}</p>
            <h2 className="text-h3 text-foreground">Review your direction</h2>
            <p className="text-body text-muted-foreground">Nothing is inserted into a flyer until you choose to use this design.</p>
          </div>
          <dl className="flex flex-col gap-3 text-callout">
            <div className="flex flex-wrap justify-between gap-2 border-b border-border pb-3"><dt className="text-muted-foreground">Layout</dt><dd className="font-medium text-foreground">{result.spec.archetype}</dd></div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-border pb-3"><dt className="text-muted-foreground">Palette</dt><dd className="font-medium text-foreground">{result.spec.paletteId}</dd></div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-border pb-3"><dt className="text-muted-foreground">Fonts</dt><dd className="font-medium text-foreground">{result.spec.fonts.heading} / {result.spec.fonts.body}</dd></div>
            <div className="flex flex-col gap-2"><dt className="text-muted-foreground">Regions</dt><dd className="flex flex-wrap gap-2">{result.spec.regions.map((region) => <span key={`${region.field}-${region.slot}`} className="rounded-full bg-surface px-3 py-1 text-caption text-foreground">{region.field} · {region.emphasis}</span>)}</dd></div>
          </dl>
          <form className="flex flex-col gap-3 border-t border-border pt-5" onSubmit={handleRevision}>
            <label className="flex flex-col gap-2 text-callout text-foreground" htmlFor="design-revision">Revise this direction</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input id="design-revision" value={revision} onChange={(event) => setRevision(event.target.value)} maxLength={300} placeholder="Make the price bigger" className="min-w-0 flex-1" />
              <Button type="submit" variant="ghost" disabled={busy || !revision.trim()}>Revise design</Button>
            </div>
          </form>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setResult(null)} disabled={busy}>Start over</Button>
            <Button type="button" variant="brand" onClick={handleUseDesign} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Use this design
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
