"use client";

import * as React from "react";
import { Check, CircleAlert, Loader2 } from "lucide-react";

import { cancelSubscriptionAction, getPaymentStatusAction, startCheckoutAction } from "@/app/actions/billing";
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from "@/config/pricing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNaira } from "@/lib/money";
import type { BillingOverview } from "@/server/billing";
import type { PaymentRow } from "@/types/database";

function paymentLabel(payment: PaymentRow): string {
  return payment.product_type === "credit_pack" ? `${payment.credits} flyer credits` : `${payment.product_id} plan`;
}

function statusLabel(status: PaymentRow["status"]): string {
  return status === "succeeded" ? "Paid" : status === "pending" ? "Payment pending" : status === "abandoned" ? "Abandoned" : "Failed";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

export function BillingPage({
  overview,
  paymentReference,
}: {
  overview: BillingOverview;
  paymentReference?: string;
}) {
  const [activeTab, setActiveTab] = React.useState("credits");
  const [workingProduct, setWorkingProduct] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = React.useState(paymentReference ? "Checking payment status…" : null);
  const [cancelWorking, setCancelWorking] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);

  React.useEffect(() => {
    if (!paymentReference) return;
    let cancelledPolling = false;
    let attempts = 0;
    const poll = async () => {
      const result = await getPaymentStatusAction(paymentReference);
      if (cancelledPolling) return;
      attempts += 1;
      if (!result.ok) {
        setPendingMessage(null);
        setError(result.error.message);
        return;
      }
      if (result.value.status === "pending") {
        if (attempts < 15) window.setTimeout(poll, 2000);
        else setPendingMessage("Payment is still pending. You can leave this page; we’ll update your balance when Paystack confirms it.");
        return;
      }
      setPendingMessage(null);
      if (result.value.status !== "succeeded") setError(result.value.failure_reason ?? "Payment did not go through. Try again.");
      else window.location.reload();
    };
    void poll();
    return () => {
      cancelledPolling = true;
    };
  }, [paymentReference]);

  async function handleCheckout(productType: "credit_pack" | "subscription", productId: string) {
    setError(null);
    setWorkingProduct(productId);
    const result = await startCheckoutAction({ productType, productId });
    if (!result.ok) {
      setWorkingProduct(null);
      setError(result.error.message);
      return;
    }
    window.location.assign(result.value.checkoutUrl);
  }

  async function handleCancel() {
    if (!window.confirm("Cancel your current subscription? You will keep access until the provider confirms cancellation.")) return;
    setCancelWorking(true);
    setError(null);
    const result = await cancelSubscriptionAction();
    setCancelWorking(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setCancelled(true);
  }

  const subscription = overview.subscription;
  const subscriptionActive = subscription && ["active", "past_due", "grace"].includes(subscription.status) && !cancelled;

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-5 py-8 md:px-8 lg:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-foreground">Billing and credits</h1>
        <p className="text-body text-muted-foreground">Add credits when you need to export more flyers. Prices shown are proposed sandbox values.</p>
      </div>

      <section className="flex flex-wrap gap-4" aria-label="Current balance">
        <div className="min-w-[240px] flex-1 rounded-2xl bg-surface p-5">
          <p className="text-caption text-muted-foreground">Credits available</p>
          <p className="mt-2 text-price tabular text-foreground">{overview.balance}</p>
          <p className="mt-1 text-small text-muted-foreground">1 credit = 1 new flyer export.</p>
        </div>
        <div className="min-w-[240px] flex-1 rounded-2xl bg-surface p-5">
          <p className="text-caption text-muted-foreground">Current plan</p>
          <p className="mt-2 text-h3 text-foreground">{subscriptionActive ? subscription?.plan_id : "Free"}</p>
          <p className="mt-1 text-small text-muted-foreground">{subscriptionActive ? `${subscription?.monthly_credits} credits each month` : "Use starter credits or buy a pack."}</p>
        </div>
      </section>

      {pendingMessage && (
        <Alert>
          <Loader2 className="size-5 animate-spin" />
          <div><AlertTitle>Payment pending</AlertTitle><AlertDescription>{pendingMessage}</AlertDescription></div>
        </Alert>
      )}
      {error && (
        <Alert variant="danger">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          <div><AlertTitle>Payment did not go through</AlertTitle><AlertDescription>{error}</AlertDescription></div>
        </Alert>
      )}
      {subscription?.status === "grace" && !cancelled && (
        <Alert variant="danger">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <AlertTitle>Renewal didn&apos;t go through</AlertTitle>
            <AlertDescription>Your plan is in a grace period. Update your payment method or choose a new plan before access is downgraded.</AlertDescription>
          </div>
        </Alert>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="plans-heading">
        <div className="flex flex-col gap-1">
          <h2 id="plans-heading" className="text-h3 text-foreground">Choose what you need</h2>
          <p className="text-small text-muted-foreground">Payments are handled by Paystack. This environment accepts sandbox keys only.</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList aria-label="Billing options">
            <TabsTrigger value="credits">Credit packs</TabsTrigger>
            <TabsTrigger value="plans">Monthly plans</TabsTrigger>
          </TabsList>
          <TabsContent value="credits">
            <div className="flex flex-wrap gap-4">
              {CREDIT_PACKS.map((pack) => (
                <div key={pack.id} className="flex min-w-[260px] flex-1 basis-full flex-col gap-5 rounded-2xl bg-surface p-5 md:basis-[calc(50%-0.5rem)]">
                  <div><h3 className="text-h4 text-foreground">{pack.name}</h3><p className="mt-1 text-small text-muted-foreground">For {pack.credits} new flyer exports.</p></div>
                  <div className="flex items-end justify-between gap-3"><span className="text-price tabular text-foreground">{formatNaira(pack.priceKobo)}</span><span className="text-caption text-muted-foreground">proposed</span></div>
                  <Button variant="brand" onClick={() => void handleCheckout("credit_pack", pack.id)} disabled={workingProduct !== null}>
                    {workingProduct === pack.id && <Loader2 className="animate-spin" />} Buy credits
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="plans">
            <div className="flex flex-wrap gap-4">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div key={plan.id} className="flex min-w-[260px] flex-1 basis-full flex-col gap-5 rounded-2xl bg-surface p-5 md:basis-[calc(50%-0.5rem)]">
                  <div><h3 className="text-h4 text-foreground">{plan.name}</h3><p className="mt-1 text-small text-muted-foreground">{plan.monthlyCredits} credits every month.</p></div>
                  <ul className="flex flex-col gap-2 text-small text-muted-foreground">{plan.features.map((feature) => <li key={feature} className="flex gap-2"><Check className="size-4 shrink-0 text-success" />{feature}</li>)}</ul>
                  <div className="flex items-end justify-between gap-3"><span className="text-price tabular text-foreground">{formatNaira(plan.priceMonthlyKobo)}<span className="text-small font-normal text-muted-foreground"> / month</span></span><span className="text-caption text-muted-foreground">proposed</span></div>
                  <Button variant="brand" onClick={() => void handleCheckout("subscription", plan.id)} disabled={workingProduct !== null || Boolean(subscriptionActive)}>
                    {workingProduct === plan.id && <Loader2 className="animate-spin" />} {subscriptionActive ? "Current plan" : "Choose plan"}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {subscriptionActive && (
        <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5">
          <h2 className="text-h4 text-foreground">Subscription</h2>
          <p className="text-small text-muted-foreground">If a renewal fails, your plan enters a grace period before it is downgraded.</p>
          <Button variant="secondary" className="self-start" onClick={() => void handleCancel()} disabled={cancelWorking}>
            {cancelWorking && <Loader2 className="animate-spin" />} Cancel subscription
          </Button>
        </section>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="history-heading">
        <div><h2 id="history-heading" className="text-h3 text-foreground">Billing history</h2><p className="mt-1 text-small text-muted-foreground">Your payment records are kept with their provider status.</p></div>
        {overview.payments.length === 0 ? <p className="rounded-2xl bg-surface p-5 text-small text-muted-foreground">No payments yet.</p> : (
          <div className="overflow-hidden rounded-2xl bg-surface">
            <div className="hidden overflow-auto md:block">
              <table className="w-full text-small"><thead><tr className="border-b border-border text-left text-caption text-muted-foreground"><th className="px-5 py-3 font-medium">Item</th><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Amount</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{overview.payments.map((payment) => <tr key={payment.id} className="border-b border-border last:border-0"><td className="px-5 py-4 text-foreground">{paymentLabel(payment)}</td><td className="px-5 py-4 text-muted-foreground">{formatDate(payment.created_at)}</td><td className="px-5 py-4 tabular text-foreground">{formatNaira(payment.amount_kobo)}</td><td className="px-5 py-4 text-muted-foreground">{statusLabel(payment.status)}</td></tr>)}</tbody></table>
            </div>
            <div className="flex flex-col md:hidden">{overview.payments.map((payment) => <div key={payment.id} className="flex items-start justify-between gap-4 border-b border-border p-5 last:border-0"><div><p className="text-small text-foreground">{paymentLabel(payment)}</p><p className="mt-1 text-caption text-muted-foreground">{formatDate(payment.created_at)} · {statusLabel(payment.status)}</p></div><span className="tabular text-small text-foreground">{formatNaira(payment.amount_kobo)}</span></div>)}</div>
          </div>
        )}
      </section>
    </div>
  );
}
