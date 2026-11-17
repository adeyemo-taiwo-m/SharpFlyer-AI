"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, ChevronDown, ChevronUp, CircleAlert, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  confirmAssetUploadAction,
  generateFlyerPreviewAction,
  requestAssetUploadAction,
  saveDraftAction,
} from "@/app/actions/flyers";
import { suggestCopyAction } from "@/app/actions/ai";
import { ExportSheet } from "@/components/sharpflyer/export-sheet";
import { UploadDropzone, type UploadState } from "@/components/sharpflyer/upload-dropzone";
import { useAppShell } from "@/components/sharpflyer/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { formatNaira, parsePriceInput } from "@/lib/money";
import { normalizePhone, formatPhoneDisplay } from "@/lib/phone";
import { FlyerContentSchema, type FlyerContent } from "@/schemas/flyer";
import { FORMAT_SIZES, type FlyerFormat } from "@/schemas/format";
import type { Template } from "@/schemas/template";
import type { AllowedUploadMimeType } from "@/schemas/upload";
import type { FlyerRow } from "@/types/database";
import type { RenderIssue } from "@/types/render";

const FORMAT_LABELS: Record<FlyerFormat, string> = {
  ig_post: "Post",
  status: "Status",
  story: "Story",
  fb_post: "Facebook",
  a4: "A4",
};

type UploadKind = "logo" | "product_image";
type FlyerFormInput = z.input<typeof FlyerContentSchema>;

