import { createAppError, type AppError } from "@/lib/errors";
import { err, type Result } from "@/types/result";
import type { BackgroundRemovalGeneration, CopyGeneration, DesignGeneration, ImageGeneration, LLMProvider, ImageProvider, BackgroundRemovalProvider, RevisionGeneration } from "@/server/ai/providers/types";

export type { BackgroundRemovalGeneration, CopyGeneration, DesignGeneration, ImageGeneration, LLMProvider, ImageProvider, BackgroundRemovalProvider, RevisionGeneration } from "@/server/ai/providers/types";

class UnavailableLLMProvider implements LLMProvider {
  readonly name = "unconfigured";
  readonly model = null;

  async generateCopy(): Promise<Result<CopyGeneration, AppError>> {
    return err(createAppError("AI_UNAVAILABLE", "Copy suggestions are not configured yet. Write your own copy."));
  }

  async generateDesign(): Promise<Result<DesignGeneration, AppError>> {
    return err(createAppError("AI_UNAVAILABLE", "Prompt-to-design is not configured yet. You can start with a template."));
  }

  async generateRevision(): Promise<Result<RevisionGeneration, AppError>> {
    return err(createAppError("AI_UNAVAILABLE", "Natural-language revisions are not configured yet. You can edit the design fields."));
  }
}

class UnavailableImageProvider implements ImageProvider {
  readonly name = "unconfigured";
  readonly model = null;

  async generateImage(): Promise<Result<ImageGeneration, AppError>> {
    return err(createAppError("AI_UNAVAILABLE", "Image generation is not configured yet."));
  }
}

class UnavailableBackgroundRemovalProvider implements BackgroundRemovalProvider {
  readonly name = "unconfigured";
  readonly model = null;

  async removeBackground(): Promise<Result<BackgroundRemovalGeneration, AppError>> {
    return err(createAppError("AI_UNAVAILABLE", "Background removal is not configured yet. You can keep the original image."));
  }
}

export function getDefaultLLMProvider(): LLMProvider {
  return new UnavailableLLMProvider();
}

export function getDefaultImageProvider(): ImageProvider {
  return new UnavailableImageProvider();
}

export function getDefaultBackgroundRemovalProvider(): BackgroundRemovalProvider {
  return new UnavailableBackgroundRemovalProvider();
}
