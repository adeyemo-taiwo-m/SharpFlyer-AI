"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { FORMAT_SIZES, type FlyerFormat } from "@/schemas/format";
import type { TemplateSummary } from "@/server/templates";
import { cn } from "@/lib/utils";

const FORMAT_LABELS: Record<FlyerFormat, string> = {
  ig_post: "Instagram Post",
  status: "WhatsApp Status",
  story: "Story",
  fb_post: "Facebook Post",
  a4: "A4 Print",
};

function formatCategoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Template tile (Design System 10.1):
 * - Layout: flyer image on top, title and category below. Not a boxed card.
 * - No border, background panel, or shadow at rest.
 * - Image: native aspect ratio of the preview format, `rounded-[20px]` (`radius-xl`), `surface` placeholder while loading, object-fit cover.
 * - Desktop hover: add `shadow-2` to the image (opacity-only transition).
 * - Selected (in "Change design" mode): 3px `brand` ring offset by 2px plus a check badge.
 */
export function TemplateTile({
  template,
  selected = false,
  onSelect,
  className,
}: {
  template: TemplateSummary;
  selected?: boolean;
  onSelect?: (template: TemplateSummary) => void;
  className?: string;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const primaryFormat: FlyerFormat = template.formats.includes("ig_post")
    ? "ig_post"
    : (template.formats[0] ?? "ig_post");
  const dimensions = FORMAT_SIZES[primaryFormat];
  const formatSummary = template.formats
    .map((f) => FORMAT_LABELS[f])
    .join(" · ");

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (onSelect) {
      event.preventDefault();
      onSelect(template);
    }
  };

  return (
    <Link
      href={`/app/templates/${template.id}`}
      onClick={handleClick}
      data-testid={`template-tile-${template.id}`}
      className={cn(
        "group flex flex-col gap-3 rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div
        style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
        className={cn(
          "relative w-full overflow-hidden rounded-[20px] bg-surface",
          selected && "ring-[3px] ring-brand ring-offset-2 ring-offset-background",
        )}
      >
        {/* Desktop hover shadow-2 layer with opacity-only transition (Design System 6.3 & 10.1) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[20px] opacity-0 shadow-2 transition-opacity duration-150 lg:group-hover:opacity-100"
        />

        {/* Lazy-loaded real rendered thumbnail with reserved aspect-ratio space */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/templates/${template.id}/preview?format=${primaryFormat}`}
          alt={`${template.title} flyer design preview`}
          width={dimensions.width}
          height={dimensions.height}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-150",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />

        {selected && (
          <span
            aria-label="Selected design"
            className="absolute right-3 top-3 inline-flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground"
          >
            <Check className="size-3.5" strokeWidth={2.25} />
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-callout text-foreground">{template.title}</span>
        <span className="text-caption text-muted-foreground">
          {formatCategoryLabel(template.category)} · {formatSummary}
        </span>
      </div>
    </Link>
  );
}
