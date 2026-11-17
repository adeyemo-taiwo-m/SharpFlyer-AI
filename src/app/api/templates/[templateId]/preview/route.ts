import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { FORMAT_SIZES, type FlyerFormat } from "@/schemas/format";
import { getDefaultRenderClient } from "@/server/render/client";
import { loadTemplate } from "@/server/templates/load";

const previewCache = new Map<string, Buffer>();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await context.params;
  const formatParam = request.nextUrl.searchParams.get("format");
  const themeParam = request.nextUrl.searchParams.get("theme");
  const sample = request.nextUrl.searchParams.get("sample") === "before" ? "before" : "after";

  const loadedRes = await loadTemplate(templateId);
  if (!loadedRes.ok) {
    return NextResponse.json({ ok: false, error: loadedRes.error }, { status: 404 });
  }

  const { template } = loadedRes.value;
  const supportedFormats = Object.keys(template.formats) as FlyerFormat[];
  const format: FlyerFormat =
    formatParam && supportedFormats.includes(formatParam as FlyerFormat)
      ? (formatParam as FlyerFormat)
      : (supportedFormats[0] ?? "ig_post");
  const themeId =
    themeParam && template.palettes.some((p) => p.id === themeParam)
      ? themeParam
      : template.palettes[0]!.id;

  const cacheKey = `${template.meta.id}@${template.meta.version}:${format}:${themeId}:${sample}`;
  const cached = previewCache.get(cacheKey);
  if (cached) {
    return new NextResponse(new Uint8Array(cached), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const renderClient = getDefaultRenderClient();
  const sampleContent = {
    headline: sample === "before" ? "Your offer here" : "5kVA Inverter + Tubeless Battery Bundle",
    body: sample === "before" ? "Add a clear offer and your business details." : "Reliable backup power for home and office. Installation included.",
    price: 85_000_000, // ₦850,000
    oldPrice: 95_000_000, // ₦950,000
    currency: "NGN",
    phone: sample === "before" ? "+2348012345678" : "+2348031234567",
    businessName: sample === "before" ? "Your business" : "Lagos Solar Hub",
    address: sample === "before" ? "Your location" : "14 Allen Avenue, Ikeja, Lagos",
    productImageAssetIds: [],
    imagePosition: { x: 0, y: 0 },
    themeId,
    format,
  };
  if (sample === "before") {
    delete (sampleContent as { price?: number; oldPrice?: number }).price;
    delete (sampleContent as { price?: number; oldPrice?: number }).oldPrice;
  }

  const renderRes = await renderClient.render({
    jobId: `template-thumb-${createHash("md5").update(cacheKey).digest("hex")}`,
    templateId: template.meta.id,
    templateVersion: template.meta.version,
    format,
    scale: 1,
    content: sampleContent,
    assets: { productImageUrls: [] },
    themeId,
    purpose: "preview",
    fileType: "png",
  });

  if (!renderRes.ok) {
    const dims = FORMAT_SIZES[format];
    return NextResponse.json(
      { ok: false, error: renderRes.error, width: dims.width, height: dims.height },
      { status: 422 },
    );
  }

  previewCache.set(cacheKey, renderRes.value.outputBuffer);
  return new NextResponse(new Uint8Array(renderRes.value.outputBuffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
