import { Suspense } from "react";

import { AuthSignInForm } from "@/app/(public)/auth/auth-form";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolved = await searchParams;
  const redirectTo = resolved.next ?? "/app/templates";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10">
      <Suspense fallback={null}>
        <AuthSignInForm redirectTo={redirectTo} />
      </Suspense>
    </main>
  );
}
