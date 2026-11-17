import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import { CREDIT_PACKS, SUBSCRIPTION_PLANS, type CreditPackConfig, type PlanConfig } from "@/config/pricing";
import { createAppError, type AppError } from "@/lib/errors";
import { requireUser, type SessionUser } from "@/server/auth";
import { grantCredits } from "@/server/credits";
import {
  CoreRepository,
  getDefaultCoreDataStoreState,
  type CoreDataStoreState,
} from "@/server/db/client";
import {
  getDefaultPaymentProvider,
  verifyPaystackSignature,
  type PaymentProvider,
  type VerifiedTransaction,
} from "@/server/billing/provider";
import type { PaymentRow, SubscriptionRow, WebhookEventRow } from "@/types/database";
import { err, ok, type Result } from "@/types/result";

export { PaystackProvider, verifyPaystackSignature } from "@/server/billing/provider";
export type { PaymentProvider } from "@/server/billing/provider";

export type BillingServiceOptions = {
  sessionUser?: SessionUser | null;
  state?: CoreDataStoreState;
  provider?: PaymentProvider;
  nowMs?: number;
};

export type BillingOverview = {
  balance: number;
  payments: PaymentRow[];
  subscription: SubscriptionRow | null;
};

export type CheckoutResult = {
  checkoutUrl: string;
};

export type PaymentStatusResult = Pick<PaymentRow, "provider_reference" | "status" | "failure_reason" | "paid_at">;

const CheckoutSchema = z.object({
  productType: z.enum(["credit_pack", "subscription"]),
  productId: z.string().trim().min(1).max(80),
});

function withUserLock<T>(state: CoreDataStoreState, userId: string, fn: () => Promise<T>): Promise<T> {
  const previous = state.userLocks.get(`billing:${userId}`) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  state.userLocks.set(`billing:${userId}`, previous.then(() => current));
  return previous.then(async () => {
    try {
      return await fn();
    } finally {
      release();
    }
  });
}

function findProduct(productType: "credit_pack" | "subscription", productId: string): CreditPackConfig | PlanConfig | undefined {
  return productType === "credit_pack"
    ? CREDIT_PACKS.find((item) => item.id === productId)
    : SUBSCRIPTION_PLANS.find((item) => item.id === productId);
}

function productAmount(product: CreditPackConfig | PlanConfig): number {
  return "priceKobo" in product ? product.priceKobo : product.priceMonthlyKobo;
}

function productCredits(product: CreditPackConfig | PlanConfig): number {
  return "credits" in product ? product.credits : product.monthlyCredits;
}

function planCode(productId: string): string | undefined {
  const envKey = productId === "starter-monthly" ? "PAYSTACK_STARTER_PLAN_CODE" : "PAYSTACK_BUSINESS_PLAN_CODE";
  return process.env[envKey];
}

function safeReason(payload: Record<string, unknown>): string {
  const data = typeof payload.data === "object" && payload.data !== null ? payload.data as Record<string, unknown> : payload;
  for (const key of ["gateway_response", "message", "reason"]) {
    if (typeof data[key] === "string" && data[key].trim()) return data[key];
  }
  return "The payment provider reported that this payment failed.";
}

function webhookReference(payload: Record<string, unknown>): string | null {
  const data = typeof payload.data === "object" && payload.data !== null ? payload.data as Record<string, unknown> : {};
  return typeof data.reference === "string" ? data.reference : null;
}

function webhookSubscriptionCode(payload: Record<string, unknown>): string | null {
  const data = typeof payload.data === "object" && payload.data !== null ? payload.data as Record<string, unknown> : {};
  return typeof data.subscription_code === "string"
    ? data.subscription_code
    : typeof data.subscriptionCode === "string"
      ? data.subscriptionCode
      : null;
}

