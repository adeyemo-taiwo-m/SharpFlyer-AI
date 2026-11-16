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
