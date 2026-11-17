import type { ReactNode } from "react";

import { PublicFooter, PublicHeader } from "@/components/sharpflyer/public-header";

export function PublicDocument({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground"><PublicHeader /><main className="mx-auto flex w-full max-w-[680px] flex-col gap-8 px-5 py-12 md:px-8 md:py-16"><div className="flex flex-col gap-3"><p className="text-caption text-brand-text">SharpFlyer AI</p><h1 className="text-display text-foreground">{title}</h1><p className="text-body-lg text-muted-foreground">{intro}</p></div><div className="flex flex-col gap-8 text-body text-foreground">{children}</div></main><PublicFooter /></div>;
}
