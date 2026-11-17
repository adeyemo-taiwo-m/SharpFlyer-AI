"use client";

import * as React from "react";

import { confirmAssetUploadAction, requestAssetUploadAction } from "@/app/actions/flyers";
import { UploadDropzone, type UploadState } from "@/components/sharpflyer/upload-dropzone";

export function BrandLogoUpload({
  assetId,
  previewUrl,
  onChange,
}: {
  assetId?: string | null;
  previewUrl?: string | null;
  onChange: (assetId: string | null, previewUrl: string | null) => void;
}) {
  const [state, setState] = React.useState<UploadState>(() => assetId ? { status: "done", progress: 100, fileName: "Saved logo", previewUrl: previewUrl ?? undefined } : { status: "idle", progress: 0 });
  const requestRef = React.useRef<XMLHttpRequest | null>(null);

  async function upload(file: File) {
    setState({ status: "uploading", progress: 0, fileName: file.name, sizeBytes: file.size });
    const request = await requestAssetUploadAction({ kind: "logo", fileName: file.name, mimeType: file.type as "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml", sizeBytes: file.size });
    if (!request.ok) {
      setState({ status: "error", progress: 0, fileName: file.name, error: request.error.message });
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      requestRef.current = xhr;
      xhr.open("PUT", request.value.uploadUrl);
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) setState((current) => ({ ...current, progress: Math.round((event.loaded / event.total) * 100) })); };
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The logo upload could not be completed."));
      xhr.onerror = () => reject(new Error("The logo upload could not be completed."));
      xhr.onabort = () => reject(new Error("Upload cancelled."));
      xhr.send(file);
    }).then(async () => {
      const confirmed = await confirmAssetUploadAction(request.value.uploadId);
      if (!confirmed.ok) throw new Error(confirmed.error.message);
      onChange(confirmed.value.asset.id, confirmed.value.signedUrl);
      setState({ status: "done", progress: 100, fileName: file.name, sizeBytes: file.size, previewUrl: confirmed.value.signedUrl });
    }).catch((error: unknown) => {
      setState({ status: "error", progress: 0, fileName: file.name, error: error instanceof Error ? error.message : "The logo upload could not be completed." });
    }).finally(() => { requestRef.current = null; });
  }

  function cancel() {
    requestRef.current?.abort();
    setState({ status: "idle", progress: 0 });
  }

  function remove() {
    onChange(null, null);
    setState({ status: "idle", progress: 0 });
  }

  return <UploadDropzone kind="logo" state={state} onFile={(file) => void upload(file)} onCancel={cancel} onRemove={remove} />;
}
