"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { saveBrandProfileAction } from "@/app/actions/account";
import { BrandLogoUpload } from "@/components/sharpflyer/brand-logo-upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BrandProfileRow } from "@/types/database";

export function BrandProfile({
  initialBrand,
  initialLogoUrl,
}: {
  initialBrand: BrandProfileRow | null;
  initialLogoUrl: string | null;
}) {
  const [businessName, setBusinessName] = React.useState(initialBrand?.business_name ?? "");
  const [phone, setPhone] = React.useState(initialBrand?.phone_e164 ?? "");
  const [address, setAddress] = React.useState(initialBrand?.address ?? "");
  const [logoAssetId, setLogoAssetId] = React.useState<string | null>(initialBrand?.logo_asset_id ?? null);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(initialLogoUrl);
  const [primaryColor, setPrimaryColor] = React.useState(initialBrand?.primary_color ?? "");
  const [secondaryColor, setSecondaryColor] = React.useState(initialBrand?.secondary_color ?? "");
  const [working, setWorking] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setMessage(null);
    setError(null);
    const result = await saveBrandProfileAction({ businessName, phone, address, logoAssetId: logoAssetId ?? "", primaryColor, secondaryColor });
    setWorking(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setMessage("Brand profile saved. New flyers will start with these details.");
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-8">
      {message && <Alert><Check className="size-5" /><div><AlertTitle>Saved</AlertTitle><AlertDescription>{message}</AlertDescription></div></Alert>}
      {error && <p role="alert" className="rounded-xl bg-danger-tint px-4 py-3 text-small text-danger-text">{error}</p>}
      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5"><div><h2 className="text-h4 text-foreground">Business details</h2><p className="mt-1 text-small text-muted-foreground">These details prefill every new flyer.</p></div>
        <div className="flex flex-col gap-2"><Label htmlFor="brand-name">Business name</Label><Input id="brand-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={80} required /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="brand-phone">Phone number</Label><Input id="brand-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0803 123 4567" required /><p className="text-caption text-muted-foreground">Saved as a normalized Nigerian or international E.164 number.</p></div>
        <div className="flex flex-col gap-2"><Label htmlFor="brand-address">Address <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="brand-address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={140} /></div>
      </section>
      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5"><div><h2 className="text-h4 text-foreground">Logo</h2><p className="mt-1 text-small text-muted-foreground">Validated through the same private upload pipeline as flyer assets.</p></div><BrandLogoUpload assetId={logoAssetId} previewUrl={logoUrl} onChange={(id, url) => { setLogoAssetId(id); setLogoUrl(url); }} /></section>
      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5"><div><h2 className="text-h4 text-foreground">Brand colours</h2><p className="mt-1 text-small text-muted-foreground">Optional six-digit hex values used as saved brand guidance.</p></div>
        <div className="flex flex-col gap-2"><Label htmlFor="primary-color">Primary colour</Label><Input id="primary-color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} placeholder="Six-digit hex value" maxLength={7} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="secondary-color">Secondary colour</Label><Input id="secondary-color" value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} placeholder="Six-digit hex value" maxLength={7} /></div>
      </section>
      <Button type="submit" variant="brand" size="lg" className="self-start" disabled={working}>{working && <Loader2 className="animate-spin" />} Save brand profile</Button>
    </form>
  );
}
