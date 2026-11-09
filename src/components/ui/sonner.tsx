"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return <Sonner position="bottom-center" toastOptions={{ classNames: { toast: "rounded-2xl bg-inverse text-inverse-foreground shadow-3", title: "text-small font-medium", description: "text-caption opacity-80" } }} />;
}
