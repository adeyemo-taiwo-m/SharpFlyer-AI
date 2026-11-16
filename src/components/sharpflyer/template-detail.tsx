"use client";

import * as React from "react";
import { Check, CircleAlert, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { useDesignAction as createDesignAction } from "@/app/actions/flyers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FORMAT_SIZES, type FlyerFormat } from "@/schemas/format";
import type { Template } from "@/schemas/template";
import { cn } from "@/lib/utils";

const FORMAT_LABELS: Record<FlyerFormat, string> = {
  ig_post: "Instagram Post",
  status: "WhatsApp Status",
  story: "Story",
  fb_post: "Facebook Post",
  a4: "A4 Print",
};

export function TemplateDetail({ template }: { template: Template }) {
  const router = useRouter();
  const formats = Object.keys(template.formats) as FlyerFormat[];
  const defaultFormat = formats.includes("ig_post") ? "ig_post" : (formats[0] ?? "ig_post");
  const [format, setFormat] = React.useState<FlyerFormat>(defaultFormat);
  const [themeId, setThemeId] = React.useState(template.palettes[0]?.id ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleUseDesign() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await createDesignAction({ templateId: template.meta.id, format, themeId });
      if (!result.ok) {
        setError(result.error.message);
        setSubmitting(false);
        return;
      }
      router.push(`/app/create/${result.value.draftId}`);
    } catch {
      setError("We could not start this flyer. Try again.");
      setSubmitting(false);
    }
  }

  const dimensions = FORMAT_SIZES[format];

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-5 py-8 md:px-8 lg:px-10">
      <div className="flex flex-col gap-2">
        <p className="text-caption text-muted-foreground">{template.meta.category}</p>
        <h1 className="text-h1 text-foreground">{template.meta.title}</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          {template.meta.style.charAt(0).toUpperCase() + template.meta.style.slice(1)} design for {template.meta.tags.join(", ")}.
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex w-full items-center justify-center rounded-[28px] bg-surface p-4 shadow-1 md:p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/templates/${template.meta.id}/preview?format=${format}&theme=${themeId}`}
              alt={`${template.meta.title} preview`}
              width={dimensions.width}
              height={dimensions.height}
              className="max-h-[62dvh] w-full max-w-[620px] rounded-[20px] object-contain shadow-2"
            />
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Available formats">
            {formats.map((item) => {
              const selected = item === format;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFormat(item)}
                  className={cn(
                    "flex min-h-11 flex-col items-start rounded-xl px-4 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "bg-foreground text-background" : "bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  <span className="text-callout">{FORMAT_LABELS[item]}</span>
                  <span className="text-caption opacity-75">{FORMAT_SIZES[item].width} × {FORMAT_SIZES[item].height}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="flex w-full flex-col gap-6 lg:max-w-[360px]">
          <section className="flex flex-col gap-3">
            <h2 className="text-h4 text-foreground">Choose a colour theme</h2>
            <div className="flex flex-wrap gap-3">
              {template.palettes.map((palette) => {
                const selected = palette.id === themeId;
                const primary = palette.roles.primary ?? palette.roles.accent ?? palette.roles.bg;
                return (
                  <button
                    key={palette.id}
                    type="button"
                    aria-label={`${palette.id} theme`}
                    aria-pressed={selected}
                    onClick={() => setThemeId(palette.id)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-callout outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "bg-surface-2 text-foreground" : "bg-surface text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="size-6 rounded-full ring-1 ring-black/10" style={{ backgroundColor: primary }} />
                    <span>{palette.id.replaceAll("-", " ")}</span>
                    {selected && <Check className="size-4" />}
                  </button>
                );
              })}
            </div>
          </section>

          {error && (
            <Alert variant="danger">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 size-5 shrink-0" />
                <div>
                  <AlertTitle>Could not start the flyer</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          <Button type="button" variant="brand" size="lg" onClick={handleUseDesign} disabled={submitting || !themeId}>
            {submitting && <Loader2 className="animate-spin" />}
            {submitting ? "Opening editor…" : "Use this design"}
          </Button>

          <p className="text-caption text-muted-foreground">
            Your price, phone number, business name, address, and logo are rendered from your details.
          </p>
        </aside>
      </div>
    </div>
  );
}
