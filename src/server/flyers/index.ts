import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import { createAppError, type AppError } from "@/lib/errors";
import { FlyerContentSchema, type FlyerContent } from "@/schemas/flyer";
import { FORMAT_SIZES, FormatSchema, type FlyerFormat } from "@/schemas/format";
import { requireUser, requireVerifiedUser, type SessionUser } from "@/server/auth";
import { consumeCredit, refundCredit } from "@/server/credits";
import {
  CoreRepository,
  getDefaultCoreDataStoreState,
  type CoreDataStoreState,
} from "@/server/db/client";
import { getDefaultRenderClient, type RenderClient } from "@/server/render/client";
import {
  createSignedDownloadUrl,
  getDefaultStorageServiceState,
  storeRenderedAsset,
  type StorageServiceState,
} from "@/server/storage";
import { loadTemplate } from "@/server/templates/load";
import type { FlyerRow, FlyerVersionRow } from "@/types/database";
import type { RenderIssue } from "@/types/render";
import type { Template } from "@/schemas/template";
import { err, ok, type Result } from "@/types/result";

export type FlyersServiceOptions = {
  sessionUser?: SessionUser | null;
  state?: CoreDataStoreState;
  storageState?: StorageServiceState;
  renderClient?: RenderClient;
  templateRoot?: string;
};

export type ExportOptions = {
  versionNumber?: number;
  fileType?: "png" | "jpg";
  scale?: 1 | 2;
};

export type PreviewRenderResult = {
  flyer: FlyerRow;
  previewUrl: string;
  warnings: RenderIssue[];
  metrics: {
    durationMs: number;
    minFontSizeUsed: number;
  };
};

export type ExportFlyerResult = {
  flyer: FlyerRow;
  version: FlyerVersionRow;
  downloadUrl: string;
  expiresAtMs: number;
  balanceAfter: number;
  reusedExisting: boolean;
  warnings: RenderIssue[];
};

export type FlyerListItem = FlyerRow & {
  previewUrl: string | null;
};

const createDraftSchema = z.object({
  templateId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Choose a valid template."),
  format: FormatSchema.optional(),
  themeId: z.string().min(1).max(120).optional(),
});

function ensureNonBrowser(): void {
  if (typeof window !== "undefined") {
    throw new Error("Flyers service cannot be imported or called in client code.");
  }
}

