"use client";

import * as React from "react";
import Link from "next/link";

import { signOutAction } from "@/app/actions/flyers";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ThemeChoice = "light" | "dark" | "system";

function applyThemeChoice(theme: ThemeChoice) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.theme = theme;
  if (theme === "system") {
    localStorage.removeItem("sharpflyer-theme");
  } else {
    localStorage.setItem("sharpflyer-theme", theme);
  }
}

export default function AccountSettingsPage() {
  const [theme, setTheme] = React.useState<ThemeChoice>(() => {
    if (typeof window === "undefined") return "system";
    const saved = window.localStorage.getItem("sharpflyer-theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  });

  function handleThemeChange(value: string) {
    if (value === "light" || value === "dark" || value === "system") {
      setTheme(value);
      applyThemeChoice(value);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-8 px-5 py-8 md:px-8 lg:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-foreground">Account</h1>
        <p className="text-body text-muted-foreground">
          Manage your appearance, brand details, and billing.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5">
        <h2 className="text-h4 text-foreground">Appearance</h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-small text-muted-foreground">Theme</span>
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={handleThemeChange}
            aria-label="Application theme"
            className="bg-background"
          >
            <ToggleGroupItem value="light">Light</ToggleGroupItem>
            <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
            <ToggleGroupItem value="system">System</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5">
        <h2 className="text-h4 text-foreground">Shortcuts</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/app/brand">Brand profile</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/app/billing">Billing and credits</Link>
          </Button>
        </div>
      </section>

      <form action={signOutAction}>
        <Button type="submit" variant="ghost">
          Sign out
        </Button>
      </form>
    </div>
  );
}