function webhookEventId(payload: Record<string, unknown>, rawBody: string): string {
  if (typeof payload.id === "string" || typeof payload.id === "number") return String(payload.id);
  const event = typeof payload.event === "string" ? payload.event : "unknown";
  const reference = webhookReference(payload) ?? webhookSubscriptionCode(payload) ?? "no-reference";
  return `${event}:${reference}:${createHash("sha256").update(rawBody).digest("hex").slice(0, 16)}`;
}

function extractMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  const data = typeof payload.data === "object" && payload.data !== null ? payload.data as Record<string, unknown> : {};
  return typeof data.metadata === "object" && data.metadata !== null ? data.metadata as Record<string, unknown> : {};
}

export async function getBillingOverview(options: BillingServiceOptions = {}): Promise<Result<BillingOverview, AppError>> {
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const state = options.state ?? getDefaultCoreDataStoreState();
  const repo = new CoreRepository({ role: "authenticated", userId: authRes.value.user.id }, state);
  const paymentsRes = repo.listPayments(authRes.value.user.id);
  const subscriptionRes = repo.getSubscription(authRes.value.user.id);
  if (!paymentsRes.ok) return paymentsRes;
  if (!subscriptionRes.ok) return subscriptionRes;
  const { getBalance } = await import("@/server/credits");
  const balanceRes = await getBalance(authRes.value.user.id, { state, actor: { role: "authenticated", userId: authRes.value.user.id } });
  if (!balanceRes.ok) return balanceRes;
  return ok({
    balance: balanceRes.value,
    payments: paymentsRes.value.map((payment) => ({ ...payment, provider_payload: null })),
    subscription: subscriptionRes.value,
  });
}

