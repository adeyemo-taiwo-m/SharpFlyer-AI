import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { STARTER_FREE_CREDITS } from "@/config/pricing";
import {
  handlePaystackWebhook,
  startCheckout,
  verifyPaystackSignature,
  type PaymentProvider,
} from "@/server/billing";
import { createCoreDataStoreState } from "@/server/db/client";
import { getBalance } from "@/server/credits";
import type { InitializedPayment, InitializePaymentInput, VerifiedTransaction } from "@/server/billing/provider";
import { ok } from "@/types/result";

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "billing@solar.ng",
  emailVerified: true,
};

const SECRET = "whsec_test_secret";

class FakePaymentProvider implements PaymentProvider {
  lastInitialization: InitializePaymentInput | null = null;
  verifiedStatus: VerifiedTransaction["status"] = "success";
  verifiedAmount = 500_000;
  verifyCalls = 0;

  async initializePayment(input: InitializePaymentInput) {
    this.lastInitialization = input;
    return ok<InitializedPayment>({
      authorizationUrl: `https://checkout.test/${input.reference}`,
      accessCode: "access_test",
      reference: input.reference,
    });
  }

  async verifyTransaction(reference: string) {
    this.verifyCalls += 1;
    return ok<VerifiedTransaction>({
      status: this.verifiedStatus,
      reference,
      amountKobo: this.verifiedAmount,
      currency: "NGN",
      metadata: {},
      paidAt: "2026-11-17T10:00:00.000Z",
      raw: { reference, status: this.verifiedStatus, amount: this.verifiedAmount, currency: "NGN" },
    });
  }

  async cancelSubscription() {
    return ok({ status: true });
  }
}

function legacySignature(rawBody: string): string {
  return createHmac("sha512", SECRET).update(rawBody).digest("hex");
}

describe("Phase 5 Paystack billing", () => {
  let state = createCoreDataStoreState();
  let provider = new FakePaymentProvider();

  beforeEach(() => {
    state = createCoreDataStoreState();
    provider = new FakePaymentProvider();
  });

  async function createPayment(productId = "pack-10") {
    const result = await startCheckout(
      { productType: "credit_pack", productId },
      { sessionUser: USER, state, provider },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }

  it("creates a pending payment and only returns the hosted checkout URL", async () => {
    const result = await createPayment();
    const payment = Array.from(state.payments.values())[0]!;
    expect(payment.status).toBe("pending");
    expect(result.checkoutUrl).toContain("https://checkout.test/");
    expect(Object.keys(result)).toEqual(["checkoutUrl"]);
    expect(payment.checkout_url).toBe(result.checkoutUrl);
    expect(payment.provider_payload).toEqual({ accessCode: "access_test" });
    expect(await getBalance(USER.id, { state })).toEqual({ ok: true, value: STARTER_FREE_CREDITS });
  });

  it("verifies, fulfills, and idempotently ignores duplicate success events", async () => {
    await createPayment();
    const reference = Array.from(state.payments.values())[0]!.provider_reference;
    const payload = JSON.stringify({
      id: "evt-success-1",
      event: "charge.success",
      data: { reference, amount: 500_000, currency: "NGN" },
    });

    const first = await handlePaystackWebhook(payload, legacySignature(payload), { state, provider, secret: SECRET });
    const duplicate = await handlePaystackWebhook(payload, legacySignature(payload), { state, provider, secret: SECRET });

    expect(first).toEqual({ ok: true, value: { eventId: "evt-success-1", processed: true, duplicate: false } });
    expect(duplicate).toEqual({ ok: true, value: { eventId: "evt-success-1", processed: true, duplicate: true } });
    expect(provider.verifyCalls).toBe(1);
    expect(await getBalance(USER.id, { state })).toEqual({ ok: true, value: STARTER_FREE_CREDITS + 10 });
  });

  it("rejects forged webhooks and does not grant credits", async () => {
    await createPayment();
    const payload = JSON.stringify({ id: "evt-forged", event: "charge.success", data: { reference: Array.from(state.payments.values())[0]!.provider_reference } });
    const result = await handlePaystackWebhook(payload, "not-a-signature", { state, provider, secret: SECRET });

    expect(result).toEqual({ ok: false, error: { code: "FORBIDDEN", message: "Invalid payment webhook signature." } });
    expect(provider.verifyCalls).toBe(0);
    expect(await getBalance(USER.id, { state })).toEqual({ ok: true, value: STARTER_FREE_CREDITS });
  });

  it("checks the provider-verified amount before granting value", async () => {
    await createPayment();
    const reference = Array.from(state.payments.values())[0]!.provider_reference;
    provider.verifiedAmount = 1;
    const payload = JSON.stringify({ id: "evt-wrong-amount", event: "charge.success", data: { reference } });
    const result = await handlePaystackWebhook(payload, legacySignature(payload), { state, provider, secret: SECRET });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PAYMENT_FAILED");
    expect(await getBalance(USER.id, { state })).toEqual({ ok: true, value: STARTER_FREE_CREDITS });
  });

  it("tolerates a failed event arriving before a later confirmed success", async () => {
    await createPayment();
    const reference = Array.from(state.payments.values())[0]!.provider_reference;
    const failedPayload = JSON.stringify({ id: "evt-failed-first", event: "charge.failed", data: { reference, gateway_response: "Declined" } });
    const successPayload = JSON.stringify({ id: "evt-success-later", event: "charge.success", data: { reference } });

    const failed = await handlePaystackWebhook(failedPayload, legacySignature(failedPayload), { state, provider, secret: SECRET });
    const success = await handlePaystackWebhook(successPayload, legacySignature(successPayload), { state, provider, secret: SECRET });

    expect(failed.ok).toBe(true);
    expect(success.ok).toBe(true);
    expect(await getBalance(USER.id, { state })).toEqual({ ok: true, value: STARTER_FREE_CREDITS + 10 });
  });

  it("supports Paystack's timestamped signature format", () => {
    const now = 1_763_376_000_000;
    const body = "{\"event\":\"ping\"}";
    const timestamp = Math.floor(now / 1000);
    const digest = createHmac("sha512", SECRET).update(`${timestamp}.${body}`).digest("hex");
    expect(verifyPaystackSignature(body, `t=${timestamp},v1=whk_test:${digest}`, SECRET, now)).toBe(true);
    expect(verifyPaystackSignature(body, `t=${timestamp - 301},v1=${digest}`, SECRET, now)).toBe(false);
  });

  it("does not silently accept a live Paystack key", async () => {
    const { PaystackProvider } = await import("@/server/billing/provider");
    expect(() => new PaystackProvider("sk_live_should_not_be_used")).toThrow("sandbox");
  });
});