function stableContentSignature(
  content: FlyerContent,
  fileType: "png" | "jpg",
  scale: 1 | 2,
): string {
  const canonical = JSON.stringify({
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
    imagePosition: content.imagePosition,
    themeId: content.themeId,
    format: content.format,
    fileType,
    scale,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function resolveAssetDataUrl(
  userId: string,
  assetId: string | undefined,
  dbState: CoreDataStoreState,
  storageState: StorageServiceState,
): string | undefined {
  if (!assetId) return undefined;
  const repo = new CoreRepository({ role: "authenticated", userId }, dbState);
  const assetRes = repo.getAsset(assetId);
  if (!assetRes.ok || assetRes.value.deleted_at) return undefined;

  const bytes = storageState.storedObjects.get(assetRes.value.bucket_path);
  if (!bytes) return undefined;
  return `data:${assetRes.value.mime_type};base64,${bytes.toString("base64")}`;
}

const exportLocks = new Map<string, Promise<void>>();

async function withFlyerExportLock<T>(flyerId: string, fn: () => Promise<T>): Promise<T> {
  const prev = exportLocks.get(flyerId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  exportLocks.set(
    flyerId,
    prev.then(() => current),
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * Creates a new draft flyer pinned to the template's current version and pre-populated with
 * the user's brand profile (if saved) or sensible defaults so the form is immediately ready.
 */
export async function createDraftFromTemplate(
  rawInput: unknown,
  options: FlyersServiceOptions = {},
): Promise<Result<FlyerRow, AppError>> {
  ensureNonBrowser();
  const authRes = await requireUser({
    sessionUser: options.sessionUser,
    state: options.state,
  });
  if (!authRes.ok) return authRes;

  const parsed = createDraftSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      createAppError(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "Choose a valid template.",
      ),
    );
  }

  const templateRes = await loadTemplate(parsed.data.templateId, options.templateRoot);
  if (!templateRes.ok) return templateRes;

  const { template } = templateRes.value;
  const supportedFormats = Object.keys(template.formats) as FlyerFormat[];
  const chosenFormat =
    parsed.data.format && supportedFormats.includes(parsed.data.format)
      ? parsed.data.format
      : (supportedFormats[0] ?? "ig_post");
  const chosenThemeId =
    parsed.data.themeId && template.palettes.some((p) => p.id === parsed.data.themeId)
      ? parsed.data.themeId
      : template.palettes[0]!.id;

  const state = options.state ?? getDefaultCoreDataStoreState();
  const userId = authRes.value.user.id;
  const repo = new CoreRepository({ role: "authenticated", userId }, state);
  const brandRes = repo.getBrandProfile(userId);

  const initialContent: FlyerContent = {
    headline: "5kVA Inverter + Tubeless Battery Bundle",
    body: "Reliable backup power for home and office. Installation included.",
    price: 85_000_000, // ₦850,000 in kobo
    currency: "NGN",
    phone: brandRes.ok ? brandRes.value.phone_e164 : "+2348031234567",
    businessName: brandRes.ok
      ? brandRes.value.business_name
      : (authRes.value.profile.business_name_default ?? "Lagos Solar Hub"),
    address: brandRes.ok && brandRes.value.address ? brandRes.value.address : "Ikeja, Lagos",
    logoAssetId: brandRes.ok && brandRes.value.logo_asset_id ? brandRes.value.logo_asset_id : undefined,
    productImageAssetIds: [],
    imagePosition: { x: 0, y: 0 },
    themeId: chosenThemeId,
    format: chosenFormat,
  };

  return repo.insertFlyer({
    user_id: userId,
    title: template.meta.title,
    template_id: template.meta.id,
    template_version: template.meta.version,
    format: chosenFormat,
    theme_id: chosenThemeId,
    content: initialContent,
    status: "draft",
    preview_asset_id: null,
  });
}

/**
 * Loads a draft flyer and its pinned template definition, enforcing ownership and RLS.
 */
export async function getFlyerDraft(
  flyerId: string,
  options: FlyersServiceOptions = {},
): Promise<
  Result<
    {
      flyer: FlyerRow;
      template: Template;
      previewUrl: string | null;
    },
    AppError
  >
> {
  ensureNonBrowser();
  const authRes = await requireUser({
    sessionUser: options.sessionUser,
    state: options.state,
  });
  if (!authRes.ok) return authRes;

  const state = options.state ?? getDefaultCoreDataStoreState();
  const userId = authRes.value.user.id;
  const repo = new CoreRepository({ role: "authenticated", userId }, state);

  const flyerRes = repo.getFlyer(flyerId);
  if (!flyerRes.ok) return flyerRes;
  const flyer = flyerRes.value;

  const templateRes = await loadTemplate(flyer.template_id, options.templateRoot, flyer.template_version);
  if (!templateRes.ok) return templateRes;

  let previewUrl: string | null = null;
  if (flyer.preview_asset_id) {
    const signed = createSignedDownloadUrl(userId, flyer.preview_asset_id, {
      dbState: state,
    });
    if (signed.ok) {
      previewUrl = signed.value.url;
    }
  }

  return ok({
    flyer,
    template: templateRes.value.template,
    previewUrl,
  });
}

/**
 * Validates and saves draft content (`saveDraft` server logic).
 * Enforces `requireUser()`, ownership check, and `FlyerContentSchema`.
 */
export async function saveDraft(
  flyerId: string,
  rawContent: unknown,
  options: FlyersServiceOptions = {},
): Promise<Result<FlyerRow, AppError>> {
  ensureNonBrowser();
  const authRes = await requireUser({
    sessionUser: options.sessionUser,
    state: options.state,
  });
  if (!authRes.ok) return authRes;

  const parsed = FlyerContentSchema.safeParse(rawContent);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err(
      createAppError("VALIDATION_FAILED", issue?.message ?? "Check the highlighted fields and try again."),
    );
  }

  const state = options.state ?? getDefaultCoreDataStoreState();
  const userId = authRes.value.user.id;
  const repo = new CoreRepository({ role: "authenticated", userId }, state);

  const existingRes = repo.getFlyer(flyerId);
  if (!existingRes.ok) return existingRes;

  const templateRes = await loadTemplate(existingRes.value.template_id, options.templateRoot, existingRes.value.template_version);
  if (!templateRes.ok) return templateRes;

  const { template } = templateRes.value;
  const headlineDef = template.fields.find((f) => f.key === "headline");
  if (headlineDef?.maxLength && parsed.data.headline.length > headlineDef.maxLength) {
    return err(
      createAppError(
        "VALIDATION_FAILED",
        `Your headline is too long for this design. Keep it within ${headlineDef.maxLength} characters.`,
      ),
    );
  }

  return repo.updateFlyer(flyerId, {
    title: parsed.data.headline.slice(0, 120),
    format: parsed.data.format,
    theme_id: parsed.data.themeId,
    content: parsed.data,
  });
}

/**
 * Validates draft content and requests a preview render (`purpose: 'preview'`, `scale: 1`)
 * using the exact same template version, content, and engine as export.
 * Never consumes credits.
 */
export async function requestPreviewRender(
  flyerId: string,
  rawContent: unknown,
  options: FlyersServiceOptions = {},
): Promise<
  Result<
    PreviewRenderResult,
    AppError & { warnings?: RenderIssue[]; issues?: RenderIssue[] }
  >
> {
  ensureNonBrowser();
  const savedRes = await saveDraft(flyerId, rawContent, options);
  if (!savedRes.ok) return savedRes;

  const flyer = savedRes.value;
  const state = options.state ?? getDefaultCoreDataStoreState();
  const storageState = options.storageState ?? getDefaultStorageServiceState();
  const renderClient = options.renderClient ?? getDefaultRenderClient();
  const userId = flyer.user_id;

  const logoUrl = resolveAssetDataUrl(userId, flyer.content.logoAssetId, state, storageState);
  const productImageUrls = flyer.content.productImageAssetIds
    .map((id) => resolveAssetDataUrl(userId, id, state, storageState))
    .filter((u): u is string => Boolean(u));

  const renderRes = await renderClient.render({
    jobId: `preview-${flyer.id}-${randomUUID()}`,
    templateId: flyer.template_id,
    templateVersion: flyer.template_version,
    format: flyer.content.format,
    scale: 1,
    content: flyer.content,
    assets: {
      logoUrl,
      productImageUrls,
    },
    themeId: flyer.content.themeId,
    purpose: "preview",
    fileType: "png",
  });

  if (!renderRes.ok) {
    return renderRes;
  }

  const dimensions = FORMAT_SIZES[flyer.content.format];
  const hash = createHash("sha256").update(renderRes.value.outputBuffer).digest("hex");
  const assetRes = await storeRenderedAsset({
    userId,
    kind: "preview",
    mimeType: "image/png",
    bytes: renderRes.value.outputBuffer,
    width: dimensions.width,
    height: dimensions.height,
    hash,
    storageState,
    dbState: state,
  });
  if (!assetRes.ok) return assetRes;

  const repo = new CoreRepository({ role: "authenticated", userId }, state);
  const updatedFlyerRes = repo.updateFlyer(flyer.id, {
    status: "rendered",
    preview_asset_id: assetRes.value.id,
  });
  if (!updatedFlyerRes.ok) return updatedFlyerRes;

  const signedRes = createSignedDownloadUrl(userId, assetRes.value.id, {
    dbState: state,
  });
  if (!signedRes.ok) return signedRes;

  return ok({
    flyer: updatedFlyerRes.value,
    previewUrl: signedRes.value.url,
    warnings: renderRes.value.warnings,
    metrics: renderRes.value.metrics,
  });
}

/**
 * Exports a flyer (`exportFlyer(flyerId, version)`):
 * 1. `requireVerifiedUser()`, verify ownership and verified account.
 * 2. Re-download of an existing version (or identical content snapshot) is free.
 * 3. Validate content again server-side.
 * 4. Create the `flyer_version` and call `consume_credit` in one transaction path.
 * 5. Render final resolution through the full-resolution validator; if the render or validation fails
 *    after deduction, insert a refund ledger row in the same failure path.
 * 6. Store the export, return a short-lived signed download URL.
 */
export async function exportFlyer(
  flyerId: string,
  exportInput: ExportOptions | number = {},
  options: FlyersServiceOptions = {},
): Promise<Result<ExportFlyerResult, AppError & { issues?: RenderIssue[] }>> {
  ensureNonBrowser();
  const normalizedOptions: ExportOptions =
    typeof exportInput === "number" ? { versionNumber: exportInput } : exportInput;
  const fileType = normalizedOptions.fileType ?? "png";
  const scale = normalizedOptions.scale ?? 1;

  const authRes = await requireVerifiedUser({
    sessionUser: options.sessionUser,
    state: options.state,
  });
  if (!authRes.ok) return authRes;

  const state = options.state ?? getDefaultCoreDataStoreState();
  const storageState = options.storageState ?? getDefaultStorageServiceState();
  const renderClient = options.renderClient ?? getDefaultRenderClient();
  const userId = authRes.value.user.id;
  const userRepo = new CoreRepository({ role: "authenticated", userId }, state);
  const serviceRepo = new CoreRepository({ role: "service_role" }, state);

  return withFlyerExportLock(flyerId, async () => {
    const flyerRes = userRepo.getFlyer(flyerId);
    if (!flyerRes.ok) return flyerRes;
    const flyer = flyerRes.value;

    const versionsRes = userRepo.listFlyerVersions(flyer.id);
    if (!versionsRes.ok) return versionsRes;
    const existingVersions = versionsRes.value;

    // 1. Check if re-downloading a specific existing version number
    if (normalizedOptions.versionNumber !== undefined) {
      const requestedVersion = existingVersions.find(
        (v) => v.version_number === normalizedOptions.versionNumber && v.export_asset_id,
      );
      if (requestedVersion && requestedVersion.export_asset_id) {
        const signed = createSignedDownloadUrl(userId, requestedVersion.export_asset_id, {
          dbState: state,
        });
        if (!signed.ok) return signed;

        const { getBalance } = await import("@/server/credits");
        const balRes = await getBalance(userId, { state });
        return ok({
          flyer,
          version: requestedVersion,
          downloadUrl: signed.value.url,
          expiresAtMs: signed.value.expiresAtMs,
          balanceAfter: balRes.ok ? balRes.value : 0,
          reusedExisting: true,
          warnings: [],
        });
      }
    }

    // 2. Validate content server-side
    const parsedContent = FlyerContentSchema.safeParse(flyer.content);
    if (!parsedContent.success) {
      return err(
        createAppError(
          "VALIDATION_FAILED",
          parsedContent.error.issues[0]?.message ?? "Check your flyer details before exporting.",
        ),
      );
    }
    const content = parsedContent.data;

    // Check if an already-exported version has the exact same content snapshot, fileType, and scale
    const requestedSignature = stableContentSignature(content, fileType, scale);
    const matchingExisting = existingVersions.find((v) => {
      if (!v.export_asset_id) return false;
      const assetRes = serviceRepo.getAsset(v.export_asset_id);
      if (!assetRes.ok) return false;
      const existingFileType = assetRes.value.mime_type === "image/jpeg" ? "jpg" : "png";
      const expectedWidth = FORMAT_SIZES[v.format].width * scale;
      if (assetRes.value.width !== expectedWidth) return false;
      return (
        stableContentSignature(v.content_snapshot, existingFileType, scale) === requestedSignature
      );
    });

    if (matchingExisting && matchingExisting.export_asset_id) {
      const signed = createSignedDownloadUrl(userId, matchingExisting.export_asset_id, {
        dbState: state,
      });
      if (!signed.ok) return signed;

      const { getBalance } = await import("@/server/credits");
      const balRes = await getBalance(userId, { state });
      return ok({
        flyer,
        version: matchingExisting,
        downloadUrl: signed.value.url,
        expiresAtMs: signed.value.expiresAtMs,
        balanceAfter: balRes.ok ? balRes.value : 0,
        reusedExisting: true,
        warnings: [],
      });
    }

    // 3. Create flyer_version and consume_credit in one transaction path
    const nextVersionNumber =
      normalizedOptions.versionNumber ??
      (existingVersions.length > 0
        ? Math.max(...existingVersions.map((v) => v.version_number)) + 1
        : 1);

    const versionId = randomUUID();
    const creditReference = `export:${flyer.id}:v${nextVersionNumber}:${versionId}`;

    const consumeRes = await consumeCredit(userId, creditReference, {
      state,
      actor: { role: "service_role" },
    });
    if (!consumeRes.ok) {
      return consumeRes;
    }

    const versionRes = serviceRepo.insertFlyerVersion({
      id: versionId,
      flyer_id: flyer.id,
      user_id: userId,
      version_number: nextVersionNumber,
      template_id: flyer.template_id,
      template_version: flyer.template_version,
      format: content.format,
      theme_id: content.themeId,
      content_snapshot: content,
      export_asset_id: null,
    });

    if (!versionRes.ok) {
      await refundCredit(userId, creditReference, {
        state,
        actor: { role: "service_role" },
      });
      return versionRes;
    }

    // 4. Render final resolution through the output validator
    const logoUrl = resolveAssetDataUrl(userId, content.logoAssetId, state, storageState);
    const productImageUrls = content.productImageAssetIds
      .map((id) => resolveAssetDataUrl(userId, id, state, storageState))
      .filter((u): u is string => Boolean(u));

    const renderRes = await renderClient.render({
      jobId: `export-${versionId}`,
      templateId: flyer.template_id,
      templateVersion: flyer.template_version,
      format: content.format,
      scale,
      content,
      assets: {
        logoUrl,
        productImageUrls,
      },
      themeId: content.themeId,
      purpose: "export",
      fileType,
    });

    if (!renderRes.ok) {
      // Automatic refund in the exact same failure path (Invariant 3 & 8)
      await refundCredit(userId, creditReference, {
        state,
        actor: { role: "service_role" },
      });
      return renderRes;
    }

    // 5. Store the export and return short-lived signed download URL
    const dimensions = FORMAT_SIZES[content.format];
    const hash = createHash("sha256").update(renderRes.value.outputBuffer).digest("hex");
    const mimeType = fileType === "jpg" ? "image/jpeg" : "image/png";
    const assetRes = await storeRenderedAsset({
      userId,
      kind: "export",
      mimeType,
      bytes: renderRes.value.outputBuffer,
      width: dimensions.width * scale,
      height: dimensions.height * scale,
      hash,
      storageState,
      dbState: state,
    });

    if (!assetRes.ok) {
      await refundCredit(userId, creditReference, {
        state,
        actor: { role: "service_role" },
      });
      return assetRes;
    }

    const attachedVersionRes = serviceRepo.attachFlyerVersionExportAsset(
      versionId,
      assetRes.value.id,
    );
    if (!attachedVersionRes.ok) {
      await refundCredit(userId, creditReference, {
        state,
        actor: { role: "service_role" },
      });
      return attachedVersionRes;
    }

    const updatedFlyerRes = userRepo.updateFlyer(flyer.id, {
      status: "exported",
      preview_asset_id: flyer.preview_asset_id ?? assetRes.value.id,
    });
    const finalFlyer = updatedFlyerRes.ok ? updatedFlyerRes.value : flyer;

    const signedRes = createSignedDownloadUrl(userId, assetRes.value.id, {
      dbState: state,
    });
    if (!signedRes.ok) {
      return signedRes;
    }

    return ok({
      flyer: finalFlyer,
      version: attachedVersionRes.value,
      downloadUrl: signedRes.value.url,
      expiresAtMs: signedRes.value.expiresAtMs,
      balanceAfter: consumeRes.value,
      reusedExisting: false,
      warnings: renderRes.value.warnings,
    });
  });
}

export async function listUserFlyers(
  options: FlyersServiceOptions = {},
): Promise<Result<FlyerListItem[], AppError>> {
  ensureNonBrowser();
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;

  const state = options.state ?? getDefaultCoreDataStoreState();
  const userId = authRes.value.user.id;
  const repo = new CoreRepository({ role: "authenticated", userId }, state);
  const flyersRes = repo.listFlyers(userId);
  if (!flyersRes.ok) return flyersRes;

  const items: FlyerListItem[] = [];
  for (const flyer of flyersRes.value) {
    let previewUrl: string | null = null;
    if (flyer.preview_asset_id) {
      const signed = createSignedDownloadUrl(userId, flyer.preview_asset_id, { dbState: state });
      if (signed.ok) previewUrl = signed.value.url;
    }
    items.push({ ...flyer, previewUrl });
  }
  return ok(items);
}

export async function duplicateFlyer(
  flyerId: string,
  options: FlyersServiceOptions = {},
): Promise<Result<FlyerRow, AppError>> {
  ensureNonBrowser();
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;

  const state = options.state ?? getDefaultCoreDataStoreState();
  const userId = authRes.value.user.id;
  const repo = new CoreRepository({ role: "authenticated", userId }, state);
  const sourceRes = repo.getFlyer(flyerId);
  if (!sourceRes.ok) return sourceRes;
  const source = sourceRes.value;

  return repo.insertFlyer({
    user_id: userId,
    title: `${source.title} copy`.slice(0, 120),
    template_id: source.template_id,
    template_version: source.template_version,
    format: source.format,
    theme_id: source.theme_id,
    content: { ...source.content, productImageAssetIds: [...source.content.productImageAssetIds] },
    status: "draft",
    preview_asset_id: null,
  });
}

export async function deleteFlyer(
  flyerId: string,
  options: FlyersServiceOptions = {},
): Promise<Result<true, AppError>> {
  ensureNonBrowser();
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;

  const state = options.state ?? getDefaultCoreDataStoreState();
  const storageState = options.storageState ?? getDefaultStorageServiceState();
  const userId = authRes.value.user.id;
  const repo = new CoreRepository({ role: "authenticated", userId }, state);
  const sourceRes = repo.getFlyer(flyerId);
  if (!sourceRes.ok) return sourceRes;

  const versionsRes = repo.listFlyerVersions(flyerId);
  if (!versionsRes.ok) return versionsRes;
  const serviceRepo = new CoreRepository({ role: "service_role" }, state);
  const assetIds = new Set<string>();
  if (sourceRes.value.preview_asset_id) assetIds.add(sourceRes.value.preview_asset_id);
  for (const version of versionsRes.value) {
    if (version.export_asset_id) assetIds.add(version.export_asset_id);
    state.flyerVersions.delete(version.id);
  }
  for (const assetId of assetIds) {
    const assetRes = serviceRepo.getAsset(assetId);
    if (assetRes.ok) {
      storageState.storedObjects.delete(assetRes.value.bucket_path);
      serviceRepo.deleteAsset(assetId);
    }
  }
  const deletedRes = repo.deleteFlyer(flyerId);
  if (!deletedRes.ok) return deletedRes;
  return ok(true);
}
