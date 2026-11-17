import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth";
import { track } from "@/server/analytics";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error.code }, { status: auth.error.code === "UNAUTHENTICATED" ? 401 : 403 });
  try {
    const body = (await request.json()) as { event?: unknown; properties?: unknown; correlationId?: unknown };
    if (typeof body.event !== "string") return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    const result = await track(body.event as never, body.properties, {
      userId: auth.value.user.id,
      correlationId: typeof body.correlationId === "string" ? body.correlationId.slice(0, 200) : undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.error.code }, { status: 400 });
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

