import { createHmac, randomUUID } from "node:crypto";

import { createAppError, type AppError } from "@/lib/errors";
import { UploadUrlRequestSchema, type AllowedUploadMimeType, type UploadAssetKind } from "@/schemas/upload";
import {
  CoreRepository,
  getDefaultCoreDataStoreState,
  type CoreDataStoreState,
} from "@/server/db/client";
import { validateUploadedBytes } from "@/server/storage/validate-file";
import type { AssetRow, StorageBucketName } from "@/types/database";
import { err, ok, type Result } from "@/types/result";

export type PendingUploadSession = {
  uploadId: string;
  userId: string;
  kind: UploadAssetKind;
  fileName: string;
  declaredMimeType: AllowedUploadMimeType;
  declaredSizeBytes: number;
  bucket: StorageBucketName;
  bucketPath: string;
  uploadUrl: string;
  expiresAtMs: number;
  uploadedBytes?: Buffer;
  attemptCount: number;
};

export type StorageServiceState = {
  pendingUploads: Map<string, PendingUploadSession>;
  storedObjects: Map<string, Buffer>;
};

export function createStorageServiceState(): StorageServiceState {
  return {
    pendingUploads: new Map(),
    storedObjects: new Map(),
  };
}

let defaultStorageState = createStorageServiceState();

export function resetDefaultStorageServiceState(): void {
  defaultStorageState = createStorageServiceState();
}

const EXTENSION_BY_MIME: Record<AllowedUploadMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function signToken(payload: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "local-dev-signing-secret";
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
}

/**
 * Step 1 of Upload Flow:
 * Validates declared MIME type and file size before issuing a short-lived signed upload URL
 * scoped to the user's private folder in the `uploads` bucket.
 */
export function requestUploadUrl(
  userId: string,
  rawInput: unknown,
  options?: { storageState?: StorageServiceState; nowMs?: number },
): Result<PendingUploadSession, AppError> {
  if (!userId.trim()) {
    return err(createAppError("UNAUTHENTICATED"));
  }

  const parsed = UploadUrlRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "This file cannot be uploaded.";
    return err(createAppError("UPLOAD_INVALID", message));
  }

  const storageState = options?.storageState ?? defaultStorageState;
  const nowMs = options?.nowMs ?? Date.now();
  const uploadId = randomUUID();
  const ext = EXTENSION_BY_MIME[parsed.data.mimeType];
  const bucketPath = `${userId}/${parsed.data.kind}/${uploadId}.${ext}`;
  const expiresAtMs = nowMs + 10 * 60 * 1000; // 10-minute short-lived upload URL
  const token = signToken(`upload:${uploadId}:${bucketPath}:${expiresAtMs}`);

  const session: PendingUploadSession = {
    uploadId,
    userId,
    kind: parsed.data.kind,
    fileName: parsed.data.fileName,
    declaredMimeType: parsed.data.mimeType,
    declaredSizeBytes: parsed.data.sizeBytes,
    bucket: "uploads",
    bucketPath,
    uploadUrl: `/api/storage/upload/${uploadId}?token=${token}&expires=${expiresAtMs}`,
    expiresAtMs,
    attemptCount: 0,
  };

  storageState.pendingUploads.set(uploadId, session);
  return ok({ ...session });
}

/**
 * Records raw bytes uploaded by the client (or retries/resumes an interrupted upload before confirmation).
 */
export function uploadBytesToSession(
  userId: string,
  uploadId: string,
  bytes: Buffer,
  options?: { storageState?: StorageServiceState; nowMs?: number },
): Result<{ uploadId: string; receivedBytes: number }, AppError> {
  const storageState = options?.storageState ?? defaultStorageState;
  const session = storageState.pendingUploads.get(uploadId);

  if (!session) {
    return err(createAppError("NOT_FOUND", "Upload session was not found."));
  }
  if (session.userId !== userId) {
    return err(createAppError("FORBIDDEN"));
  }

  const nowMs = options?.nowMs ?? Date.now();
  if (nowMs > session.expiresAtMs) {
    return err(createAppError("UPLOAD_INVALID", "Upload link expired. Request a new upload link."));
  }

  session.attemptCount += 1;
  session.uploadedBytes = bytes;
  return ok({ uploadId, receivedBytes: bytes.length });
}