export async function startCheckout(
  rawInput: unknown,
  options: BillingServiceOptions = {},
): Promise<Result<CheckoutResult, AppError>> {
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const parsed = CheckoutSchema.safeParse(rawInput);
  if (!parsed.success) return err(createAppError("VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Choose a valid payment option."));

  const product = findProduct(parsed.data.productType, parsed.data.productId);
  if (!product) return err(createAppError("NOT_FOUND", "That payment option is no longer available."));

  const state = options.state ?? getDefaultCoreDataStoreState();
  const serviceRepo = new CoreRepository({ role: "service_role" }, state);
  if (parsed.data.productType === "subscription") {
    if (!planCode(parsed.data.productId)) {
      return err(createAppError("PAYMENT_FAILED", "Monthly plans are not configured yet. Try a credit pack instead."));
    }
    const currentSubscriptionRes = serviceRepo.getSubscription(authRes.value.user.id);
    if (!currentSubscriptionRes.ok) return currentSubscriptionRes;
    const currentSubscription = currentSubscriptionRes.value;
    if (
      currentSubscription &&
      currentSubscription.status !== "cancelled" &&
      !(currentSubscription.status === "incomplete" && currentSubscription.plan_id === parsed.data.productId)
    ) {
      return err(createAppError("PAYMENT_FAILED", "You already have a subscription. Cancel it before choosing another plan."));
    }
  }

  const provider = options.provider ?? getDefaultPaymentProvider();
  const paymentReference = `sf_${randomUUID().replaceAll("-", "")}`;
  const paymentRes = serviceRepo.insertPayment({
    user_id: authRes.value.user.id,
    provider: "paystack",
    product_type: parsed.data.productType,
    product_id: parsed.data.productId,
    provider_reference: paymentReference,
    amount_kobo: productAmount(product),
    currency: "NGN",
    credits: productCredits(product),
    status: "pending",
    checkout_url: null,
    failure_reason: null,
    provider_payload: null,
    paid_at: null,
  });
  if (!paymentRes.ok) return paymentRes;

  let subscriptionId: string | null = null;
  if (parsed.data.productType === "subscription") {
    const subscriptionRes = serviceRepo.insertSubscription({
      user_id: authRes.value.user.id,
      provider: "paystack",
      provider_reference: null,
      provider_token: null,
      plan_id: parsed.data.productId,
      status: "incomplete",
      monthly_credits: productCredits(product),
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
    });
    if (!subscriptionRes.ok) return subscriptionRes;
    subscriptionId = subscriptionRes.value.id;
  }

  const initialized = await provider.initializePayment({
    email: authRes.value.user.email,
    amountKobo: productAmount(product),
    currency: "NGN",
    reference: paymentReference,
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/app/billing?payment=${encodeURIComponent(paymentReference)}`,
    metadata: {
      userId: authRes.value.user.id,
      productType: parsed.data.productType,
      productId: parsed.data.productId,
      paymentId: paymentRes.value.id,
    },
    planCode: parsed.data.productType === "subscription" ? planCode(parsed.data.productId) : undefined,
  });
  if (!initialized.ok) {
    serviceRepo.updatePayment(paymentRes.value.id, { status: "failed", failure_reason: initialized.error.message });
    if (subscriptionId) serviceRepo.updateSubscription(subscriptionId, { status: "cancelled" });
    return initialized;
  }

  const updatedRes = serviceRepo.updatePayment(paymentRes.value.id, {
    checkout_url: initialized.value.authorizationUrl,
    provider_payload: { accessCode: initialized.value.accessCode },
  });
  if (!updatedRes.ok) return updatedRes;
  return ok({ checkoutUrl: initialized.value.authorizationUrl });
}

export async function getPaymentStatus(
  reference: string,
  options: BillingServiceOptions = {},
): Promise<Result<PaymentStatusResult, AppError>> {
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const state = options.state ?? getDefaultCoreDataStoreState();
  const repo = new CoreRepository({ role: "authenticated", userId: authRes.value.user.id }, state);
  const paymentRes = repo.getPaymentByReference(reference);
  if (!paymentRes.ok) return paymentRes;
  return ok({
    provider_reference: paymentRes.value.provider_reference,
    status: paymentRes.value.status,
    failure_reason: paymentRes.value.failure_reason,
    paid_at: paymentRes.value.paid_at,
  });
}

export async function cancelSubscription(options: BillingServiceOptions = {}): Promise<Result<SubscriptionRow, AppError>> {
  const authRes = await requireUser({ sessionUser: options.sessionUser, state: options.state });
  if (!authRes.ok) return authRes;
  const state = options.state ?? getDefaultCoreDataStoreState();
  const repo = new CoreRepository({ role: "authenticated", userId: authRes.value.user.id }, state);
  const subscriptionRes = repo.getSubscription(authRes.value.user.id);
  if (!subscriptionRes.ok) return subscriptionRes;
  if (!subscriptionRes.value) return err(createAppError("NOT_FOUND", "You do not have an active subscription."));
  if (!subscriptionRes.value.provider_reference || !subscriptionRes.value.provider_token) {
    return err(createAppError("PAYMENT_FAILED", "This subscription cannot be cancelled until Paystack finishes setting it up."));
  }

  const provider = options.provider ?? getDefaultPaymentProvider();
  const cancelled = await provider.cancelSubscription({
    subscriptionCode: subscriptionRes.value.provider_reference,
    emailToken: subscriptionRes.value.provider_token,
  });
  if (!cancelled.ok) return cancelled;
  const serviceRepo = new CoreRepository({ role: "service_role" }, state);
  return serviceRepo.updateSubscription(subscriptionRes.value.id, { status: "cancelled", cancel_at_period_end: true });
}

async function processSuccessfulCharge(
  payment: PaymentRow,
  verified: VerifiedTransaction,
  payload: Record<string, unknown>,
  state: CoreDataStoreState,
): Promise<Result<PaymentRow, AppError>> {
  if (verified.reference !== payment.provider_reference || verified.status !== "success") {
    return err(createAppError("PAYMENT_FAILED", "Payment verification did not confirm a successful transaction."));
  }
  if (verified.amountKobo !== payment.amount_kobo || verified.currency.toUpperCase() !== payment.currency) {
    return err(createAppError("PAYMENT_FAILED", "The verified payment amount does not match this purchase."));
  }

  const serviceRepo = new CoreRepository({ role: "service_role" }, state);
  const previousPayments = new Map(state.payments);
  const previousSubscriptions = new Map(state.subscriptions);
  const previousLedger = [...state.creditLedger];
  const subscription = Array.from(state.subscriptions.values()).find((row) => row.user_id === payment.user_id && row.plan_id === payment.product_id && row.status !== "cancelled");
  const rollback = () => {
    state.payments.clear();
    for (const [id, row] of previousPayments) state.payments.set(id, row);
    state.subscriptions.clear();
    for (const [id, row] of previousSubscriptions) state.subscriptions.set(id, row);
    state.creditLedger = previousLedger;
  };

  const paidRes = serviceRepo.updatePayment(payment.id, {
    status: "succeeded",
    paid_at: verified.paidAt ?? new Date().toISOString(),
    provider_payload: verified.raw,
    failure_reason: null,
  });
  if (!paidRes.ok) return paidRes;

  const grantReference = payment.product_type === "subscription" ? `subscription:${payment.id}` : `payment:${payment.id}`;
  const grantRes = await grantCredits(payment.user_id, payment.credits, "purchase", grantReference, {
    state,
    actor: { role: "service_role" },
  });
  if (!grantRes.ok) {
    rollback();
    return grantRes;
  }

  if (payment.product_type === "subscription") {
    const metadata = extractMetadata(payload);
    const data = typeof payload.data === "object" && payload.data !== null ? payload.data as Record<string, unknown> : {};
    const providerReference = typeof data.subscription_code === "string" ? data.subscription_code : subscription?.provider_reference ?? null;
    const providerToken = typeof data.email_token === "string" ? data.email_token : subscription?.provider_token ?? null;
    if (subscription) {
      const subscriptionRes = serviceRepo.updateSubscription(subscription.id, {
        status: "active",
        provider_reference: providerReference,
        provider_token: providerToken,
        current_period_start: verified.paidAt ?? new Date().toISOString(),
        current_period_end: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (!subscriptionRes.ok) {
        rollback();
        return subscriptionRes;
      }
    } else if (typeof metadata.userId === "string") {
      const product = findProduct("subscription", payment.product_id);
      if (product && "monthlyCredits" in product) {
        const subscriptionRes = serviceRepo.insertSubscription({
          user_id: payment.user_id,
          provider: "paystack",
          provider_reference: providerReference,
          provider_token: providerToken,
          plan_id: payment.product_id,
          status: "active",
          monthly_credits: product.monthlyCredits,
          current_period_start: verified.paidAt ?? new Date().toISOString(),
          current_period_end: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
          cancel_at_period_end: false,
        });
        if (!subscriptionRes.ok) {
          rollback();
          return subscriptionRes;
        }
      }
    }
  }

  return paidRes;
}

export async function handlePaystackWebhook(
  rawBody: string,
  signature: string | null,
  options: BillingServiceOptions & { secret?: string } = {},
): Promise<Result<{ eventId: string; processed: boolean; duplicate: boolean }, AppError>> {
  const secret = options.secret ?? process.env.PAYSTACK_WEBHOOK_SECRET ?? process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!verifyPaystackSignature(rawBody, signature, secret, options.nowMs)) {
    return err(createAppError("FORBIDDEN", "Invalid payment webhook signature."));
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object") throw new Error("Webhook payload must be an object.");
    payload = parsed as Record<string, unknown>;
  } catch {
    return err(createAppError("VALIDATION_FAILED", "Payment webhook payload is invalid."));
  }

  const state = options.state ?? getDefaultCoreDataStoreState();
  const provider = options.provider ?? getDefaultPaymentProvider();
  const serviceRepo = new CoreRepository({ role: "service_role" }, state);
  const eventId = webhookEventId(payload, rawBody);
  const existingRes = serviceRepo.getWebhookEvent("paystack", eventId);
  if (!existingRes.ok) return existingRes;
  if (existingRes.value && existingRes.value.status !== "pending") {
    return ok({ eventId, processed: existingRes.value.status === "processed", duplicate: true });
  }

  const eventRes = existingRes.value
    ? ok(existingRes.value)
    : serviceRepo.insertWebhookEvent({
        provider: "paystack",
        event_id: eventId,
        event_type: typeof payload.event === "string" ? payload.event : "unknown",
        status: "pending",
        payload,
      });
  if (!eventRes.ok) return eventRes;
  const event = eventRes.value;
  const eventType = typeof payload.event === "string" ? payload.event : "unknown";

  const finish = (status: WebhookEventRow["status"]): Result<{ eventId: string; processed: boolean; duplicate: boolean }, AppError> => {
    serviceRepo.updateWebhookEvent(event.id, { status, processed_at: new Date().toISOString() });
    return ok({ eventId, processed: status === "processed", duplicate: false });
  };

  if (eventType === "charge.success") {
    const reference = webhookReference(payload);
    if (!reference) return finish("ignored");
    const paymentRes = serviceRepo.getPaymentByReference(reference);
    if (!paymentRes.ok) {
      // Keep the event pending so a retried webhook can succeed after an out-of-order local write.
      return ok({ eventId, processed: false, duplicate: false });
    }
    const verified = await provider.verifyTransaction(reference);
    if (!verified.ok) {
      serviceRepo.updatePayment(paymentRes.value.id, { status: "failed", failure_reason: verified.error.message });
      serviceRepo.updateWebhookEvent(event.id, { status: "failed", processed_at: new Date().toISOString() });
      return verified;
    }
    if (verified.value.status !== "success") {
      if (verified.value.status === "pending") {
        // Keep both rows pending so a later retry of this event can confirm the transfer.
        return ok({ eventId, processed: false, duplicate: false });
      }
      serviceRepo.updatePayment(paymentRes.value.id, {
        status: verified.value.status === "abandoned" ? "abandoned" : "failed",
        failure_reason: `The provider reported this payment as ${verified.value.status}.`,
      });
      return finish("processed");
    }
    const processed = await withUserLock(state, paymentRes.value.user_id, () => processSuccessfulCharge(paymentRes.value, verified.value, payload, state));
    if (!processed.ok) {
      serviceRepo.updatePayment(paymentRes.value.id, { status: "failed", failure_reason: processed.error.message });
      serviceRepo.updateWebhookEvent(event.id, { status: "failed", processed_at: new Date().toISOString() });
      return processed;
    }
    return finish("processed");
  }

  if (eventType === "charge.failed" || eventType === "charge.abandoned") {
    const reference = webhookReference(payload);
    if (!reference) return finish("ignored");
    const paymentRes = serviceRepo.getPaymentByReference(reference);
    if (paymentRes.ok && paymentRes.value.status === "pending") {
      serviceRepo.updatePayment(paymentRes.value.id, {
        status: eventType === "charge.abandoned" ? "abandoned" : "failed",
        failure_reason: safeReason(payload),
      });
    }
    return finish("processed");
  }

  const subscriptionCode = webhookSubscriptionCode(payload);
  const subscription = subscriptionCode
    ? Array.from(state.subscriptions.values()).find((row) => row.provider_reference === subscriptionCode)
    : undefined;
  if (eventType === "invoice.payment_failed" && subscription) {
    serviceRepo.updateSubscription(subscription.id, { status: "grace" });
    return finish("processed");
  }
  if (eventType === "subscription.not_renew" && subscription) {
    serviceRepo.updateSubscription(subscription.id, { status: "cancelled", cancel_at_period_end: true });
    return finish("processed");
  }
  if (eventType === "subscription.disable" && subscription) {
    serviceRepo.updateSubscription(subscription.id, { status: "cancelled", cancel_at_period_end: true });
    return finish("processed");
  }

  return finish("ignored");
}
