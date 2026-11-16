"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";

import { signInAction } from "@/app/actions/flyers";
import { SharpFlyerLogo } from "@/components/sharpflyer/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthSignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await signInAction({ email, redirectTo });
      if (!res.ok) {
        setError(res.error.message);
        setSubmitting(false);
        return;
      }
      router.push(res.value.redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6 rounded-[28px] bg-surface p-6 sm:p-8">
      <div className="flex flex-col gap-2">
        <SharpFlyerLogo size={28} />
        <h1 className="mt-3 text-h1 text-foreground">Sign in</h1>
        <p className="text-body text-muted-foreground">
          Enter your email to open your designs and create flyers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="auth-email">Email address</Label>
          <Input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="chidi@lagossolar.ng"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error)}
            className="bg-background"
            required
          />
          {error && (
            <p
              role="alert"
              className="flex items-center gap-1.5 text-small text-danger-text"
            >
              <CircleAlert className="size-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting && <Loader2 className="animate-spin" />}
          <span>{submitting ? "Signing in…" : "Sign in with email"}</span>
        </Button>
      </form>
    </div>
  );
}
