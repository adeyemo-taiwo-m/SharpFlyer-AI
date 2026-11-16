import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";

import { createCoreDataStoreState } from "@/server/db/client";
import {
  cleanupOrphanedAndSoftDeletedAssets,
  confirmUpload,
  createSignedDownloadUrl,
  createStorageServiceState,
  requestUploadUrl,
  uploadBytesToSession,
} from "@/server/storage";
import { validateUploadedBytes } from "@/server/storage/validate-file";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

async function makeValidPngBuffer(width = 120, height = 80): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 11, g: 31, b: 58, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe("Step 3.4: Storage and server-side upload validation pipeline", () => {
  let dbState = createCoreDataStoreState();
  let storageState = createStorageServiceState();

  beforeEach(() => {
    dbState = createCoreDataStoreState();
    storageState = createStorageServiceState();
  });

  it("rejects wrong MIME types and disallows SVG for product images", () => {
    const svgProduct = requestUploadUrl(
      USER_A,
      {
        kind: "product_image",
        fileName: "inverter.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 1200,
      },
      { storageState },
    );
    expect(svgProduct.ok).toBe(false);
    if (!svgProduct.ok) expect(svgProduct.error.code).toBe("UPLOAD_INVALID");

    const pdfUpload = requestUploadUrl(
      USER_A,
      {
        kind: "logo",
        fileName: "flyer.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1200,
      },
      { storageState },
    );
    expect(pdfUpload.ok).toBe(false);
  });

  it("enforces 5 MB limit for logos and 10 MB limit for product images", async () => {
    const oversizedLogoReq = requestUploadUrl(
      USER_A,
      {
        kind: "logo",
        fileName: "huge-logo.png",
        mimeType: "image/png",
        sizeBytes: 5 * 1024 * 1024 + 1,
      },
      { storageState },
    );
    expect(oversizedLogoReq.ok).toBe(false);

    const oversizedProductReq = requestUploadUrl(
      USER_A,
      {
        kind: "product_image",
        fileName: "huge-product.png",
        mimeType: "image/png",
        sizeBytes: 10 * 1024 * 1024 + 1,
      },
      { storageState },
    );
    expect(oversizedProductReq.ok).toBe(false);

    // Also test server-side byte verification if client lied about declared size
    const oversizedBytes = Buffer.alloc(5 * 1024 * 1024 + 10, 0x89);
    const byteCheck = await validateUploadedBytes({
      kind: "logo",
      declaredMimeType: "image/png",
      fileName: "logo.png",
      bytes: oversizedBytes,
    });
    expect(byteCheck.ok).toBe(false);
  });

  it("rejects corrupt images and spoofed extensions/MIME types via magic-byte inspection", async () => {
    // Spoofed extension: claims to be image/png with .png extension, but bytes are plain text / executable
    const spoofed = await validateUploadedBytes({
      kind: "product_image",
      declaredMimeType: "image/png",
      fileName: "battery.png",
      bytes: Buffer.from("MZ-fake-executable-content-not-a-png", "utf8"),
    });
    expect(spoofed.ok).toBe(false);
    if (!spoofed.ok) expect(spoofed.error.code).toBe("UPLOAD_INVALID");

    // Corrupt PNG: has PNG magic header, but body is truncated/invalid so sharp fails to decode
    const corruptPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02]);
    const corruptRes = await validateUploadedBytes({
      kind: "product_image",
      declaredMimeType: "image/png",
      fileName: "corrupt.png",
      bytes: corruptPng,
    });
    expect(corruptRes.ok).toBe(false);

    // Declared JPEG but actual bytes are PNG
    const validPng = await makeValidPngBuffer(64, 64);
    const mismatchRes = await validateUploadedBytes({
      kind: "logo",
      declaredMimeType: "image/jpeg",
      fileName: "logo.jpg",
      bytes: validPng,
    });
    expect(mismatchRes.ok).toBe(false);
  });

  it("rejects malicious SVG payloads and accepts clean SVG logos", async () => {
    const scriptSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><script>alert(1)</script></svg>`,
      "utf8",
    );
    const onLoadSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" onload="alert(1)"><rect width="100" height="50"/></svg>`,
      "utf8",
    );
    const foreignObjectSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><foreignObject><div>XSS</div></foreignObject></svg>`,
      "utf8",
    );

    for (const payload of [scriptSvg, onLoadSvg, foreignObjectSvg]) {
      const res = await validateUploadedBytes({
        kind: "logo",
        declaredMimeType: "image/svg+xml",
        fileName: "evil.svg",
        bytes: payload,
      });
      expect(res.ok).toBe(false);
    }

    const cleanSvg = Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?><!-- comment --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><rect width="200" height="60" fill="#0B1F3A"/></svg>`,
      "utf8",
    );
    const cleanRes = await validateUploadedBytes({
      kind: "logo",
      declaredMimeType: "image/svg+xml",
      fileName: "brand.svg",
      bytes: cleanSvg,
    });
    expect(cleanRes.ok).toBe(true);
    if (cleanRes.ok) {
      expect(cleanRes.value.width).toBe(200);
      expect(cleanRes.value.height).toBe(60);
      expect(cleanRes.value.sanitizedBytes.toString("utf8")).not.toContain("<!--");
    }
  });

  it("handles interrupted uploads with retry/resume and creates an asset with signed download URLs", async () => {
    const validPng = await makeValidPngBuffer(240, 120);

    const sessionRes = requestUploadUrl(
      USER_A,
      {
        kind: "product_image",
        fileName: "inverter.png",
        mimeType: "image/png",
        sizeBytes: validPng.length,
      },
      { storageState },
    );
    expect(sessionRes.ok).toBe(true);
    if (!sessionRes.ok) return;

    // Attempt 1: interrupted upload (only half of the bytes arrived)
    const partialBytes = validPng.subarray(0, Math.floor(validPng.length / 2));
    uploadBytesToSession(USER_A, sessionRes.value.uploadId, partialBytes, { storageState });

    const prematureConfirm = await confirmUpload(USER_A, sessionRes.value.uploadId, {
      storageState,
      dbState,
    });
    expect(prematureConfirm.ok).toBe(false);
    if (!prematureConfirm.ok) expect(prematureConfirm.error.code).toBe("UPLOAD_INVALID");

    // Attempt 2: client retries/resumes the upload with full bytes
    const retryUpload = uploadBytesToSession(USER_A, sessionRes.value.uploadId, validPng, {
      storageState,
    });
    expect(retryUpload.ok).toBe(true);

    const confirmed = await confirmUpload(USER_A, sessionRes.value.uploadId, {
      storageState,
      dbState,
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    expect(confirmed.value.width).toBe(240);
    expect(confirmed.value.height).toBe(120);
    expect(confirmed.value.size_bytes).toBe(validPng.length);
    expect(confirmed.value.hash).toHaveLength(64);

    // Signed download URL works for owner and is denied for another user
    const ownerSignedUrl = createSignedDownloadUrl(USER_A, confirmed.value.id, { dbState });
    expect(ownerSignedUrl.ok).toBe(true);

    const otherUserSignedUrl = createSignedDownloadUrl(USER_B, confirmed.value.id, { dbState });
    expect(otherUserSignedUrl.ok).toBe(false);

    // Cleanup removes expired sessions
    const cleanupSummary = cleanupOrphanedAndSoftDeletedAssets({
      storageState,
      dbState,
      nowMs: Date.now() + 60 * 60 * 1000,
    });
    expect(cleanupSummary.expiredPendingRemoved).toBe(0);
  });
});
