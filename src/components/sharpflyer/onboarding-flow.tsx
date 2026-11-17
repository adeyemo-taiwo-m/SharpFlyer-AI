"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { saveOnboardingAction, skipOnboardingAction } from "@/app/actions/account";
import { BrandLogoUpload } from "@/components/sharpflyer/brand-logo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const BUSINESS_TYPES = [
  { value: "solar", label: "Solar and inverter" },
  { value: "retail", label: "Retail and promotions" },
  { value: "services", label: "Services" },
] as const;

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [businessType, setBusinessType] = React.useState("solar");
  const [businessName, setBusinessName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [logoAssetId, setLogoAssetId] = React.useState<string | null>(null);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = React.useState("");
  const [secondaryColor, setSecondaryColor] = React.useState("");
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function finish() {
    setWorking(true);
    setError(null);
    const result = await saveOnboardingAction({ businessType, businessName, phone, address, logoAssetId: logoAssetId ?? "", primaryColor, secondaryColor });
    setWorking(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.push(`/app/templates?category=${encodeURIComponent(businessType === "solar" ? "solar" : "all")}`);
    router.refresh();
  }

  async function skip() {
    setWorking(true);
    const result = await skipOnboardingAction();
    if (!result.ok) {
      setWorking(false);
      setError(result.error.message);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  const canContinue = step === 0 ? Boolean(businessType) : step === 1 ? Boolean(businessName.trim() && phone.trim()) : true;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-[560px] flex-col justify-center gap-8 px-5 py-10 md:px-8">
      <div className="flex flex-col gap-3"><p className="text-caption text-brand-text">A quick start</p><h1 className="text-h1 text-foreground">Make your next flyer feel like your business.</h1><p className="text-body text-muted-foreground">Three short steps. You can skip any of this and update it later.</p><div className="flex gap-2" aria-label={`Onboarding step ${step + 1} of 3`}>{[0, 1, 2].map((item) => <span key={item} className={cn("h-1.5 flex-1 rounded-full", item <= step ? "bg-brand" : "bg-surface-2")} />)}</div></div>
      {step === 0 && <section className="flex flex-col gap-4"><h2 className="text-h3 text-foreground">What do you sell?</h2><div className="flex flex-col gap-2">{BUSINESS_TYPES.map((type) => <button key={type.value} type="button" aria-pressed={businessType === type.value} onClick={() => setBusinessType(type.value)} className={cn("flex min-h-14 items-center justify-between rounded-xl bg-surface px-4 text-left text-callout outline-none focus-visible:ring-2 focus-visible:ring-ring", businessType === type.value && "bg-surface-2 font-semibold")}>{type.label}{businessType === type.value && <Check className="size-5 text-brand" />}</button>)}</div></section>}
      {step === 1 && <section className="flex flex-col gap-5"><h2 className="text-h3 text-foreground">Your business details</h2><div className="flex flex-col gap-2"><Label htmlFor="onboarding-name">Business name</Label><Input id="onboarding-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} autoFocus maxLength={80} /></div><div className="flex flex-col gap-2"><Label htmlFor="onboarding-phone">Phone number</Label><Input id="onboarding-phone" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="0803 123 4567" /></div><div className="flex flex-col gap-2"><Label htmlFor="onboarding-address">Address <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="onboarding-address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={140} /></div></section>}
      {step === 2 && <section className="flex flex-col gap-5"><h2 className="text-h3 text-foreground">Add a little polish</h2><p className="text-small text-muted-foreground">You can add these now or later from Brand profile.</p><BrandLogoUpload assetId={logoAssetId} previewUrl={logoUrl} onChange={(id, url) => { setLogoAssetId(id); setLogoUrl(url); }} /><div className="flex flex-col gap-2"><Label htmlFor="onboarding-primary">Primary colour <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="onboarding-primary" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} placeholder="Six-digit hex value" maxLength={7} /></div><div className="flex flex-col gap-2"><Label htmlFor="onboarding-secondary">Secondary colour <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="onboarding-secondary" value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} placeholder="Six-digit hex value" maxLength={7} /></div></section>}
      {error && <p role="alert" className="rounded-xl bg-danger-tint px-4 py-3 text-small text-danger-text">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="ghost" onClick={() => step === 0 ? void skip() : setStep((value) => value - 1)} disabled={working}>{step === 0 ? "Skip for now" : <><ArrowLeft /> Back</>}</Button>{step < 2 ? <Button type="button" variant="brand" onClick={() => setStep((value) => value + 1)} disabled={!canContinue || working}>Continue <ArrowRight /></Button> : <Button type="button" variant="brand" onClick={() => void finish()} disabled={!canContinue || working}>{working && <Loader2 className="animate-spin" />} Finish setup</Button>}</div>
    </div>
  );
}
