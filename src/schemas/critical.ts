export const CRITICAL_FIELD_KEYS = ["businessName", "price", "oldPrice", "phone", "address", "logo"] as const;

export type CriticalFieldKey = (typeof CRITICAL_FIELD_KEYS)[number];
