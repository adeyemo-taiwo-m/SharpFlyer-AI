import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/server/auth";
import { uploadBytesToSession } from "@/server/storage";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ uploadId: string }> },
) {
  const authRes = await requireUser();
  if (!authRes.ok) {
    return NextResponse.json({ ok: false, error: authRes.error }, { status: 401 });
  }

  const { uploadId } = await context.params;
  const arrayBuffer = await request.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  const uploadRes = uploadBytesToSession(authRes.value.user.id, uploadId, bytes);
  if (!uploadRes.ok) {
    const status = uploadRes.error.code === "FORBIDDEN" ? 403 : uploadRes.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, error: uploadRes.error }, { status });
  }

  return NextResponse.json({ ok: true, value: uploadRes.value });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ uploadId: string }> },
) {
  return PUT(request, context);
}
