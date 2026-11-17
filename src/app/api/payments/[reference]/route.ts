import { NextResponse, type NextRequest } from "next/server";

import { getPaymentStatus } from "@/server/billing";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  const { reference } = await context.params;
  const result = await getPaymentStatus(reference);
  if (!result.ok) {
    const status = result.error.code === "UNAUTHENTICATED" ? 401 : result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, value: result.value });
}
