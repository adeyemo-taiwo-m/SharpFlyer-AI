"use client";

import * as React from "react";
import { Check, CircleAlert, Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";

import { exportFlyerAction } from "@/app/actions/flyers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FORMAT_SIZES, type FlyerFormat } from "@/schemas/format";

const FORMAT_LABELS: Record<FlyerFormat, string> = {
  ig_post: "Instagram Post",
  status: "WhatsApp Status",
  story: "Story",
  fb_post: "Facebook Post",
  a4: "A4 Print",
};

export function ExportSheet({
  flyerId,
  format,
  balance,
  disabled,
  onBalanceChange,
  onOpenCredits,
}: {
  flyerId: string;
  format: FlyerFormat;
  balance: number;
  disabled?: boolean;
  onBalanceChange: (balance: number) => void;
  onOpenCredits: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [fileType, setFileType] = React.useState<"png" | "jpg">("png");
  const [scale, setScale] = React.useState<1 | 2>(1);
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [exportedUrl, setExportedUrl] = React.useState<string | null>(null);

  const afterBalance = Math.max(0, balance - 1);
  const dimensions = FORMAT_SIZES[format];

  async function handleExport() {
    setError(null);
    setWorking(true);
    const result = await exportFlyerAction(flyerId, { fileType, scale });
    setWorking(false);

    if (!result.ok) {
      setError(result.error.message);
      if (result.error.code === "INSUFFICIENT_CREDITS") onOpenCredits();
      return;
    }

    setExportedUrl(result.value.downloadUrl);
    onBalanceChange(result.value.balanceAfter);
    toast.success("Flyer exported");
  }

  async function handleShare() {
    if (!exportedUrl) return;
    const url = new URL(exportedUrl, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: "SharpFlyer flyer", url });
      } catch {
        // The user may dismiss the share sheet; there is no error to show.
      }
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setError(null);
      setExportedUrl(null);
    }
  }

  function handleOpenExport() {
    if (balance < 1) {
      onOpenCredits();
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <Button type="button" variant="brand" size="lg" className="w-full" disabled={disabled} onClick={handleOpenExport}>
        Export flyer
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-[28px] p-6">
          {exportedUrl ? (
            <div className="flex flex-col gap-6">
              <SheetHeader>
                <div className="inline-flex size-12 items-center justify-center rounded-full bg-success-tint text-success">
                  <Check className="size-6" />
                </div>
                <SheetTitle>Flyer exported</SheetTitle>
                <SheetDescription>Your {FORMAT_LABELS[format]} is ready to save or share.</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="brand" className="flex-1" onClick={handleShare}>
                  <Share2 />
                  Share
                </Button>
                <Button asChild variant="secondary" className="flex-1">
                  <a href={exportedUrl} download={`sharpflyer-${flyerId}.${fileType}`}>
                    <Download />
                    Save to device
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <SheetHeader>
                <SheetTitle>Export flyer</SheetTitle>
                <SheetDescription>Choose a file type and resolution for your {FORMAT_LABELS[format]}.</SheetDescription>
              </SheetHeader>

              <div className="flex items-center justify-between rounded-2xl bg-surface p-4">
                <div>
                  <p className="text-callout text-foreground">{FORMAT_LABELS[format]}</p>
                  <p className="text-caption text-muted-foreground">{dimensions.width} × {dimensions.height} pixels</p>
                </div>
                <span className="text-small text-muted-foreground">1 credit</span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-small font-semibold text-foreground">File type</span>
                <div className="flex gap-2" role="group" aria-label="File type">
                  {(["png", "jpg"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={fileType === item}
                      onClick={() => setFileType(item)}
                      className={`min-h-11 flex-1 rounded-xl text-callout uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring ${fileType === item ? "bg-foreground text-background" : "bg-surface text-muted-foreground hover:bg-surface-2"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-small font-semibold text-foreground">Resolution</span>
                <div className="flex gap-2" role="group" aria-label="Resolution">
                  <button
                    type="button"
                    aria-pressed={scale === 1}
                    onClick={() => setScale(1)}
                    className={`min-h-11 flex-1 rounded-xl text-callout outline-none focus-visible:ring-2 focus-visible:ring-ring ${scale === 1 ? "bg-foreground text-background" : "bg-surface text-muted-foreground hover:bg-surface-2"}`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    aria-pressed={scale === 2}
                    onClick={() => setScale(2)}
                    className={`min-h-11 flex-1 rounded-xl text-callout outline-none focus-visible:ring-2 focus-visible:ring-ring ${scale === 2 ? "bg-foreground text-background" : "bg-surface text-muted-foreground hover:bg-surface-2"}`}
                  >
                    High resolution
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-surface p-4">
                <span className="text-small text-muted-foreground">Balance after export</span>
                <span className="text-price tabular text-foreground">{afterBalance} credits</span>
              </div>

              {error && (
                <Alert variant="danger">
                  <div className="flex items-start gap-3">
                    <CircleAlert className="mt-0.5 size-5 shrink-0" />
                    <div>
                      <AlertTitle>Export could not finish</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </div>
                  </div>
                </Alert>
              )}

              <SheetFooter className="mt-0">
                <Button type="button" variant="brand" size="lg" className="w-full" onClick={handleExport} disabled={working || balance < 1}>
                  {working && <Loader2 className="animate-spin" />}
                  {working ? "Exporting flyer…" : "Export flyer"}
                </Button>
                <p className="text-center text-caption text-muted-foreground">This export uses 1 credit. Previews and re-downloads are free.</p>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
