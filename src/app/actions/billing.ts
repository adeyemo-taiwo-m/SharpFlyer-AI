"use server";

import {
  cancelSubscription,
  getPaymentStatus,
  startCheckout,
  type CheckoutResult,
  type PaymentStatusResult,
} from "@/server/billing";
import type { AppError } from "@/lib/errors";
import type { SubscriptionRow } from "@/types/database";
import { type Result } from "@/types/result";

export async function startCheckoutAction(input: {
  productType: "credit_pack" | "subscription";
  productId: string;
}): Promise<Result<CheckoutResult, AppError>> {
  return startCheckout(input);
}

export async function getPaymentStatusAction(reference: string): Promise<Result<PaymentStatusResult, AppError>> {
  return getPaymentStatus(reference);
}

export async function cancelSubscriptionAction(): Promise<Result<SubscriptionRow, AppError>> {
  return cancelSubscription();
}
