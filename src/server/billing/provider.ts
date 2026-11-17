import { createHmac, timingSafeEqual } from "node:crypto";

import { createAppError, type AppError } from "@/lib/errors";
import { err, ok, type Result } from "@/types/result";

export type PaymentProviderProduct = "credit_pack" | "subscription";

export type InitializePaymentInput = {
  email: string;
  amountKobo: number;
  currency: "NGN";
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
  planCode?: string;
};

export type InitializedPayment = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export type VerifiedTransaction = {
  status: "success" | "failed" | "abandoned" | "pending";
  reference: string;
  amountKobo: number;
  currency: string;
  metadata: Record<string, unknown>;
  paidAt: string | null;
  raw: Record<string, unknown>;
};

export type SubscriptionCancellation = {
  status: boolean;
  message?: string;
};

export interface PaymentProvider {
  initializePayment(input: InitializePaymentInput): Promise<Result<InitializedPayment, AppError>>;
  verifyTransaction(reference: string): Promise<Result<VerifiedTransaction, AppError>>;
  cancelSubscription(input: { subscriptionCode: string; emailToken: string }): Promise<Result<SubscriptionCancellation, AppError>>;
}

type PaystackResponse = {
  status: boolean;
  message?: string;
  data?: Record<string, unknown>;
};

type FetchLike = typeof fetch;

export class PaystackProvider implements PaymentProvider {
  private readonly fetcher: FetchLike;

  constructor(
    private readonly secretKey: string,
    options: { fetcher?: FetchLike; baseUrl?: string } = {},
  ) {
    if (!secretKey || !secretKey.startsWith("sk_test_")) {
      throw new Error("Only a Paystack sandbox secret key is allowed.");
    }
    this.fetcher = options.fetcher ?? fetch;
    this.baseUrl = (options.baseUrl ?? "https://api.paystack.co").replace(/\/$/, "");
  }

  private readonly baseUrl: string;

  private async request(path: string, init: RequestInit): Promise<Result<PaystackResponse, AppError>> {
    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
      const payload = (await response.json()) as PaystackResponse;
      if (!response.ok || !payload.status) {
        return err(createAppError("PAYMENT_FAILED", payload.message ?? "Paystack did not accept the request."));
      }
      return ok(payload);
    } catch {
      return err(createAppError("PAYMENT_FAILED", "Paystack could not be reached. Try again."));
    }
  }

  async initializePayment(input: InitializePaymentInput): Promise<Result<InitializedPayment, AppError>> {
    const response = await this.request("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: String(input.amountKobo),
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
        ...(input.planCode ? { plan: input.planCode } : {}),
      }),
    });
    if (!response.ok) return response;

    const data = response.value.data ?? {};
    const authorizationUrl = typeof data.authorization_url === "string" ? data.authorization_url : "";
    const accessCode = typeof data.access_code === "string" ? data.access_code : "";
    const reference = typeof data.reference === "string" ? data.reference : input.reference;
    if (!authorizationUrl || !accessCode || reference !== input.reference) {
      return err(createAppError("PAYMENT_FAILED", "Paystack returned an incomplete checkout session."));
    }
    return ok({ authorizationUrl, accessCode, reference });
  }

  async verifyTransaction(reference: string): Promise<Result<VerifiedTransaction, AppError>> {
    const response = await this.request(`/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
    });
    if (!response.ok) return response;

    const data = response.value.data ?? {};
    const status = data.status;
    const parsedStatus: VerifiedTransaction["status"] =
      status === "success" || status === "failed" || status === "abandoned" || status === "pending"
        ? status
        : "pending";
    return ok({
      status: parsedStatus,
      reference: typeof data.reference === "string" ? data.reference : reference,
      amountKobo: typeof data.amount === "number" ? data.amount : Number(data.amount ?? 0),
      currency: typeof data.currency === "string" ? data.currency : "NGN",
      metadata: typeof data.metadata === "object" && data.metadata !== null ? data.metadata as Record<string, unknown> : {},
      paidAt: typeof data.paid_at === "string" ? data.paid_at : typeof data.paidAt === "string" ? data.paidAt : null,
      raw: data,
    });
  }

  async cancelSubscription(input: { subscriptionCode: string; emailToken: string }): Promise<Result<SubscriptionCancellation, AppError>> {
    const response = await this.request("/subscription/disable", {
      method: "POST",
      body: JSON.stringify({ code: input.subscriptionCode, token: input.emailToken }),
    });
    if (!response.ok) return response;
    return ok({ status: response.value.status, message: response.value.message });
  }
}

class UnavailablePaymentProvider implements PaymentProvider {
  private unavailable(): Result<never, AppError> {
    return err(createAppError("PAYMENT_FAILED", "Payments are not configured for this environment."));
  }

  async initializePayment(): Promise<Result<InitializedPayment, AppError>> {
    return this.unavailable();
  }

  async verifyTransaction(): Promise<Result<VerifiedTransaction, AppError>> {
    return this.unavailable();
  }

  async cancelSubscription(): Promise<Result<SubscriptionCancellation, AppError>> {
    return this.unavailable();
  }
}

export function getDefaultPaymentProvider(): PaymentProvider {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return new UnavailablePaymentProvider();
  try {
    return new PaystackProvider(secret);
  } catch {
    return new UnavailablePaymentProvider();
  }
}

export function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!signature || !secret) return false;

  const compare = (expected: string, actual: string): boolean => {
    const expectedBytes = Buffer.from(expected, "hex");
    const actualBytes = Buffer.from(actual, "hex");
    return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
  };

  if (signature.includes("t=") && signature.includes("v1=")) {
    const values = new Map<string, string[]>();
    for (const part of signature.split(",")) {
      const separator = part.indexOf("=");
      if (separator < 0) continue;
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      values.set(key, [...(values.get(key) ?? []), value]);
    }
    const timestamp = Number(values.get("t")?.[0]);
    if (!Number.isFinite(timestamp) || Math.abs(nowMs / 1000 - timestamp) > 300) return false;
    const expected = createHmac("sha512", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    return (values.get("v1") ?? []).some((value) => compare(expected, value.includes(":") ? value.slice(value.indexOf(":") + 1) : value));
  }

  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  return compare(expected, signature);
}
