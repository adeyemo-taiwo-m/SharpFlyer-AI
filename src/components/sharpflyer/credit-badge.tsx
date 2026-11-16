"use client";

import * as React from "react";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Credit badge component (Design System 10.4):
 * - Pill in the app bar: `Coins` icon (16px) + tabular count ("12"), `callout`, `surface` background, height 36.
 * - Low state (3 or fewer): `warning-tint` background and `warning` text.
 * - Empty state (0): `danger-tint` and `danger-text`.
 * - Tapping opens a sheet showing balance and a disabled "Buy credits" button with a plain note (Phase 5 completes payment checkout).
 */
export function CreditBadge({
  balance,
  open,
  onOpenChange,
  className,
}: {
  balance: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const isEmpty = balance <= 0;
  const isLow = balance > 0 && balance <= 3;

  const creditText = balance === 1 ? "1 credit" : `${balance} credits`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`${creditText} available. View credit balance`}
          data-testid="credit-badge"
          data-state={isEmpty ? "empty" : isLow ? "low" : "normal"}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-callout transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
            isEmpty
              ? "bg-danger-tint text-danger-text"
              : isLow
                ? "bg-warning-tint text-warning"
                : "bg-surface text-foreground hover:bg-surface-2",
            className,
          )}
        >
          <Coins className="size-4 shrink-0" strokeWidth={1.75} />
          <span className="tabular font-medium" data-testid="credit-badge-count">
            {balance}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-[28px] p-6">
        <SheetHeader>
          <SheetTitle>Your credits</SheetTitle>
          <SheetDescription>
            Each high-resolution flyer export uses 1 credit. Previews and re-downloads of exported versions are free.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-2 flex items-center justify-between rounded-2xl bg-surface p-4">
          <span className="text-callout text-muted-foreground">Current balance</span>
          <span className="text-price tabular text-foreground" data-testid="credit-sheet-balance">
            {creditText}
          </span>
        </div>

        {isLow && (
          <p className="text-small text-warning">
            You have {creditText} left.
          </p>
        )}
        {isEmpty && (
          <p className="text-small text-danger-text">
            You have 0 credits left. Buy credits to export new flyer designs.
          </p>
        )}

        <SheetFooter className="mt-4">
          <Button variant="brand" className="w-full" disabled>
            Buy credits
          </Button>
          <p className="text-center text-caption text-muted-foreground">
            Online credit purchases open in the next update. Your drafts stay saved.
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
