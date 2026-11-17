import type { FlyerContent } from "@/schemas/flyer";
import type { FlyerFormat } from "@/schemas/format";
import type { Template } from "@/schemas/template";

export type TemplateLicense = Template["meta"]["license"];

export type OnboardingState = "not_started" | "in_progress" | "completed" | "skipped";
export type ThemePreference = "light" | "dark" | "system";
export type TemplateStatus = "draft" | "published" | "archived";
export type AssetKind = "logo" | "product_image" | "background" | "preview" | "export";
export type StorageBucketName = "uploads" | "renders";
export type AllowedUploadMime = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
export type FlyerStatus = "draft" | "rendered" | "exported";
export type CreditReason = "grant" | "purchase" | "export" | "refund" | "adjustment";
export type PaymentProduct = "credit_pack" | "subscription";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "abandoned";
export type SubscriptionStatus = "incomplete" | "active" | "past_due" | "grace" | "cancelled";
export type WebhookEventStatus = "pending" | "processed" | "ignored" | "failed";
export type AiRequestKind = "copy_suggestions" | "background_removal";
export type AiRequestStatus =
  | "succeeded"
  | "failed"
  | "timed_out"
  | "refused"
  | "cache_hit"
  | "unavailable";

export type ProfileRow = {
  id: string;
  business_name_default: string | null;
  business_type: string | null;
  onboarding_state: OnboardingState;
  theme_preference: ThemePreference;
  is_admin: boolean;
  starter_credits_granted: boolean;
  created_at: string;
  updated_at: string;
};

export type BrandProfileRow = {
  id: string;
  user_id: string;
  business_name: string;
  phone_e164: string;
  address: string | null;
  logo_asset_id: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  created_at: string;
  updated_at: string;
};

export type TemplateRow = {
  id: string;
  version: number;
  title: string;
  category: string;
  tags: string[];
  style: string;
  formats: FlyerFormat[];
  status: TemplateStatus;
  license: TemplateLicense;
  definition_hash: string;
  created_at: string;
  updated_at: string;
};

export type AssetRow = {
  id: string;
  user_id: string;
  kind: AssetKind;
  bucket: StorageBucketName;
  bucket_path: string;
  hash: string;
  width: number;
  height: number;
  mime_type: AllowedUploadMime;
  size_bytes: number;
  deleted_at: string | null;
  created_at: string;
};

export type FlyerRow = {
  id: string;
  user_id: string;
  title: string;
  template_id: string;
  template_version: number;
  format: FlyerFormat;
  theme_id: string;
  content: FlyerContent;
  status: FlyerStatus;
  preview_asset_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FlyerVersionRow = {
  id: string;
  flyer_id: string;
  user_id: string;
  version_number: number;
  template_id: string;
  template_version: number;
  format: FlyerFormat;
  theme_id: string;
  content_snapshot: FlyerContent;
  export_asset_id: string | null;
  created_at: string;
};

export type CreditLedgerRow = {
  id: string;
  user_id: string;
  delta: number;
  reason: CreditReason;
  reference_id: string;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  user_id: string;
  provider: "paystack";
  product_type: PaymentProduct;
  product_id: string;
  provider_reference: string;
  amount_kobo: number;
  currency: "NGN";
  credits: number;
  status: PaymentStatus;
  checkout_url: string | null;
  failure_reason: string | null;
  provider_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  provider: "paystack";
  provider_reference: string | null;
  provider_token: string | null;
  plan_id: string;
  status: SubscriptionStatus;
  monthly_credits: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type WebhookEventRow = {
  id: string;
  provider: "paystack";
  event_id: string;
  event_type: string;
  status: WebhookEventStatus;
  payload: Record<string, unknown>;
  received_at: string;
  processed_at: string | null;
};

export type AiRequestRow = {
  id: string;
  user_id: string;
  flyer_id: string | null;
  kind: AiRequestKind;
  provider: string;
  model: string | null;
  usage: Record<string, unknown>;
  cost_usd: number | null;
  pricing_checked_at: string | null;
  latency_ms: number;
  status: AiRequestStatus;
  error_code: string | null;
  created_at: string;
};

export const ANALYTICS_EVENT_NAMES = [
  "sign_in_completed",
  "template_viewed",
  "template_selected",
  "flyer_created",
  "draft_saved",
  "preview_generated",
  "preview_failed",
  "export_started",
  "export_succeeded",
  "export_failed",
  "flyer_shared",
  "share_fallback_used",
  "ai_suggestion_requested",
  "ai_suggestion_selected",
  "paid_pilot_payment_succeeded",
  "export_satisfaction_submitted",
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsEventRow = {
  id: string;
  user_id: string | null;
  event: AnalyticsEventName;
  properties: Record<string, string | number | boolean | null>;
  correlation_id: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
};

export type RenderJobResult = "succeeded" | "failed";

export type RenderJobRow = {
  id: string;
  job_id: string;
  correlation_id: string | null;
  user_id: string | null;
  template_id: string;
  template_version: number;
  format: FlyerFormat;
  purpose: "preview" | "export";
  duration_ms: number | null;
  result: RenderJobResult;
  error_code: string | null;
  created_at: string;
};
