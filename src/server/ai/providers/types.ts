import type { AppError } from "@/lib/errors";
import type { CopyRequest } from "@/server/ai/schemas";
import type { Result } from "@/types/result";

export type AiUsage = Record<string, unknown>;

export type CopyGeneration = {
  suggestions: unknown;
  provider: string;
  model: string | null;
  usage: AiUsage;
  costUsd: number | null;
  pricingCheckedAt: string | null;
};

export type BackgroundRemovalGeneration = {
  bytes: Buffer;
  provider: string;
  model: string | null;
  usage: AiUsage;
  costUsd: number | null;
  pricingCheckedAt: string | null;
  artifactScore?: number;
};

export type ImageGeneration = {
  bytes: Buffer;
  provider: string;
  model: string | null;
  usage: AiUsage;
  costUsd: number | null;
  pricingCheckedAt: string | null;
};

export interface LLMProvider {
  readonly name: string;
  readonly model: string | null;
  generateCopy(input: CopyRequest & { prompt: string }, signal: AbortSignal): Promise<Result<CopyGeneration, AppError>>;
}

export interface ImageProvider {
  readonly name: string;
  readonly model: string | null;
  generateImage(input: { prompt: string; signal?: AbortSignal }): Promise<Result<ImageGeneration, AppError>>;
}

export interface BackgroundRemovalProvider {
  readonly name: string;
  readonly model: string | null;
  removeBackground(input: { bytes: Buffer; mimeType: string; signal: AbortSignal }): Promise<Result<BackgroundRemovalGeneration, AppError>>;
}
