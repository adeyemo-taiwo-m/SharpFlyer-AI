import { BrandProfile } from "@/components/sharpflyer/brand-profile";
import { createSignedDownloadUrl } from "@/server/storage";
import { getAccountData } from "@/server/account";

export default async function BrandProfilePage() {
  const accountRes = await getAccountData();
  if (!accountRes.ok) return <div className="mx-auto max-w-[720px] px-5 py-8 text-body text-danger-text">{accountRes.error.message}</div>;
  const { brand } = accountRes.value;
  let logoUrl: string | null = null;
  if (brand?.logo_asset_id) {
    const signed = createSignedDownloadUrl(accountRes.value.profile.id, brand.logo_asset_id);
    if (signed.ok) logoUrl = signed.value.url;
  }
  return <div className="mx-auto w-full max-w-[720px] px-5 py-8 md:px-8 lg:px-10"><div className="mb-7 flex flex-col gap-2"><h1 className="text-h1 text-foreground">Brand profile</h1><p className="text-body text-muted-foreground">Save your logo, colours, phone number, and business name so every new flyer starts pre-filled.</p></div><BrandProfile initialBrand={brand} initialLogoUrl={logoUrl} /></div>;
}
