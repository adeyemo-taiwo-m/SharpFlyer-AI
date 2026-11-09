import { notFound } from "next/navigation";

const colorTokens = [
  ["background", "bg-background"],
  ["surface", "bg-surface"],
  ["surface-2", "bg-surface-2"],
  ["foreground", "bg-foreground"],
  ["brand", "bg-brand"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-destructive"],
] as const;

const typeTokens = ["text-display-xl", "text-display", "text-h1", "text-h2", "text-h3", "text-h4", "text-body-lg", "text-callout", "text-small", "text-caption", "text-micro", "text-price"];

export const dynamic = "force-dynamic";

function TokenPanel({ title, dark = false }: { title: string; dark?: boolean }) {
  return (
    <section className={dark ? "dark rounded-2xl bg-background p-6 text-foreground shadow-3" : "rounded-2xl bg-background p-6 text-foreground shadow-2"}>
      <h2 className="text-h2">{title}</h2>
      <p className="mt-2 text-small text-muted-foreground">₦850,000 · Inter variable · tabular figures</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {colorTokens.map(([name, color]) => (
          <div key={name} className="flex items-center gap-2 text-caption">
            <span className={`size-8 rounded-lg ${color}`} />
            {name}
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-3">
        {typeTokens.map((token) => <p key={token} className={token}>{token}</p>)}
      </div>
      <div className="mt-8 flex flex-wrap gap-4">
        {["shadow-1", "shadow-2", "shadow-3", "shadow-4"].map((shadow) => <div key={shadow} className={`flex h-16 min-w-28 items-center justify-center rounded-xl bg-surface text-caption ${shadow}`}>{shadow}</div>)}
      </div>
    </section>
  );
}

export default function TokensPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-dvh bg-surface p-4 text-foreground sm:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-callout text-brand-text">SharpFlyer development tools</p>
        <h1 className="mt-3 text-h1">Design tokens</h1>
        <p className="mt-2 max-w-prose text-body-lg text-muted-foreground">Token reference for the light and dark application themes.</p>
        <div className="mt-8 flex flex-col gap-6 lg:flex-row">
          <div className="flex-1"><TokenPanel title="Light" /></div>
          <div className="flex-1"><TokenPanel title="Dark" dark /></div>
        </div>
      </div>
    </main>
  );
}
