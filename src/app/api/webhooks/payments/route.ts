import { NextResponse, type NextRequest } from "next/server";

import { handlePaystackWebhook } from "@/server/billing";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("paystack-signature") ?? request.headers.get("x-paystack-signature");
  const result = await handlePaystackWebhook(rawBody, signature);

  if (!result.ok) {
    const status = result.error.code === "FORBIDDEN" ? 401 : result.error.code === "VALIDATION_FAILED" ? 400 : 502;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, value: result.value });
}