/**
 * Step 2 of Upload Flow:
 * Verifies the uploaded bytes (size, magic bytes, real dimensions, SVG sanitization),
 * stores the sanitized object in the private `uploads` bucket, and inserts the `assets` row.
 */
export async function confirmUpload(
  userId: string,
  uploadId: string,
  options?: {
    storageState?: StorageServiceState;
    dbState?: CoreDataStoreState;
  },
): Promise<Result<AssetRow, AppError>> {
  const storageState = options?.storageState ?? defaultStorageState;
  const dbState = options?.dbState ?? getDefaultCoreDataStoreState();
  const session = storageState.pendingUploads.get(uploadId);

  if (!session) {
    return err(createAppError("NOT_FOUND", "Upload session was not found."));
  }
  if (session.userId !== userId) {
    return err(createAppError("FORBIDDEN"));
  }
  if (!session.uploadedBytes || session.uploadedBytes.length < session.declaredSizeBytes) {
    return err(
      createAppError(
        "UPLOAD_INVALID",
        "Upload was interrupted before completion. Retry uploading the file.",
      ),
    );
  }

  const validated = await validateUploadedBytes({
    kind: session.kind,
    declaredMimeType: session.declaredMimeType,
    fileName: session.fileName,
    bytes: session.uploadedBytes,
  });

  if (!validated.ok) {
    return validated;
  }

  storageState.storedObjects.set(session.bucketPath, validated.value.sanitizedBytes);
  storageState.pendingUploads.delete(uploadId);

  const repo = new CoreRepository({ role: "authenticated", userId }, dbState);
  return repo.insertAsset({
    user_id: userId,
    kind: session.kind,
    bucket: session.bucket,
    bucket_path: session.bucketPath,
    hash: validated.value.hash,
    width: validated.value.width,
    height: validated.value.height,
    mime_type: validated.value.mimeType,
    size_bytes: validated.value.sizeBytes,
  });
}

/**
 * Generates a short-lived signed download URL for a user-owned asset in `uploads` or `renders`.
 */
export function createSignedDownloadUrl(
  userId: string,
  assetId: string,
  options?: {
    dbState?: CoreDataStoreState;
    expiresInSeconds?: number;
    nowMs?: number;
  },
): Result<{ url: string; expiresAtMs: number }, AppError> {
  const dbState = options?.dbState ?? getDefaultCoreDataStoreState();
  const repo = new CoreRepository({ role: "authenticated", userId }, dbState);
  const assetRes = repo.getAsset(assetId);
  if (!assetRes.ok) return assetRes;

  const asset = assetRes.value;
  if (asset.deleted_at) {
    return err(createAppError("NOT_FOUND", "This file has been deleted."));
  }

  const nowMs = options?.nowMs ?? Date.now();
  const expiresInSeconds = Math.min(Math.max(options?.expiresInSeconds ?? 300, 30), 3600);
  const expiresAtMs = nowMs + expiresInSeconds * 1000;
  const sig = signToken(`download:${asset.id}:${asset.bucket_path}:${expiresAtMs}`);

  return ok({
    url: `/api/storage/download/${asset.id}?expires=${expiresAtMs}&sig=${sig}`,
    expiresAtMs,
  });
}

/**
 * Scheduled job stub (full schedule wired in Phase 11) that removes expired pending uploads
 * and purges soft-deleted assets older than the retention window.
 */
export function cleanupOrphanedAndSoftDeletedAssets(options?: {
  storageState?: StorageServiceState;
  dbState?: CoreDataStoreState;
  nowMs?: number;
}): { expiredPendingRemoved: number; softDeletedPurged: number } {
  const storageState = options?.storageState ?? defaultStorageState;
  const dbState = options?.dbState ?? getDefaultCoreDataStoreState();
  const nowMs = options?.nowMs ?? Date.now();

  let expiredPendingRemoved = 0;
  for (const [id, session] of storageState.pendingUploads.entries()) {
    if (nowMs > session.expiresAtMs) {
      storageState.pendingUploads.delete(id);
      expiredPendingRemoved += 1;
    }
  }

  let softDeletedPurged = 0;
  for (const [assetId, asset] of dbState.assets.entries()) {
    if (asset.deleted_at && new Date(asset.deleted_at).getTime() <= nowMs) {
      storageState.storedObjects.delete(asset.bucket_path);
      dbState.assets.delete(assetId);
      softDeletedPurged += 1;
    }
  }

  return { expiredPendingRemoved, softDeletedPurged };
}
