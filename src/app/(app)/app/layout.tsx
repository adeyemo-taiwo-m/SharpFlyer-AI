import { redirect } from "next/navigation";

import { AppShell } from "@/components/sharpflyer/app-shell";
import { requireUser } from "@/server/auth";
import { getBalance } from "@/server/credits";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authRes = await requireUser();
  if (!authRes.ok) {
    redirect("/auth");
  }

  const balanceRes = await getBalance(authRes.value.user.id);
  const initialBalance = balanceRes.ok ? balanceRes.value : 0;

  return (
    <AppShell
      initialBalance={initialBalance}
      userEmail={authRes.value.user.email}
    >
      {children}
    </AppShell>
  );
}
