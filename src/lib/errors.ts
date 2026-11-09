export const APP_ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "INSUFFICIENT_CREDITS",
  "RENDER_FAILED",
  "RENDER_VALIDATION_FAILED",
  "UPLOAD_INVALID",
  "AI_TIMEOUT",
  "AI_INVALID_OUTPUT",
  "AI_LIMIT_REACHED",
  "AI_REFUSED",
  "PAYMENT_FAILED",
  "RATE_LIMITED",
  "INTERNAL",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export type AppError = {
  code: AppErrorCode;
  message: string;
};

export const APP_ERROR_MESSAGES: Record<AppErrorCode, string> = {
  VALIDATION_FAILED: "Check the highlighted fields and try again.",
  UNAUTHENTICATED: "Sign in to continue.",
  FORBIDDEN: "You do not have access to this.",
  NOT_FOUND: "We could not find that item.",
  INSUFFICIENT_CREDITS: "You do not have enough credits to export this flyer.",
  RENDER_FAILED: "We could not create your flyer. No credit was used. Try again.",
  RENDER_VALIDATION_FAILED: "Your flyer needs a small fix before it can be exported.",
  UPLOAD_INVALID: "That file cannot be used. Choose a supported image and try again.",
  AI_TIMEOUT: "Suggestions took too long. You can write your own copy.",
  AI_INVALID_OUTPUT: "Suggestions are not available right now. You can write your own copy.",
  AI_LIMIT_REACHED: "You have reached the suggestion limit for now.",
  AI_REFUSED: "Suggestions are not available for that request. You can write your own copy.",
  PAYMENT_FAILED: "Payment did not go through. Try again.",
  RATE_LIMITED: "Too many requests. Wait a moment and try again.",
  INTERNAL: "Something went wrong. Try again.",
};

export function createAppError(code: AppErrorCode, message = APP_ERROR_MESSAGES[code]): AppError {
  return { code, message };
}
