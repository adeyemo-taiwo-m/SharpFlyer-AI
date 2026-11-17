"use server";

import { headers } from "next/headers";

import {
  designFromPrompt,
  reviseDesign,
  suggestCopy,
  type CopySuggestionsResult,
  type DesignFromPromptResult,
  type DesignRevisionResult,
} from "@/server/ai";
import type { AppError } from "@/lib/errors";
import type { Result } from "@/types/result";

export async function suggestCopyAction(input: unknown): Promise<Result<CopySuggestionsResult, AppError>> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || headerStore.get("x-real-ip") || "unknown-ip";
  return suggestCopy(input, { ip });
}

function requestIp(headerStore: Headers): string {
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
}

export async function designFromPromptAction(input: unknown): Promise<Result<DesignFromPromptResult, AppError>> {
  const headerStore = await headers();
  return designFromPrompt(input, { ip: requestIp(headerStore) });
}

export async function reviseDesignAction(input: unknown): Promise<Result<DesignRevisionResult, AppError>> {
  const headerStore = await headers();
  return reviseDesign(input, { ip: requestIp(headerStore) });
}
