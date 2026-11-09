# Architecture decisions

Decisions marked **Ask** require founder confirmation before the affected implementation begins. Decisions marked **Decided** are implementation constraints.

| ID | Issue | Recommendation | Status |
|---|---|---|---|
| D1 | Navigation differs between the PRD and design system. | Follow the design system: Home, Templates, Create, My flyers, Account. Brand and Billing live under Account on mobile; desktop may list them directly. | Ask |
| D2 | Render engine: headless Chromium or SVG rasterizer. | Use Satori + resvg-js behind the `RenderClient` interface; fall back to Chromium only if required by a template. | Ask |
| D3 | Payment gateway: Paystack or Flutterwave. | Use Paystack behind a replaceable `PaymentProvider` interface. | Ask |
| D4 | Phone OTP provider is undecided. | Start with Google and email magic link; add phone OTP after a provider is chosen. | Ask |
| D5 | Job queue implementation is undecided. | Start with a database-backed job table plus a direct worker call behind a replaceable interface. | Ask |
| D6 | Generated shadcn components may use CSS Grid. | Rewrite those components to Flexbox and enforce the design grep check in CI. | Decided |
| D7 | Flyer templates may use fonts other than Inter. | Allow commercially licensed flyer fonts; Inter-only applies to the app UI. | Confirm |
| D8 | Starter credits and credit pack prices are undecided. | Keep proposals in one configuration source and label them as proposals. | Ask |
| D9 | Satori does not expose image text nodes for read-back validation. | Validate the laid-out text lines recorded by the fit engine. | Decided |
