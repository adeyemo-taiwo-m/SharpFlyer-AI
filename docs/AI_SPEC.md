# SharpFlyer AI specification

This specification will document provider interfaces, versioned prompts, output schemas, evaluation fixtures, limits, fallbacks, and cost logging for AI-assisted features.

All AI calls must pass through `src/server/ai`, validate output with Zod, and leave the user able to finish a flyer without AI.
