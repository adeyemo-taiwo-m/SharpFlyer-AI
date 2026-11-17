"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { SharpFlyerLogo } from "@/components/sharpflyer/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const links = [
  { href: "/app/templates", label: "Templates" },
  { href: "/pricing", label: "Pricing" },
  { href: "/auth", label: "Log in" },
] as const;

export function PublicHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-5 md:px-8 lg:px-10">
        <Link href="/" aria-label="SharpFlyer home" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <SharpFlyerLogo size={28} />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
          {links.map((link) => <Link key={link.href} href={link.href} className="text-callout text-muted-foreground hover:text-foreground">{link.label}</Link>)}
          <Button asChild variant="brand" size="sm"><Link href="/auth?next=%2Fapp%2Ftemplates">Get started</Link></Button>
        </nav>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu"><Menu /></Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(88vw,360px)]">
            <SheetHeader><SheetTitle><SharpFlyerLogo size={24} /></SheetTitle></SheetHeader>
            <nav aria-label="Mobile navigation" className="mt-6 flex flex-col gap-2">
              {links.map((link) => <Link key={link.href} href={link.href} className="rounded-xl px-3 py-3 text-callout text-foreground hover:bg-surface">{link.label}</Link>)}
              <Button asChild variant="brand" size="lg" className="mt-3"><Link href="/auth?next=%2Fapp%2Ftemplates">Get started</Link></Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-8 lg:px-10">
        <div className="flex flex-col gap-1"><SharpFlyerLogo size={24} /><p className="text-caption text-muted-foreground">Sharp flyers, sharp sharp.</p></div>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2 text-caption text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
