import { NextResponse, type NextRequest } from "next/server";

import { resolveSignedDownload } from "@/server/storage";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await context.params;
  const expires = request.nextUrl.searchParams.get("expires");
  const sig = request.nextUrl.searchParams.get("sig");

  const resolved = resolveSignedDownload(assetId, expires, sig);
  if (!resolved.ok) {
    const status = resolved.error.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json({ ok: false, error: resolved.error }, { status });
  }

  const { asset, bytes } = resolved.value;
  const ext =
    asset.mime_type === "image/jpeg"
      ? "jpg"
      : asset.mime_type === "image/webp"
        ? "webp"
        : asset.mime_type === "image/svg+xml"
          ? "svg"
          : "png";

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": asset.mime_type,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="sharpflyer-${asset.id.slice(0, 8)}.${ext}"`,
    },
  });
}
