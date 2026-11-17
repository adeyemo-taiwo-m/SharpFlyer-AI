import { BillingPage } from "@/components/sharpflyer/billing-page";
import { getBillingOverview } from "@/server/billing";

export default async function BillingRoute({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const overview = await getBillingOverview();
  if (!overview.ok) {
    return <div className="mx-auto max-w-[720px] px-5 py-8 text-body text-danger-text">{overview.error.message}</div>;
  }
  const params = await searchParams;
  return <BillingPage overview={overview.value} paymentReference={params.payment} />;
}
