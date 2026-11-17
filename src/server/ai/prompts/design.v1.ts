import type { DesignPromptRequest } from "@/server/ai/schemas";
import { redactSensitiveFacts } from "@/server/ai/filters";

export const DESIGN_PROMPT_VERSION = "design.v1";

export function buildDesignPrompt(input: DesignPromptRequest): string {
  return [
    `Prompt version: ${DESIGN_PROMPT_VERSION}`,
    "Return only a structured design specification. Never return HTML, CSS, SVG, JavaScript, coordinates, raw colors, or markup.",
    `<business-type>${redactSensitiveFacts(input.businessType)}</business-type>`,
    `<offer-facts>${redactSensitiveFacts(input.offerFacts)}</offer-facts>`,
    `<design-request>${redactSensitiveFacts(input.prompt)}</design-request>`,
    `Tone: ${input.tone}. Headline limit: ${input.headlineMaxLength}. Body limit: ${input.bodyMaxLength}.`,
    "Use only the approved archetypes, palette IDs, fonts, field references, and emphasis values supplied by the system.",
    "Critical values such as prices, phone numbers, addresses, business names, and logos are never generated; reference fields only.",
    "Use background kind solid unless an existing approved asset is explicitly available.",
  ].join("\n");
}
