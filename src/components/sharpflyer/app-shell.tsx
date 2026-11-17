"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Coins,
  Files,
  Home,
  LayoutTemplate,
  Palette,
  Plus,
  Settings,
} from "lucide-react";

import { CreditBadge } from "@/components/sharpflyer/credit-badge";
import { SharpFlyerLogo } from "@/components/sharpflyer/logo";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type AutoSaveStatus = "idle" | "saving" | "saved";

type AppShellContextValue = {
  creditBalance: number;
  setCreditBalance: React.Dispatch<React.SetStateAction<number>>;
  autoSaveStatus: AutoSaveStatus;
  setAutoSaveStatus: React.Dispatch<React.SetStateAction<AutoSaveStatus>>;
  openCreditSheet: () => void;
};

const AppShellContext = React.createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const ctx = React.useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used inside AppShell");
  }
  return ctx;
}

const MOBILE_TABS = [
  { href: "/app", label: "Home", icon: Home, matchExact: true },
  { href: "/app/templates", label: "Templates", icon: LayoutTemplate, matchExact: false },
  { href: "/app/create", label: "Create", icon: Plus, matchExact: false },
  { href: "/app/flyers", label: "My flyers", icon: Files, matchExact: false },
  { href: "/app/settings", label: "Account", icon: Settings, matchExact: false },
] as const;

const DESKTOP_NAV = [
  { href: "/app", label: "Home", icon: Home, matchExact: true },
  { href: "/app/templates", label: "Templates", icon: LayoutTemplate, matchExact: false },
  { href: "/app/create", label: "Create", icon: Plus, matchExact: false },
  { href: "/app/flyers", label: "My flyers", icon: Files, matchExact: false },
  { href: "/app/brand", label: "Brand", icon: Palette, matchExact: false },
  { href: "/app/billing", label: "Billing", icon: Coins, matchExact: false },
  { href: "/app/settings", label: "Account", icon: Settings, matchExact: false },
] as const;

function resolvePageTitle(pathname: string): {
  title: string;
  backHref?: string;
  isEditor: boolean;
} {
  if (pathname === "/app/create/ai") {
    return { title: "Create with AI", backHref: "/app/templates", isEditor: false };
  }
  if (pathname.startsWith("/app/create/")) {
    return { title: "Edit flyer", backHref: "/app/templates", isEditor: true };
  }
  if (pathname === "/app/create") {
    return { title: "Create flyer", backHref: "/app/templates", isEditor: false };
  }
  if (pathname.startsWith("/app/templates/")) {
    return { title: "Design details", backHref: "/app/templates", isEditor: false };
  }
  if (pathname.startsWith("/app/templates")) {
    return { title: "Templates", isEditor: false };
  }
  if (pathname.startsWith("/app/flyers")) {
    return { title: "My flyers", isEditor: false };
  }
  if (pathname.startsWith("/app/brand")) {
    return { title: "Brand profile", backHref: "/app/settings", isEditor: false };
  }
  if (pathname.startsWith("/app/billing")) {
    return { title: "Billing and credits", backHref: "/app/settings", isEditor: false };
  }
  if (pathname.startsWith("/app/settings")) {
    return { title: "Account", isEditor: false };
  }
  return { title: "Home", isEditor: false };
}

export function AppShell({
  initialBalance,
  userEmail,
  needsOnboarding,
  children,
}: {
  initialBalance: number;
  userEmail: string;
  needsOnboarding: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/app";
  const router = useRouter();
  const [creditBalance, setCreditBalance] = React.useState(initialBalance);
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<AutoSaveStatus>("idle");
  const [creditSheetOpen, setCreditSheetOpen] = React.useState(false);

  const { title, backHref, isEditor } = resolvePageTitle(pathname);
  const creditLabel = creditBalance === 1 ? "1 credit" : `${creditBalance} credits`;

  const openCreditSheet = React.useCallback(() => {
    setCreditSheetOpen(true);
  }, []);

  React.useEffect(() => {
    if (needsOnboarding && pathname !== "/app/onboarding") router.replace("/app/onboarding");
  }, [needsOnboarding, pathname, router]);

  return (
    <AppShellContext.Provider
      value={{
        creditBalance,
        setCreditBalance,
        autoSaveStatus,
        setAutoSaveStatus,
        openCreditSheet,
      }}
    >
      <div className="flex min-h-dvh w-full flex-col bg-background text-foreground lg:flex-row">
        <Toaster />

        {/* Desktop Left Sidebar (248px at lg+) */}
        <aside
          aria-label="Sidebar navigation"
          className="hidden w-[248px] shrink-0 flex-col justify-between border-r border-border bg-background p-5 lg:flex"
        >
          <div className="flex flex-col gap-6">
            <Link
              href="/app"
              className="inline-flex items-center rounded-lg py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SharpFlyerLogo size={28} />
            </Link>

            <nav aria-label="Primary" className="flex flex-col gap-1">
              {DESKTOP_NAV.map((item) => {
                const Icon = item.icon;
                const active = item.matchExact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-[10px] px-3 text-callout transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-surface font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-caption text-muted-foreground">Credits left</span>
              <span
                className={cn(
                  "tabular text-callout font-semibold",
                  creditBalance === 0
                    ? "text-danger-text"
                    : creditBalance <= 3
                      ? "text-warning"
                      : "text-foreground",
                )}
              >
                {creditLabel}
              </span>
            </div>
            <p className="truncate text-caption text-muted-foreground" title={userEmail}>
              {userEmail}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={openCreditSheet}
            >
              Buy credits
            </Button>
          </div>
        </aside>

        {/* Main Content Column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top App Bar (56px mobile / 64px desktop) */}
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-5 lg:h-16 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              {backHref ? (
                <Link
                  href={backHref}
                  aria-label="Back"
                  className="inline-flex size-11 -ml-2 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft className="size-5" strokeWidth={1.75} />
                </Link>
              ) : (
                <Link
                  href="/app"
                  aria-label="SharpFlyer home"
                  className="inline-flex items-center lg:hidden"
                >
                  <SharpFlyerLogo size={24} showWordmark={false} />
                </Link>
              )}
              <span className="truncate text-body-strong text-foreground">
                {title}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Auto-save indicator slot for the editor */}
              {isEditor && autoSaveStatus !== "idle" && (
                <span
                  data-testid="autosave-indicator"
                  aria-live="polite"
                  className="text-caption text-muted-foreground"
                >
                  {autoSaveStatus === "saving" ? "Saving…" : "Saved"}
                </span>
              )}
              <CreditBadge
                balance={creditBalance}
                open={creditSheetOpen}
                onOpenChange={setCreditSheetOpen}
              />
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
            {children}
          </main>

          {/* Mobile Bottom Tab Bar (64px + safe-area) */}
          <nav
            aria-label="Bottom navigation"
            className="fixed inset-x-0 bottom-0 z-10 flex h-[calc(64px+env(safe-area-inset-bottom))] items-center justify-around border-t border-border bg-background pb-[env(safe-area-inset-bottom)] shadow-1 lg:hidden"
          >
            {MOBILE_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.matchExact
                ? pathname === tab.href
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 py-1.5 text-micro transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-6 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                  <span className="text-[11px] leading-none">{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </AppShellContext.Provider>
  );
}
