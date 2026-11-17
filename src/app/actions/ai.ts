"use server";

import { headers } from "next/headers";

import { suggestCopy, type CopySuggestionsResult } from "@/server/ai";
import type { AppError } from "@/lib/errors";
import type { Result } from "@/types/result";

export async function suggestCopyAction(input: unknown): Promise<Result<CopySuggestionsResult, AppError>> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || headerStore.get("x-real-ip") || "unknown-ip";
  return suggestCopy(input, { ip });
}
