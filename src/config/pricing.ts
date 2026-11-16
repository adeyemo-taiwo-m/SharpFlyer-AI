/**
 * Single configuration source for starter credits, credit packs, and plan allowances (Decision D8).
 * NOTE: All numeric figures and prices below are proposals [H] to be validated in the paid pilot,
 * never hard-coded elsewhere in the codebase. Money amounts are integers in kobo.
 */

export const STARTER_FREE_CREDITS = 3;

export const EXPORT_CREDIT_COST = 1;

export type CreditPackConfig = {
  id: string;
  name: string;
  credits: number;
  priceKobo: number;
};

export type PlanConfig = {
  id: string;
  name: string;
  monthlyCredits: number;
  priceMonthlyKobo: number;
  features: readonly string[];
};

// Proposed credit packs [H] — amounts in integer kobo
export const CREDIT_PACKS: readonly CreditPackConfig[] = [
  {
    id: "pack-10",
    name: "10 flyer credits",
    credits: 10,
    priceKobo: 500_000, // ₦5,000 proposal [H]
  },
  {
    id: "pack-25",
    name: "25 flyer credits",
    credits: 25,
    priceKobo: 1_000_000, // ₦10,000 proposal [H]
  },
] as const;

// Proposed monthly plans [H] — amounts in integer kobo
export const SUBSCRIPTION_PLANS: readonly PlanConfig[] = [
  {
    id: "starter-monthly",
    name: "Starter",
    monthlyCredits: 15,
    priceMonthlyKobo: 600_000, // ₦6,000 / month proposal [H]
    features: [
      "15 high-resolution flyer exports per month",
      "Saved brand profile and logo",
      "All social and print formats",
    ],
  },
  {
    id: "business-monthly",
    name: "Business",
    monthlyCredits: 50,
    priceMonthlyKobo: 1_500_000, // ₦15,000 / month proposal [H]
    features: [
      "50 high-resolution flyer exports per month",
      "Saved brand profile and logo",
      "Priority headline suggestions and background removal",
    ],
  },
] as const;
