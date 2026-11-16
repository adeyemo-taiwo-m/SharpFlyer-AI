import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Temporary SharpFlyer logo component built from the construction rules in Design System Section 2.3.
 * TODO(temporary-logo): Replace this temporary text wordmark and SVG symbol with the final commissioned vector asset when ready.
 */
export function SharpFlyerLogo({
  className,
  showWordmark = true,
  size = 24,
  variant = "default",
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
  variant?: "default" | "accent";
}) {
  return (
    <span
      data-temporary-logo="true"
      className={cn("inline-flex items-center gap-2 select-none", className)}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 1024 1024"
        fill="none"
        aria-hidden="true"
        className={cn(
          "shrink-0",
          variant === "accent"
            ? "text-brand"
            : "text-foreground",
        )}
      >
        {/* 1024x1024 square: three corners rounded with r=288, top-right corner cut square (r=0) */}
        <path
          d="M 288 0 L 1024 0 L 1024 736 A 288 288 0 0 1 736 1024 L 288 1024 A 288 288 0 0 1 0 736 L 0 288 A 288 288 0 0 1 288 0 Z"
          fill="currentColor"
        />
        <text
          x="512"
          y="710"
          textAnchor="middle"
          fill={variant === "accent" ? "var(--brand-foreground)" : "var(--background)"}
          fontFamily="var(--font-sans), sans-serif"
          fontWeight="700"
          fontSize="560"
        >
          S
        </text>
      </svg>
      {showWordmark && (
        <span className="inline-flex items-baseline text-[17px] leading-none">
          <span className="font-bold tracking-[-0.04em] text-foreground">
            SharpFlyer
          </span>
          <span className="ml-1 font-medium text-muted-foreground">AI</span>
        </span>
      )}
    </span>
  );
}
