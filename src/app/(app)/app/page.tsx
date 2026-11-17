/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listUserFlyers } from "@/server/flyers";
import { requireUser } from "@/server/auth";
import { getBalance } from "@/server/credits";

export default async function AppHomePage() {
  const authRes = await requireUser();
  const flyersRes = await listUserFlyers();
  const balanceRes = authRes.ok ? await getBalance(authRes.value.user.id) : { ok: false as const, error: { code: "INTERNAL" as const, message: "Balance unavailable." } };
  const flyers = flyersRes.ok ? flyersRes.value : [];
  const firstName = authRes.ok ? (authRes.value.profile.business_name_default?.split(" ")[0] ?? "there") : "there";
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-5 py-8 md:px-8 lg:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-foreground">Hello, {firstName}</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          Pick a design, add your details, and export a flyer with your price and phone number always accurate.
        </p>
      </div>
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="min-w-[180px] flex-1 rounded-2xl bg-surface p-5"><p className="text-caption text-muted-foreground">Credits available</p><p className="mt-2 text-price tabular text-foreground">{balanceRes.ok ? balanceRes.value : "—"}</p><p className="mt-1 text-caption text-muted-foreground">1 credit per export</p></div>
        <div className="min-w-[220px] flex-[2] rounded-2xl bg-surface p-5"><p className="text-caption text-muted-foreground">Create another</p><p className="mt-2 text-callout text-foreground">Your saved brand details will be ready in the editor.</p><Button asChild variant="brand" size="sm" className="mt-3"><Link href="/app/templates">Choose a design</Link></Button></div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3"><h2 className="text-h3 text-foreground">Recent flyers</h2><Button asChild variant="ghost" size="sm"><Link href="/app/flyers">View all</Link></Button></div>
        {flyers.length === 0 ? <div className="rounded-2xl bg-surface p-5 text-small text-muted-foreground">No flyers yet. Choose a design to get started.</div> : <div className="flex flex-wrap gap-5">{flyers.slice(0, 3).map((flyer) => <Link key={flyer.id} href={`/app/create/${flyer.id}`} className="flex min-w-0 basis-full items-center gap-4 rounded-2xl bg-surface p-3 outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring sm:basis-[calc(50%-0.625rem)] lg:basis-[calc(33.333%-0.84rem)]">{flyer.previewUrl ? <img src={flyer.previewUrl} alt="" className="size-20 rounded-xl object-cover" /> : <span className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-center text-micro text-muted-foreground">No preview</span>}<span className="min-w-0"><span className="block truncate text-callout text-foreground">{flyer.title}</span><span className="mt-1 block text-caption text-muted-foreground">{flyer.status === "exported" ? "Exported" : "Draft"}</span></span></Link>)}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="brand" size="lg">
          <Link href="/app/templates">Choose a design</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/app/flyers">My flyers</Link>
        </Button>
      </div>
    </div>
  );
}
