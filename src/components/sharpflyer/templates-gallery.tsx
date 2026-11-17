"use client";

import * as React from "react";
import { CircleAlert, RotateCcw, Search, X } from "lucide-react";

import { TemplateTile } from "@/components/sharpflyer/template-tile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppError } from "@/lib/errors";
import type { TemplateSummary } from "@/server/templates";
import { cn } from "@/lib/utils";

export function TemplateGallerySkeleton() {
  return (
    <div
      aria-label="Loading templates"
      className="flex flex-wrap gap-x-4 gap-y-7 md:gap-x-6 md:gap-y-10"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex min-w-0 basis-[calc(50%-0.5rem)] flex-col gap-3 md:basis-[calc(33.333%-1rem)] lg:basis-[calc(25%-1.125rem)]"
        >
          <div className="aspect-square animate-pulse rounded-[20px] bg-surface" />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-3/4 animate-pulse rounded-full bg-surface" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TemplatesGallery({
  templates,
  error,
  initialCategory = "all",
}: {
  templates: TemplateSummary[];
  error?: AppError | null;
  initialCategory?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState(initialCategory || "all");
  const categories = React.useMemo(
    () => Array.from(new Set(templates.map((template) => template.category))).sort(),
    [templates],
  );
  const filteredTemplates = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesCategory = category === "all" || template.category === category;
      const searchable = [template.title, template.category, template.style, ...template.tags]
        .join(" ")
        .toLowerCase();
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [category, query, templates]);

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-5 py-8 md:px-8 lg:px-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-foreground">Templates</h1>
          <p className="text-body text-muted-foreground">Choose a design for your next flyer.</p>
        </div>
        <Alert variant="danger">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <AlertTitle>Templates are unavailable</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                <RotateCcw />
                Try again
              </Button>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-5 py-8 md:px-8 lg:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-foreground">Templates</h1>
        <p className="text-body text-muted-foreground">
          Start with a design, then add your business details.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <label htmlFor="template-search" className="sr-only">
          Search templates
        </label>
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="template-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search solar, clean, bold…"
            className="bg-surface pl-12 pr-12"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear template search"
              className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setQuery("")}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {categories.length > 1 && (
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Template categories">
            {["all", ...categories].map((item) => {
              const selected = item === category;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategory(item)}
                  className={cn(
                    "min-h-10 shrink-0 rounded-full px-4 text-callout outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "bg-foreground text-background"
                      : "bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {item === "all" ? "All designs" : item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {filteredTemplates.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-7 md:gap-x-6 md:gap-y-10">
          {filteredTemplates.map((template) => (
            <div
              key={`${template.id}@${template.version}`}
              className="min-w-0 basis-[calc(50%-0.5rem)] md:basis-[calc(33.333%-1rem)] lg:basis-[calc(25%-1.125rem)]"
            >
              <TemplateTile template={template} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-14 text-center">
          <h2 className="text-h3 text-foreground">No designs match “{query.trim()}”</h2>
          <p className="max-w-sm text-small text-muted-foreground">
            Try a different search or clear the filter to see all available designs.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            Clear search
          </Button>
        </div>
      )}
    </div>
  );
}