export function FlyerEditor({
  flyer,
  template,
  initialPreviewUrl,
}: {
  flyer: FlyerRow;
  template: Template;
  initialPreviewUrl: string | null;
}) {
  const { creditBalance, setCreditBalance, setAutoSaveStatus, openCreditSheet } = useAppShell();
  const headlineMaxLength = template.fields.find((field) => field.key === "headline")?.maxLength ?? 120;
  const businessNameMaxLength = template.fields.find((field) => field.key === "businessName")?.maxLength ?? 120;
  const bodyMaxLength = template.fields.find((field) => field.key === "body")?.maxLength ?? 500;
  const form = useForm<FlyerFormInput, unknown, FlyerContent>({
    resolver: zodResolver(FlyerContentSchema),
    defaultValues: flyer.content as FlyerFormInput,
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    setError,
    clearErrors,
    reset,
    watch,
  } = form;

  const watchedContent = watch();
  const currentSignature = React.useMemo(() => contentSignature(watchedContent as FlyerContent), [watchedContent]);
  const [previewUrl, setPreviewUrl] = React.useState(initialPreviewUrl);
  const [previewSignature, setPreviewSignature] = React.useState(
    initialPreviewUrl ? contentSignature(flyer.content) : null,
  );
  const [warnings, setWarnings] = React.useState<RenderIssue[]>([]);
  const [renderIssues, setRenderIssues] = React.useState<RenderIssue[]>([]);
  const [generating, setGenerating] = React.useState(false);
  const [copySuggestions, setCopySuggestions] = React.useState<Array<{ headline: string; body: string; cta: string }>>([]);
  const [copyWorking, setCopyWorking] = React.useState(false);
  const [copyError, setCopyError] = React.useState<string | null>(null);
  const [offline, setOffline] = React.useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [previewOpen, setPreviewOpen] = React.useState(true);
  const [logoUpload, setLogoUpload] = React.useState<UploadState>(() => initialUploadState(flyer.content.logoAssetId, "Logo saved"));
  const [productUpload, setProductUpload] = React.useState<UploadState>(() => initialUploadState(flyer.content.productImageAssetIds[0], "Product image saved"));
  const uploadRequests = React.useRef(new Map<UploadKind, XMLHttpRequest>());
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(localStorageKey(flyer.id));
    if (stored) {
      try {
        const parsed = FlyerContentSchema.safeParse(JSON.parse(stored));
        if (parsed.success) {
          reset(parsed.data);
          if (contentSignature(parsed.data) !== contentSignature(flyer.content)) {
            queueMicrotask(() => setPreviewSignature(null));
          }
        }
      } catch {
        window.localStorage.removeItem(localStorageKey(flyer.id));
      }
    }
    hydrated.current = true;
  }, [flyer.content, flyer.id, reset]);

  React.useEffect(() => {
    let timeout: number | undefined;
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = form.watch((value) => {
      if (!hydrated.current) return;
      const parsed = FlyerContentSchema.safeParse(value);
      if (!parsed.success) return;
      const nextContent = parsed.data;
      window.localStorage.setItem(localStorageKey(flyer.id), JSON.stringify(nextContent));
      if (timeout !== undefined) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        setAutoSaveStatus("saving");
        void saveDraftAction(flyer.id, nextContent).then((result) => {
          setAutoSaveStatus(result.ok ? "saved" : "idle");
        });
      }, 700);
    });
    return () => {
      subscription.unsubscribe();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [flyer.id, form, setAutoSaveStatus]);

  const bodyValue = watch("body") ?? watch("offer") ?? "";
  const headlineValue = watch("headline") ?? "";
  const businessNameValue = watch("businessName") ?? "";
  const priceValue = watch("price");
  const oldPriceValue = watch("oldPrice");
  const phoneValue = watch("phone") ?? "";
  const themeId = watch("themeId");
  const format = watch("format");
  const hasCurrentPreview = Boolean(previewUrl && previewSignature === currentSignature);
  const blockingIssues = renderIssues.filter((issue) => issue.severity === "error");

  async function generatePreview(values: FlyerContent) {
    setGenerating(true);
    setRenderIssues([]);
    setWarnings([]);
    const result = await generateFlyerPreviewAction(flyer.id, values);
    setGenerating(false);
    if (!result.ok) {
      setRenderIssues(result.error.issues ?? []);
      setWarnings(result.error.warnings ?? []);
      return;
    }
    setPreviewUrl(result.value.previewUrl);
    setPreviewSignature(contentSignature(values));
    setWarnings(result.value.warnings);
  }

  async function requestCopySuggestions() {
    setCopyWorking(true);
    setCopyError(null);
    const result = await suggestCopyAction({
      flyerId: flyer.id,
      businessType: template.meta.category,
      offerFacts: bodyValue || "Create a clear promotional message for this offer.",
      tone: "clear",
      headlineMaxLength,
      bodyMaxLength,
    });
    setCopyWorking(false);
    if (!result.ok) {
      setCopySuggestions([]);
      setCopyError(result.error.message);
      return;
    }
    setCopySuggestions(result.value.suggestions);
  }

  function setPrice(field: "price" | "oldPrice", raw: string) {
    if (raw.length === 0) {
      clearErrors(field);
      setValue(field, undefined, { shouldDirty: true, shouldValidate: true });
      return;
    }
    if (!/^[\d,\s]+$/.test(raw)) {
      setError(field, { type: "validate", message: "Enter a whole-number price without decimals or a negative sign." });
      return;
    }
    const result = parsePriceInput(raw);
    if (!result.ok) {
      setError(field, { type: "validate", message: result.error.message });
      return;
    }
    clearErrors(field);
    setValue(field, result.value, { shouldDirty: true, shouldValidate: true });
  }

  function setPhone(raw: string) {
    if (!raw.trim()) {
      clearErrors("phone");
      setValue("phone", "", { shouldDirty: true, shouldValidate: true });
      return;
    }
    const result = normalizePhone(raw);
    if (result.ok) {
      clearErrors("phone");
      setValue("phone", result.value.e164, { shouldDirty: true, shouldValidate: true });
      return;
    }
    setValue("phone", raw, { shouldDirty: true, shouldValidate: true });
    setError("phone", { type: "validate", message: "Enter a valid phone number, like 0803 123 4567." });
  }

  function setUploadState(kind: UploadKind, update: UploadState | ((previous: UploadState) => UploadState)) {
    if (kind === "logo") setLogoUpload(update);
    else setProductUpload(update);
  }

  async function uploadFile(kind: UploadKind, file: File) {
    const allowed = kind === "logo"
      ? ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
      : ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setUploadState(kind, { status: "error", progress: 0, error: kind === "logo" ? "Upload a PNG, JPG, SVG or WebP logo." : "Upload a PNG, JPG or WebP product image." });
      return;
    }

    const maxBytes = kind === "logo" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadState(kind, { status: "error", progress: 0, error: `File is too large. Upload a file up to ${kind === "logo" ? 5 : 10} MB.` });
      return;
    }

    setUploadState(kind, { status: "uploading", progress: 0, fileName: file.name, sizeBytes: file.size });
    try {
      const request = await requestAssetUploadAction({
        kind,
        fileName: file.name,
        mimeType: file.type as AllowedUploadMimeType,
        sizeBytes: file.size,
      });
      if (!request.ok) throw new Error(request.error.message);

      await uploadWithProgress(request.value.uploadUrl, file, (progress) => {
        setUploadState(kind, (previous) => ({ ...previous, progress }));
      }, uploadRequests, kind);

      const confirmed = await confirmAssetUploadAction(request.value.uploadId);
      if (!confirmed.ok) throw new Error(confirmed.error.message);
      const asset = confirmed.value.asset;
      if (kind === "logo") {
        setValue("logoAssetId", asset.id, { shouldDirty: true, shouldValidate: true });
      } else {
        setValue("productImageAssetIds", [asset.id], { shouldDirty: true, shouldValidate: true });
      }
      setUploadState(kind, { status: "done", progress: 100, fileName: file.name, sizeBytes: file.size, previewUrl: confirmed.value.signedUrl });
    } catch (error) {
      if (error instanceof Error && error.message === "Upload cancelled") {
        setUploadState(kind, { status: "idle", progress: 0 });
        return;
      }
      setUploadState(kind, { status: "error", progress: 0, fileName: file.name, error: error instanceof Error ? error.message : "This file could not be uploaded." });
    }
  }

  function removeUpload(kind: UploadKind) {
    if (kind === "logo") {
      setValue("logoAssetId", undefined, { shouldDirty: true, shouldValidate: true });
      setLogoUpload({ status: "idle", progress: 0 });
    } else {
      setValue("productImageAssetIds", [], { shouldDirty: true, shouldValidate: true });
      setProductUpload({ status: "idle", progress: 0 });
    }
  }

  function cancelUpload(kind: UploadKind) {
    uploadRequests.current.get(kind)?.abort();
  }

  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col lg:min-h-[calc(100dvh-64px)] lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6 lg:min-h-[calc(100dvh-64px)] lg:p-8">
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-callout text-foreground hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={previewOpen}
            onClick={() => setPreviewOpen((open) => !open)}
          >
            {previewOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            {previewOpen ? "Hide preview" : "Show preview"}
          </button>
          {hasCurrentPreview && <span className="text-caption text-success">Preview ready</span>}
        </div>

        {previewOpen && (
          <div className="flex min-h-[360px] flex-1 items-center justify-center rounded-[28px] bg-surface p-4 shadow-1 md:p-6">
            {previewUrl ? (
              <div className="relative flex max-h-full max-w-full items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={`${template.meta.title} flyer preview`}
                  className={`max-h-[58dvh] w-auto max-w-full rounded-[12px] object-contain shadow-2 transition-opacity ${hasCurrentPreview ? "opacity-100" : "opacity-60"}`}
                />
                {!hasCurrentPreview && (
                  <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1.5 text-caption text-muted-foreground shadow-1">
                    Update preview to use these details
                  </span>
                )}
              </div>
            ) : (
              <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                <div className="inline-flex size-12 items-center justify-center rounded-full bg-background text-muted-foreground">
                  <RefreshCw className="size-5" />
                </div>
                <h2 className="text-h3 text-foreground">Your preview will appear here</h2>
                <p className="text-small text-muted-foreground">Add your details, then generate a flyer to check the layout.</p>
              </div>
            )}
            {generating && (
              <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-background px-4 py-2 text-small text-foreground shadow-2">
                <Loader2 className="size-4 animate-spin text-brand" />
                Updating preview
              </div>
            )}
          </div>
        )}

        {generating && <GenerationProgress />}
        {offline && (
          <Alert variant="warning">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0" />
              <div>
                <AlertTitle>You’re offline</AlertTitle>
                <AlertDescription>Your draft is saved on this phone. Reconnect to update the preview.</AlertDescription>
              </div>
            </div>
          </Alert>
        )}
        {warnings.length > 0 && <IssueList variant="warning" title="Review your flyer" issues={warnings} />}
        {renderIssues.length > 0 && <IssueList variant="danger" title="Fix these details before exporting" issues={renderIssues} />}
      </div>

      <form onSubmit={handleSubmit(generatePreview)} className="flex w-full shrink-0 flex-col gap-7 bg-background p-5 pb-28 md:p-8 lg:w-[420px] lg:overflow-y-auto lg:pb-10">
        <div className="flex flex-col gap-2">
          <p className="text-caption text-muted-foreground">{template.meta.title}</p>
          <h1 className="text-h2 text-foreground">Add your details</h1>
          <p className="text-small text-muted-foreground">Your important business information is rendered exactly as entered.</p>
        </div>

        <section className="flex flex-col gap-4" aria-labelledby="content-heading">
          <SectionHeading id="content-heading" title="Content" />
          <Field label="Headline" htmlFor="headline" error={errors.headline?.message} helper={`${headlineValue.length}/${headlineMaxLength} characters`}>
            <Input id="headline" maxLength={headlineMaxLength} {...register("headline")} />
          </Field>
          <Field label="Offer or body" htmlFor="body" optional error={errors.body?.message ?? errors.offer?.message} helper={`${bodyValue.length}/${bodyMaxLength} characters`}>
            <Textarea
              id="body"
              value={bodyValue}
              maxLength={bodyMaxLength}
              onChange={(event) => {
                setValue("body", event.target.value, { shouldDirty: true, shouldValidate: true });
                setValue("offer", undefined, { shouldDirty: true, shouldValidate: true });
              }}
            />
          </Field>
          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-callout text-foreground">Need a starting point?</p>
                <p className="mt-1 text-caption text-muted-foreground">Suggestions are optional and never change your flyer until you choose one.</p>
              </div>
              <MessageSquare className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
            <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => void requestCopySuggestions()} disabled={copyWorking}>
              {copyWorking && <Loader2 className="animate-spin" />}
              {copyWorking ? "Thinking…" : "Suggest headlines"}
            </Button>
            {copyError && <p role="alert" className="text-caption text-danger-text">{copyError}</p>}
            {copySuggestions.length > 0 && (
              <div className="flex flex-col gap-2" aria-label="Headline suggestions">
                {copySuggestions.map((suggestion, index) => (
                  <button key={`${suggestion.headline}-${index}`} type="button" className="flex w-full flex-col gap-1 rounded-xl bg-background p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-surface-2" onClick={() => setValue("headline", suggestion.headline, { shouldDirty: true, shouldValidate: true })}>
                    <span className="text-callout text-foreground">{suggestion.headline}</span>
                    <span className="text-caption text-muted-foreground">{suggestion.headline.length}/{headlineMaxLength} characters · {suggestion.body}</span>
                  </button>
                ))}
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="ghost" size="sm" onClick={() => void requestCopySuggestions()} disabled={copyWorking}>Try again</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCopySuggestions([])}>Write my own</Button>
                </div>
              </div>
            )}
          </div>
          <Field label="Business name" htmlFor="business-name" error={errors.businessName?.message} helper={`${businessNameValue.length}/${businessNameMaxLength} characters`}>
            <Input id="business-name" maxLength={businessNameMaxLength} {...register("businessName")} />
          </Field>
          <div className="flex flex-col gap-2">
            <Label htmlFor="price">Price <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-body text-muted-foreground">₦</span>
              <Input id="price" inputMode="numeric" value={formatPriceInput(priceValue)} onChange={(event) => setPrice("price", event.target.value)} className="pl-9 tabular" />
            </div>
            {priceValue !== undefined && <p className="text-caption text-muted-foreground">Shows as {formatNaira(priceValue)}</p>}
            {errors.price?.message && <FieldError message={errors.price.message} />}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="old-price">Old price <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-body text-muted-foreground">₦</span>
              <Input id="old-price" inputMode="numeric" value={formatPriceInput(oldPriceValue)} onChange={(event) => setPrice("oldPrice", event.target.value)} className="pl-9 tabular" />
            </div>
            {oldPriceValue !== undefined && <p className="text-caption text-muted-foreground">Shows as {formatNaira(oldPriceValue)}</p>}
            {errors.oldPrice?.message && <FieldError message={errors.oldPrice.message} />}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone number</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-md bg-surface-2 px-2 py-1 text-caption text-muted-foreground">+234</span>
              <Input id="phone" inputMode="tel" value={formatPhoneDisplay(phoneValue)} onChange={(event) => setPhone(event.target.value)} className="pl-20" />
            </div>
            <p className="text-caption text-muted-foreground">This number appears on your flyer exactly as shown here.</p>
            {errors.phone?.message && <FieldError message={errors.phone.message} />}
          </div>
          <Field label="Address" htmlFor="address" optional error={errors.address?.message}>
            <Input id="address" {...register("address")} />
          </Field>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="images-heading">
          <SectionHeading id="images-heading" title="Images" />
          <UploadDropzone kind="logo" state={logoUpload} onFile={(file) => void uploadFile("logo", file)} onCancel={() => cancelUpload("logo")} onRemove={() => removeUpload("logo")} />
          <UploadDropzone kind="product_image" state={productUpload} onFile={(file) => void uploadFile("product_image", file)} onCancel={() => cancelUpload("product_image")} onRemove={() => removeUpload("product_image")} />
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="style-heading">
          <SectionHeading id="style-heading" title="Style" />
          <div className="flex flex-wrap gap-3">
            {template.palettes.map((palette) => {
              const selected = palette.id === themeId;
              const primary = palette.roles.primary ?? palette.roles.accent ?? palette.roles.bg;
              return (
                <button
                  key={palette.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setValue("themeId", palette.id, { shouldDirty: true, shouldValidate: true })}
                  className={`flex min-h-11 items-center gap-2 rounded-full px-3 text-callout outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-surface-2 text-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}
                >
                  <span className={`size-6 rounded-full ring-1 ring-black/10 ${selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`} style={{ backgroundColor: primary }} />
                  <span>{palette.id.replaceAll("-", " ")}</span>
                  {selected && <Check className="size-4" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="format-heading">
          <SectionHeading id="format-heading" title="Format" />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(Object.keys(template.formats) as FlyerFormat[]).map((item) => {
              const selected = item === format;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setValue("format", item, { shouldDirty: true, shouldValidate: true })}
                  className={`flex min-w-[88px] shrink-0 flex-col items-start rounded-xl px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-foreground text-background" : "bg-surface text-muted-foreground hover:bg-surface-2"}`}
                >
                  <span className="text-callout">{FORMAT_LABELS[item]}</span>
                  <span className="text-caption opacity-75">{FORMAT_SIZES[item].width} × {FORMAT_SIZES[item].height}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 border-t border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:static lg:border-0 lg:p-0 lg:pb-0">
          <Button type="submit" variant="secondary" size="lg" className="w-full" disabled={generating || offline}>
            {generating && <Loader2 className="animate-spin" />}
            {generating ? "Generating flyer…" : previewUrl ? "Update preview" : "Generate flyer"}
          </Button>
          {blockingIssues.length > 0 && <p className="text-center text-caption text-danger-text">Fix the highlighted issues before exporting.</p>}
          <ExportSheet
            flyerId={flyer.id}
            format={format}
            balance={creditBalance}
            disabled={!hasCurrentPreview || blockingIssues.length > 0 || generating || offline}
            onBalanceChange={setCreditBalance}
            onOpenCredits={openCreditSheet}
          />
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  optional,
  helper,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label} {optional && <span className="font-normal text-muted-foreground">(optional)</span>}</Label>
      {children}
      {helper && <p className="text-caption text-muted-foreground">{helper}</p>}
      {error && <FieldError message={error} />}
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-center gap-1.5 text-small text-danger-text">
      <CircleAlert className="size-4 shrink-0" />
      {message}
    </p>
  );
}

function SectionHeading({ id, title }: { id: string; title: string }) {
  return <h2 id={id} className="text-h4 text-foreground">{title}</h2>;
}

function GenerationProgress() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="text-callout text-foreground">Checking your flyer</span>
        <Loader2 className="size-4 animate-spin text-brand" />
      </div>
      <Progress value={72} aria-label="Generating flyer" />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <span>✓ Preparing your design</span>
        <span>✓ Placing your details</span>
        <span className="text-foreground">Checking your flyer</span>
      </div>
    </div>
  );
}

function IssueList({ variant, title, issues }: { variant: "warning" | "danger"; title: string; issues: RenderIssue[] }) {
  return (
    <Alert variant={variant}>
      <div className="flex items-start gap-3">
        {variant === "danger" ? <CircleAlert className="mt-0.5 size-5 shrink-0" /> : <AlertCircle className="mt-0.5 size-5 shrink-0" />}
        <div className="min-w-0">
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {issues.map((issue, index) => <li key={`${issue.code}-${issue.field ?? index}`}>{issue.message}</li>)}
            </ul>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

function formatPriceInput(value?: number): string {
  if (value === undefined) return "";
  return formatNaira(value).replace(/^[^\d]*/, "");
}

function contentSignature(content: FlyerContent): string {
  return JSON.stringify({
    headline: content.headline,
    body: content.body ?? "",
    offer: content.offer ?? "",
    price: content.price ?? null,
    oldPrice: content.oldPrice ?? null,
    currency: content.currency,
    phone: content.phone,
    businessName: content.businessName,
    address: content.address ?? "",
    logoAssetId: content.logoAssetId ?? null,
    productImageAssetIds: content.productImageAssetIds,
    themeId: content.themeId,
    format: content.format,
  });
}

function localStorageKey(flyerId: string): string {
  return `sharpflyer:draft:${flyerId}`;
}

function initialUploadState(assetId: string | undefined, label: string): UploadState {
  return assetId ? { status: "done", progress: 100, fileName: label } : { status: "idle", progress: 0 };
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
  requests: React.MutableRefObject<Map<UploadKind, XMLHttpRequest>>,
  kind: UploadKind,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    requests.current.set(kind, xhr);
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      requests.current.delete(kind);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("The upload could not be completed. Try again."));
    };
    xhr.onerror = () => {
      requests.current.delete(kind);
      reject(new Error("The upload could not be completed. Try again."));
    };
    xhr.onabort = () => {
      requests.current.delete(kind);
      reject(new Error("Upload cancelled"));
    };
    xhr.send(file);
  });
}
