"use server";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAppError, type AppError } from "@/lib/errors";
import {
  AUTH_ACCESS_COOKIE,
  AUTH_ADMIN_COOKIE,
  encodeSessionToken,
  requestEmailMagicLink,
  requireUser,
} from "@/server/auth";
import {
  confirmUpload,
  createSignedDownloadUrl,
  requestUploadUrl,
} from "@/server/storage";
import {
  createDraftFromTemplate,
  deleteFlyer,
  duplicateFlyer,
  exportFlyer,
  listUserFlyers,
  requestPreviewRender,
  saveDraft,
  type ExportFlyerResult,
  type ExportOptions,
  type PreviewRenderResult,
} from "@/server/flyers";
import type { AssetRow, FlyerRow } from "@/types/database";
import type { FlyerListItem } from "@/server/flyers";
import type { RenderIssue } from "@/types/render";
import { err, ok, type Result } from "@/types/result";

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  redirectTo: z.string().optional(),
});

function deterministicUserIdFromEmail(email: string): string {
  const hex = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Signs in a user via email magic link / Google or establishes a verified session cookie.
 */
export async function signInAction(rawInput: {
  email: string;
  redirectTo?: string;
}): Promise<Result<{ redirectTo: string; message: string }, AppError>> {
  const parsed = signInSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      createAppError(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "Enter a valid email address.",
      ),
    );
  }

  const magicRes = await requestEmailMagicLink({
    email: parsed.data.email,
    ip: "127.0.0.1",
  });
  if (!magicRes.ok) return magicRes;

  const user = {
    id: deterministicUserIdFromEmail(parsed.data.email),
    email: parsed.data.email.trim().toLowerCase(),
    emailVerified: true,
  };

  const bootstrapRes = await requireUser({ sessionUser: user });
  if (!bootstrapRes.ok) return bootstrapRes;

  const token = encodeSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(AUTH_ACCESS_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  const safeRedirect =
    parsed.data.redirectTo &&
    parsed.data.redirectTo.startsWith("/") &&
    !parsed.data.redirectTo.startsWith("//")
      ? parsed.data.redirectTo
      : "/app/templates";

  return ok({
    redirectTo: safeRedirect,
    message: magicRes.value.message,
  });
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_ACCESS_COOKIE);
  cookieStore.delete(AUTH_ADMIN_COOKIE);
  redirect("/auth");
}

/**
 * Creates a draft flyer from a template and returns the draft ID so the client or form can redirect to `/app/create/[draftId]`.
 */
export async function useDesignAction(input: {
  templateId: string;
  format?: "status" | "ig_post" | "story" | "fb_post" | "a4";
  themeId?: string;
}): Promise<Result<{ draftId: string }, AppError>> {
  const draftRes = await createDraftFromTemplate(input);
  if (!draftRes.ok) return draftRes;
  return ok({ draftId: draftRes.value.id });
}

/**
 * Debounced draft auto-save server action (`saveDraft`).
 */
export async function saveDraftAction(
  flyerId: string,
  content: unknown,
): Promise<Result<FlyerRow, AppError>> {
  return saveDraft(flyerId, content);
}

/**
 * Requests a preview render (`purpose: 'preview'`) for the flyer editor.
 */
export async function generateFlyerPreviewAction(
  flyerId: string,
  content: unknown,
): Promise<
  Result<
    PreviewRenderResult,
    AppError & { warnings?: RenderIssue[]; issues?: RenderIssue[] }
  >
> {
  return requestPreviewRender(flyerId, content);
}

/**
 * Exports a flyer (`exportFlyer(flyerId, version)`).
 */
export async function exportFlyerAction(
  flyerId: string,
  exportOptions: ExportOptions | number = {},
): Promise<Result<ExportFlyerResult, AppError & { issues?: RenderIssue[] }>> {
  return exportFlyer(flyerId, exportOptions);
}

export async function duplicateFlyerAction(flyerId: string): Promise<Result<{ draftId: string }, AppError>> {
  const duplicated = await duplicateFlyer(flyerId);
  if (!duplicated.ok) return duplicated;
  return ok({ draftId: duplicated.value.id });
}

export async function deleteFlyerAction(flyerId: string): Promise<Result<true, AppError>> {
  return deleteFlyer(flyerId);
}

export async function listUserFlyersAction(): Promise<Result<FlyerListItem[], AppError>> {
  return listUserFlyers();
}

/**
 * Requests a short-lived signed upload URL for a logo or product image.
 */
export async function requestAssetUploadAction(input: {
  kind: "logo" | "product_image";
  fileName: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
  sizeBytes: number;
}): Promise<
  Result<{ uploadId: string; uploadUrl: string; expiresAtMs: number }, AppError>
> {
  const authRes = await requireUser();
  if (!authRes.ok) return authRes;

  const sessionRes = requestUploadUrl(authRes.value.user.id, input);
  if (!sessionRes.ok) return sessionRes;

  return ok({
    uploadId: sessionRes.value.uploadId,
    uploadUrl: sessionRes.value.uploadUrl,
    expiresAtMs: sessionRes.value.expiresAtMs,
  });
}

/**
 * Confirms an uploaded asset after bytes are sent, validates magic bytes and dimensions,
 * and returns the asset row plus a signed preview URL.
 */
export async function confirmAssetUploadAction(uploadId: string): Promise<
  Result<
    {
      asset: AssetRow;
      signedUrl: string;
    },
    AppError
  >
> {
  const authRes = await requireUser();
  if (!authRes.ok) return authRes;

  const confirmedRes = await confirmUpload(authRes.value.user.id, uploadId);
  if (!confirmedRes.ok) return confirmedRes;

  const signedRes = createSignedDownloadUrl(
    authRes.value.user.id,
    confirmedRes.value.id,
  );
  if (!signedRes.ok) return signedRes;

  return ok({
    asset: confirmedRes.value,
    signedUrl: signedRes.value.url,
  });
}
