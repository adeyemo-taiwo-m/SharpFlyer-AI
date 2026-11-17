import type { DesignRevisionRequest } from "@/server/ai/schemas";
import { redactSensitiveFacts } from "@/server/ai/filters";

export const REVISION_PROMPT_VERSION = "revision.v1";

export function buildRevisionPrompt(input: DesignRevisionRequest): string {
  return [
    `Prompt version: ${REVISION_PROMPT_VERSION}`,
    "Return only a structured revision patch. Never return HTML, CSS, SVG, JavaScript, coordinates, or arbitrary values.",
    `<instruction>${redactSensitiveFacts(input.instruction)}</instruction>`,
    `<current-spec>${JSON.stringify(input.currentSpec)}</current-spec>`,
    "Allowed changes are region emphasis, approved palette, or approved layout archetype. Keep critical content as field references.",
    "For requests such as ‘make the price bigger’, return a region_emphasis change for price with emphasis high.",
  ].join("\n");
}
