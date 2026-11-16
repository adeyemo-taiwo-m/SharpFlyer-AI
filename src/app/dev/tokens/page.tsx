import { notFound } from "next/navigation";

const colorTokens = [
  ["background", "bg-background ring-1 ring-border"],
  ["surface", "bg-surface"],
  ["surface-2", "bg-surface-2"],
  ["foreground", "bg-foreground"],
  ["primary", "bg-primary"],
  ["brand", "bg-brand"],
  ["info-tint", "bg-info-tint"],
  ["success", "bg-success"],
  ["success-tint", "bg-success-tint"],
  ["warning", "bg-warning"],
  ["warning-tint", "bg-warning-tint"],
  ["danger", "bg-destructive"],
  ["danger-tint", "bg-danger-tint"],
  ["inverse", "bg-inverse"],
] as const;

const typeTokens = [
  ["text-display-xl", "Sharp flyers, sharp sharp."],
  ["text-display", "Professional flyers in minutes."],
  ["text-h1", "Choose a design"],
  ["text-h2", "Package details"],
  ["text-h3", "Export flyer"],
  ["text-h4", "Solar and inverter"],
  ["text-body-lg", "Pick a design, add your details, and get a flyer with your price and phone number always correct."],
  ["text-body", "5kVA hybrid inverter with 10kWh lithium battery and installation."],
  ["text-body-strong", "Business name and contact number"],
  ["text-callout", "Use this design"],
  ["text-small", "Shows on your flyer exactly as entered."],
  ["text-caption", "1080 × 1920 · WhatsApp Status"],
  ["text-micro", "12 credits"],
  ["text-price-xl", "₦12,500,000"],
  ["text-price", "₦850,000 · 0803 123 4567"],
] as const;

const radiusTokens = [
  ["radius-xs (6px)", "rounded-xs"],
  ["radius-sm (8px)", "rounded-sm"],
  ["radius-md (12px)", "rounded-md"],
  ["radius-lg (16px)", "rounded-lg"],
  ["radius-xl (20px)", "rounded-xl"],
  ["radius-2xl (28px)", "rounded-2xl"],
  ["radius-full (pill)", "rounded-full"],
] as const;

const shadowTokens = ["shadow-1", "shadow-2", "shadow-3", "shadow-4"] as const;

export const dynamic = "force-dynamic";

function TokenPanel({ title, dark = false }: { title: string; dark?: boolean }) {
  return (
    <section
      className={
        dark
          ? "dark rounded-2xl bg-background p-6 text-foreground shadow-3"
          : "rounded-2xl bg-background p-6 text-foreground shadow-2"
      }
    >
      <h2 className="text-h2">{title}</h2>
      <p className="mt-2 text-small text-muted-foreground">₦850,000 · Inter variable · tabular figures</p>

      <div className="mt-6">
        <h3 className="text-h4">Color tokens</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          {colorTokens.map(([name, color]) => (
            <div key={name} className="flex items-center gap-2 text-caption">
              <span className={`size-8 rounded-lg ${color}`} />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-h4">Type scale</h3>
        <div className="mt-3 flex flex-col gap-3">
          {typeTokens.map(([token, sample]) => (
            <div key={token} className="flex flex-col gap-1">
              <span className="text-caption text-muted-foreground">{token}</span>
              <p className={token}>{sample}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-h4">Corner radius scale</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          {radiusTokens.map(([label, radiusClass]) => (
            <div
              key={label}
              className={`flex h-14 min-w-32 items-center justify-center bg-surface px-4 text-caption ${radiusClass}`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-h4">Elevation shadows</h3>
        <div className="mt-3 flex flex-wrap gap-4">
          {shadowTokens.map((shadow) => (
            <div
              key={shadow}
              className={`flex h-16 min-w-28 items-center justify-center rounded-xl bg-surface text-caption ${shadow}`}
            >
              {shadow}
            </div>
          ))}
        </div>
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
        <p className="mt-2 max-w-prose text-body-lg text-muted-foreground">
          Token reference for the light and dark application themes: color palette, type scale, radii, and elevation.
        </p>
        <div className="mt-8 flex flex-col gap-6 lg:flex-row">
          <div className="flex-1">
            <TokenPanel title="Light" />
          </div>
          <div className="flex-1">
            <TokenPanel title="Dark" dark />
          </div>
        </div>
      </div>
    </main>
  );
}
