"use client";

import * as React from "react";
import { ImagePlus, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UploadState = {
  status: "idle" | "uploading" | "done" | "error";
  progress: number;
  fileName?: string;
  sizeBytes?: number;
  previewUrl?: string;
  error?: string;
};

export function UploadDropzone({
  kind,
  state,
  onFile,
  onCancel,
  onRemove,
}: {
  kind: "logo" | "product_image";
  state: UploadState;
  onFile: (file: File) => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const inputId = `upload-${kind}`;
  const title = kind === "logo" ? "Add your logo" : "Add a product image";
  const hint = kind === "logo" ? "PNG, JPG, SVG or WebP. Up to 5 MB." : "PNG, JPG or WebP. Up to 10 MB.";

  if (state.status === "done") {
    return (
      <div className="flex items-center gap-3 rounded-[20px] bg-surface p-3">
        {state.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.previewUrl} alt="" className="size-16 rounded-xl object-contain bg-background" />
        ) : (
          <span className="inline-flex size-16 items-center justify-center rounded-xl bg-background text-muted-foreground">
            <ImagePlus className="size-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-callout text-foreground">{state.fileName ?? title}</p>
          {state.sizeBytes !== undefined && (
            <p className="text-caption text-muted-foreground">{formatBytes(state.sizeBytes)}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <label htmlFor={inputId} className="inline-flex">
            <span className="inline-flex h-9 cursor-pointer items-center rounded-full px-3 text-small text-foreground hover:bg-surface-2 focus-within:ring-2 focus-within:ring-ring">
              Replace
            </span>
          </label>
          <button
            type="button"
            aria-label={`Remove ${kind === "logo" ? "logo" : "product image"}`}
            className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-danger-tint hover:text-danger-text focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        <input
          id={inputId}
          type="file"
          accept={kind === "logo" ? "image/png,image/jpeg,image/webp,image/svg+xml" : "image/png,image/jpeg,image/webp"}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.currentTarget.value = "";
          }}
        />
      </div>
    );
  }

  if (state.status === "uploading") {
    return (
      <div className="flex min-h-[120px] flex-col justify-center gap-3 rounded-[20px] bg-surface p-5">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-brand" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-callout text-foreground">Uploading {state.fileName}</p>
            <p className="text-caption text-muted-foreground">{state.progress}% uploaded</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-label="Upload progress">
          <div className="h-full bg-brand transition-[width]" style={{ width: `${state.progress}%` }} />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-[120px] flex-col justify-center gap-3 rounded-[20px] bg-danger-tint p-5 text-danger-text">
        <p className="text-callout">{state.error ?? "This file could not be uploaded."}</p>
        <label htmlFor={inputId} className="inline-flex">
          <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-background px-4 text-small text-foreground hover:bg-surface focus-within:ring-2 focus-within:ring-ring">
            <RotateCcw className="size-4" />
            Try again
          </span>
        </label>
        <input
          id={inputId}
          type="file"
          accept={kind === "logo" ? "image/png,image/jpeg,image/webp,image/svg+xml" : "image/png,image/jpeg,image/webp"}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.currentTarget.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] bg-surface px-5 py-6 text-center outline-none transition-colors hover:bg-surface-2 focus-within:ring-2 focus-within:ring-ring",
      )}
    >
      <Upload className="size-6 text-muted-foreground" />
      <span className="text-callout text-foreground">{title}</span>
      <span className="text-caption text-muted-foreground">{hint}</span>
      <input
        id={inputId}
        type="file"
        accept={kind === "logo" ? "image/png,image/jpeg,image/webp,image/svg+xml" : "image/png,image/jpeg,image/webp"}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.currentTarget.value = "";
        }}
      />
    </label>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
