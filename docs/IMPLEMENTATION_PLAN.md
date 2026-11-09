# SharpFlyer AI: Implementation Plan for the AI Coding Agent

**Version 1.0 · 9 Nov 2026 · Stack: Next.js (App Router), TypeScript, Tailwind v4, shadcn/ui, Supabase, Zod, render worker**

This plan turns `docs/PRD.md`, `README.md`, `docs/DESIGN_SYSTEM.md`, and the `sharpflyer-product-engineering` skill into an ordered build. Follow it top to bottom. Do not skip ahead.

---

## 0. How to use this plan

### 0.1 Read order (every session)

1. `README.md` (map of the codebase and the 10 invariants)
2. This file (find the current step)
3. The PRD sections and requirement IDs the step names. **Look up the exact FR/NFR/AI IDs in the full `docs/PRD.md`; this plan names topics, not invented IDs.**
4. `docs/DESIGN_SYSTEM.md` for any UI step
5. `docs/DECISIONS.md` so settled decisions are not reversed

### 0.2 Instruction priority

User instruction → invariants (README section 2 and skill section 2) → PRD → README/DECISIONS → design system (wins on all visual/UX questions) → this plan.

### 0.3 Workflow for every step

Understand → Inspect → Plan → Implement → Verify → Report (skill sections 3 and 24). For each step:

- Quote the requirement IDs in your plan.
- Make the smallest coherent change.
- Run `pnpm lint`, `pnpm typecheck`, and the tests named in the step.
- For UI: run the app and look at it at 360px, 768px, and 1280px, in light and dark.
- For rendering: look at the actual PNGs. **Never ship a flyer-generation change you have not seen produce correct flyers.**
- End with the completion report: what changed, requirement IDs, invariants checked, verification, not done, follow-ups.

### 0.4 Approval gates (STOP and wait for the founder)

Present a plan and wait before: any migration touching `credit_ledger`, `payments`, `subscriptions`, or auth tables; any RLS change; billing or credit logic; adding any dependency not listed in Appendix A; spending money (live payments, paid AI beyond small tests); deleting data. Steps marked **[GATE]** below are these.

### 0.5 Things that are never allowed

Critical text (business name, price, old price, phone, address, logo) generated or altered by any model. Validator weakened to pass a test. Credits changed from the client. Payment trusted from a redirect. A user table without RLS. The service-role key in client code. Fake templates, customers, ratings, or stats in the UI. CSS Grid, gradients, glass/blur, or a second font family in the app UI.

---

## 1. Build order at a glance

Screens and features are ordered by how much of the product's core promise they carry. The core promise is: **pick a design, enter details, get a flyer with the correct price and phone number.**

| Phase | Name | What you get | Priority |
|---|---|---|---|
| 0 | Bootstrap | Repo, tokens, shadcn, tooling | Foundation |
| 1 | Shared foundations | Naira/phone helpers, schemas, Result types | Foundation |
| 2 | Template system and renderer | A real flyer rendered from data, validated | **Most important** |
| 3 | Data layer and auth | Schema, RLS, sign-in, free starter credits | **Most important** |
| 4 | Core screens | Gallery → Editor → Export (vertical slice) | **Most important** |
| 5 | Credits UI and payments | Buy credits, webhooks, billing | Must Have |
| 6 | Onboarding, My flyers, Brand, Dashboard | Repeat use | Must/Should Have |
| 7 | Landing, Pricing, legal | Public site | Must Have |
| 8 | AI features | Copy suggestions, background removal | Should Have |
| 9 | Formats, editing, duplicate, share | Completeness | Should Have |
| 10 | Admin and analytics | Operations | Could/Must (events) |
| 11 | Hardening and launch | Security, performance, deploy | Release |
| 12 | Post-MVP | Mode B, natural-language edits | Could Have |

**Screen priority list (build in this order):**

1. Editor (form + preview stage + generate progress + validation banner)
2. Export sheet (credit cost, format, success)
3. Template gallery and template detail
4. App shell (navigation, credit badge). Built first as a container in 4.1, then refined.
5. Sign-in
6. Credit sheet and out-of-credits state
7. Billing / plan selector
8. My flyers
9. Brand profile
10. Dashboard
11. Onboarding
12. Landing, Pricing, legal pages
13. Account settings
14. Admin

**Milestone M1** is the end of Phase 4: a signed-in user can open a template, fill the form, see a correct preview, and export a PNG that costs one credit. Everything after M1 builds on a working product.

---

## 2. Conflicts and open decisions to resolve first

Record each in `docs/DECISIONS.md` in Step 0.1. Ask the founder for the ones marked **Ask**.

| # | Issue | Recommendation | Status |
|---|---|---|---|
| D1 | **Navigation differs.** PRD: Home, Templates, My Flyers, Brand, Billing. Design system: Home, Templates, Create, My flyers, Account. | Follow the design system (it wins on UX). Brand and Billing live under Account on mobile; the desktop sidebar may list them directly. | **Ask** |
| D2 | **Render engine** (README section 7): Chromium or SVG rasterizer. | Satori + resvg-js (flexbox-only layout, deterministic, light, cheap). Fits the "no CSS Grid" rule. Fall back to Chromium only if a template needs what Satori cannot do. | **Ask** |
| D3 | **Payment gateway:** Paystack or Flutterwave. | Paystack, behind `PaymentProvider`. Replaceable later. | **Ask** |
| D4 | **Phone OTP provider** undecided. | Ship Google and email magic link first. Add phone OTP when a provider is chosen (Phase 6). | **Ask** |
| D5 | **Job queue** implementation. | Start with a database-backed job table plus direct worker call; keep the `RenderClient` interface so a managed queue can replace it. | **Ask** |
| D6 | shadcn components generated with `grid` classes (Checkbox indicator, RadioGroup, FormItem, Alert) violate "no CSS Grid". | Rewrite those to Flexbox after generation. Add a CI grep check (Step 0.6). | Decided |
| D7 | Flyer templates use fonts (for example Poppins) while the app UI is Inter only. | Allowed: the rule applies to the app interface, not to flyer artwork. Fonts must be commercially licensed (OFL is fine). | Confirm |
| D8 | Starter free credits amount and credit pack prices. | Keep in one config file. These are **proposals to be validated**, never presented as final. | **Ask** |
| D9 | Text in Satori renders as vector paths, so "read back text nodes" validation is not possible from the image. | Validate the laid-out text lines recorded by the fit engine (see Step 2.6). | Decided |

---

## Phase 0: Bootstrap

### 0.1 Docs and decisions

**Do**
- Put `PRD.md`, `DESIGN_SYSTEM.md`, `TEMPLATE_SPEC.md` (stub), `AI_SPEC.md` (stub), `DECISIONS.md` in `docs/`. Put `README.md` at the root.
- Create `CLAUDE.md` (short): "Read README.md first. Follow the `sharpflyer-product-engineering` and `design-quality-enforcement` skills. Follow `docs/IMPLEMENTATION_PLAN.md` in order."
- Save this plan as `docs/IMPLEMENTATION_PLAN.md`.
- Seed `docs/DECISIONS.md` with the table in section 2 (status: open or decided).

**Done when:** all docs are in place and `DECISIONS.md` lists D1 to D9.

### 0.2 Scaffold the app

**Do**
- Create the Next.js app with pnpm: App Router, TypeScript `strict`, `src/` directory, Tailwind v4, ESLint.
- Create the folder structure from README section 5 (empty folders may contain `.gitkeep`): `src/app/(public)`, `src/app/(app)/app`, `src/app/(admin)/admin`, `src/app/api`, `src/components/{ui,sharpflyer}`, `src/lib`, `src/schemas`, `src/server/{auth,flyers,templates,render,credits,billing,ai,storage,analytics}`, `src/types`, `templates/`, `render-worker/`, `tests/{unit,integration,e2e,visual}`.
- Set `<html lang="en-NG">`.

**Done when:** `pnpm dev` serves a blank page; `pnpm build` passes.

### 0.3 Tooling and scripts

**Do**
- Add Vitest (unit and integration) and Playwright (e2e and visual).
- Add scripts: `lint`, `typecheck`, `test`, `test:e2e`, `test:visual`, `templates:validate`, `templates:sync`.
- Add a GitHub Actions workflow: lint → typecheck → unit/integration → template validation → build. (E2E added in Phase 11.)
- Add the design grep check as a CI step (see 0.6).

**Done when:** all scripts run (empty suites are fine) and CI is green.

### 0.4 Environment validation

**Do**
- Create `src/lib/env.ts` with Zod: separate `serverEnv` and `clientEnv` objects; only `NEXT_PUBLIC_*` in `clientEnv`.
- Create `.env.example` with the variables listed in README section 15.
- Throw a clear startup error if a required variable is missing (server only).

**Done when:** the app fails fast with a readable message when a required variable is missing. The service-role key is not importable from client code.

### 0.5 Design tokens and theming

**Do**
- Implement `globals.css` exactly as in design system section 13.3 (tokens, `@theme inline`, shadows, motion, reduced-motion) and the text utilities from 13.4.
- Font setup in `layout.tsx` per section 13.2: Inter variable, subsets `latin` and `latin-ext`, `display: swap`.
- Verify `₦850,000` renders in Inter. If tabular figures or `₦` fall back, switch to `next/font/local` with the official Inter variable file (open item 3 in the design system).
- Theme: Light, Dark, System. Apply the `dark` class before paint (inline script in `<head>`); store the choice in local storage now and in the account later.

**Done when:** a dev-only page at `/dev/tokens` shows the color tokens, type scale, radii, and shadows in both themes. The page is excluded from production builds.

### 0.6 shadcn/ui setup and restyle

**Do**
1. Initialise shadcn with the `components.json` from design system 13.5.
2. Install the components needed through Phase 6 first: `button`, `input`, `textarea`, `label`, `form`, `select`, `checkbox`, `radio-group`, `switch`, `tabs`, `toggle-group`, `dialog`, `sheet`, `drawer`, `popover`, `dropdown-menu`, `tooltip`, `sonner`, `badge`, `avatar`, `skeleton`, `progress`, `alert`, `separator`, `scroll-area`, `table`. Install the rest (`slider`, `command`, `pagination`, `breadcrumb`, `accordion`) when first needed.
3. Restyle each to design system section 9: pill buttons (variants and sizes from 9.1), filled borderless inputs (48px, 12px radius), 28px dialogs, bottom sheets on mobile, flat overlays, shadows only on floating layers.
4. **Remove every `grid` class** from generated components and replace with Flexbox.
5. Do not change behavior or ARIA logic.
6. Add `scripts/check-design.sh` that fails CI if `src/` contains `grid`, `grid-cols`, `bg-gradient`, `backdrop-blur`, `blur-` (on non-image elements), or raw hex colors outside `globals.css`.

**Done when:** `/dev/ui` shows every installed component in default, hover, focus-visible, pressed, disabled, loading, and error states, in light and dark, at 360px. `check-design.sh` passes.

### 0.7 Supabase local

**Do:** `supabase init`; confirm `supabase start` and `supabase db reset` work with an empty migration set; add `supabase/seed.sql` placeholder.

**Done when:** local Supabase runs and the app can read the project URL and anon key from env.

---

## Phase 1: Shared foundations (pure logic, write tests first)

### 1.1 Result and error types

**Do**
- `src/types/result.ts`: `Result<T, E>`, `ok()`, `err()`.
- `src/lib/errors.ts`: `AppError { code, message }` with stable codes: `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INSUFFICIENT_CREDITS`, `RENDER_FAILED`, `RENDER_VALIDATION_FAILED`, `UPLOAD_INVALID`, `AI_TIMEOUT`, `AI_INVALID_OUTPUT`, `AI_LIMIT_REACHED`, `AI_REFUSED`, `PAYMENT_FAILED`, `RATE_LIMITED`, `INTERNAL`.
- A shared map from code to friendly user message (copy from design system 11.4 style: sentence case, specific, no apologies).

**Tests:** type-level and unit tests for helpers.

### 1.2 Naira and phone helpers

**Do**
- `src/lib/money.ts`: `toKobo(naira)`, `formatNaira(kobo)` → `₦850,000` (no space, commas), `parsePriceInput(string)` (strips commas and spaces, rejects negatives, decimals, non-numbers).
- `src/lib/phone.ts`: `normalizePhone(input)` accepts `0803 123 4567`, `+234 803 123 4567`, `2348031234567`; returns E.164; `formatPhoneDisplay(e164)` → `0803 123 4567`; plausible international numbers produce a warning, not a rejection.
- Money is always integer kobo. No floats.

**Tests (required by the skill):** zero, very large (`₦12,500,000`), small (`₦5,000`), invalid strings, leading zeros, international, spaces, hyphens.

### 1.3 Zod schemas

**Do** (in `src/schemas`)
- `TemplateSchema` exactly matching README section 8: `meta` (id, version, title, category, tags, style, license), `formats`, `palettes`, `fields`, `regions` per format, `decor`, `constraints`.
- `FlyerContentSchema`: headline, body/offer, price, oldPrice (must be greater than price), phone, businessName, address (optional), logoAssetId, productImageAssetIds, themeId, format.
- `RenderRequest` / `RenderResult` types per README section 7 in `src/types/render.ts`.
- Format enum: `status | ig_post | story | fb_post | a4` with pixel sizes (Status and Story 1080x1920, IG post 1080x1080, others per template).
- Mark **critical fields** in one constant list (`businessName`, `price`, `oldPrice`, `phone`, `address`, `logo`). Everything else imports it.

**Tests:** valid and invalid fixtures; `oldPrice <= price` fails.

### 1.4 Contrast and text utilities

**Do:** `src/lib/contrast.ts` (WCAG ratio from two token colors), `src/lib/text.ts` (normalize whitespace without changing characters).

**Tests:** known pairs from design system 3.5 (for example `#1D1D1F` on white = 16.83).

---

## Phase 2: Template system and render engine

This phase is the heart of the product. Build it before any screen that depends on it. It is developed as a command-line harness first, with no UI.

### 2.1 Record the render engine decision

**Do:** Confirm D2 with the founder; write it in `DECISIONS.md`. The steps below assume Satori + resvg-js. If the decision differs, keep the `RenderClient` interface identical.

### 2.2 Template loader and validator

**Do**
- `src/server/templates/load.ts`: read `templates/<id>/template.json`, validate with `TemplateSchema`, return typed `Result`.
- `pnpm templates:validate`: validates every template, checks every field has a region in every declared format, fonts exist in `assets/`, and license info is present.
- Enforce immutability: a published `id@version` hash is recorded; changing the file without bumping `version` fails validation.

**Tests:** valid template passes; missing region, missing license, or unknown field type fails.

### 2.3 Author the first templates

**Do**
- Create 3 original solar/inverter templates (`solar-bold-001`, `solar-clean-002`, `solar-dark-003`) with `ig_post` and `status` formats first. Other formats are added in Phase 9.
- Each has at least 2 palettes, regions for headline, body, price, oldPrice, phone, businessName, productImage, logo, and constraints.
- Use only original shapes or assets with a license note. Use OFL fonts (for example Inter and Poppins) and record the source.
- If real designer files are not available yet, build clean geometric placeholders and flag them for designer replacement. Do not copy any competitor or social-media flyer.
- Generate a `preview.png` per template (under about 80 KB, true aspect ratio).

**Done when:** `pnpm templates:validate` passes for 3 templates.

### 2.4 Text-fit engine (deterministic)

**Do** in `render-worker/src/engine/fit.ts`
- Measure text with real font metrics (use a font-parsing library, see Appendix A; Satori itself has no measuring API).
- Algorithm: wrap to region width → if lines exceed `maxHeadlineLines` or height, reduce size step by step down to `minSize`.
- Optional fields may truncate with an ellipsis. **Required and critical fields never truncate**: if they cannot fit at `minSize`, return a warning or error.
- Record the final laid-out lines for every field (used by the validator in 2.6).
- Same input must give the same output every time.

**Tests:** short, normal, long, extreme headlines; ₦5,000 and ₦12,500,000; very long business name; missing optional fields.

### 2.5 Render pipeline

**Do** in `render-worker/src/engine/`
1. Load the template and pin its version.
2. Resolve the palette (template palette or brand colors) into role tokens.
3. Build the layout tree from `regions` for the requested format.
4. Run the fit engine for each text field.
5. Place images with `contain`, `cover`, or `smart-crop`; never stretch; keep transparency; apply shadow and mask options.
6. Build the Satori element tree (flexbox positioning), render SVG, rasterize with resvg-js to PNG; produce JPG from PNG; support `scale` 1 or 2.
7. Return `{ ok, outputBuffer, warnings, errors, metrics }`.
- Critical text comes **only** from structured content. No AI or image model in this package.

**Done when:** a CLI command `pnpm --filter render-worker render --template solar-bold-001 --fixture normal --format ig_post` writes a PNG you have opened and checked by eye.

### 2.6 Output validator (release gate)

**Do** in `render-worker/src/validate/`
- **Critical-text equality:** for each critical field, join the laid-out lines recorded by the fit engine and compare with the formatted input string (`formatNaira`, `formatPhoneDisplay`). Any difference, including a dropped digit or changed character, is an error and blocks export. Do not normalize in a way that could hide a difference.
- Required regions populated.
- No overflow beyond region or safe area.
- Contrast: 4.5:1 body, 3:1 large text; otherwise a warning with a "use a recommended color" fix.
- Images not stretched; resolution below threshold gives a warning.
- The worker never returns a file when `errors` is non-empty.

**Tests:** prove each failure type is caught (deliberately corrupt a laid-out string, force an overflow, pick a low-contrast palette) and that valid output passes. Do not mock the validator.

### 2.7 Worker service and client

**Do**
- `render-worker/src/server.ts`: `POST /render` (shared-secret header), `GET /health`; accepts the `RenderRequest` shape; fetches assets from signed URLs; returns the `RenderResult` and writes the file to storage via a signed upload URL provided in the request (or returns bytes to the server, which stores them; choose the simpler one and record it in `DECISIONS.md`).
- `src/server/render/client.ts`: `RenderClient` interface with an HTTP implementation. In local dev, the worker runs as a second process.
- `render-worker/Dockerfile`.
- Fonts embedded in the worker; no network font fetching at render time.

**Done when:** the Next.js server can call the worker locally and get a validated preview.

### 2.8 Visual regression harness

**Do:** `tests/visual/` renders every template × format × content fixture (short, normal, long, extreme) and compares to committed snapshots. Add fixtures for transparent logos, small and wide product images, missing optional fields.

**Done when:** `pnpm test:visual` passes and you have reviewed the snapshots yourself.

> **Phase 2 gate:** do not start Phase 4 until you have looked at rendered samples for all three templates with all four content fixtures.

---

## Phase 3: Data layer and authentication

### 3.1 Core schema migration **[GATE]**

Present the migration plan, then implement. Additive migrations only.

**Tables** (`supabase/migrations`, `snake_case`, `timestamptz` UTC, constraints and indexes on foreign keys):
- `profiles` (user id, business name default, onboarding state, theme preference)
- `brand_profiles` (one per user: logo asset, colors, phone E.164, business name, address)
- `templates` (id, version, title, category, tags, style, formats, status, license metadata; definition loaded from repo files)
- `flyers` (user_id, template_id, template_version pinned, `content` JSONB, status, format)
- `flyer_versions` (immutable snapshots: flyer_id, content snapshot, template_version, format, export asset id)
- `assets` (user_id, kind, bucket path, `hash`, `width`, `height`, `mime_type`, `size`, soft-delete)

**RLS:** enable on every user-owned table with explicit select/insert/update/delete policies (`auth.uid() = user_id`). `flyer_versions` are insert-only for users via server functions. No `USING (true)` on user data.

**Tests:** cross-user read and write denial for every table. Migration applies cleanly with `supabase db reset`.

### 3.2 Credit ledger **[GATE]**

**Do**
- `credit_ledger` (user_id, integer `delta`, `reason` enum: grant, purchase, export, refund, adjustment, `reference_id`, created_at). RLS: select own only; no insert/update/delete policies for users.
- Database functions (security definer, server-callable only): `consume_credit(user, flyer_version)` (advisory lock per user, compute balance as sum of delta, raise `insufficient_credits` if below 1, insert row, return new balance), `refund_credit(user, reference)`, `grant_credits(user, amount, reason, reference)`. All idempotent on `(reason, reference_id)`.
- `src/server/credits`: `getBalance`, `consumeCredit`, `refundCredit`, `grantCredits` returning typed `Result`.
- Never store a mutable balance.

**Tests (mandatory):** balance equals ledger sum; concurrent exports with balance 1 (exactly one succeeds); failed render leaves balance unchanged; refund path; duplicate request idempotency.

### 3.3 Authentication

**Do**
- Supabase Auth with `@supabase/ssr`. Start with **Google and email magic link** (D4).
- `src/server/auth`: `requireUser()`, `requireAdmin()` (admin flag stored server-side, not user-editable).
- Middleware protects `/app/*` and `/admin/*`.
- Rate-limit login and magic-link endpoints per identifier and per IP.
- Login and recovery errors must not reveal whether an account exists.
- Export requires a verified account.
- On first sign-in create the `profiles` row and a one-time starter credit grant through `grant_credits` (amount from the config file, D8).

**Tests:** unauthenticated, wrong-user, and admin-only route access.

### 3.4 Storage and upload pipeline

**Do**
- Private buckets `uploads` and `renders`. Short-lived signed URLs.
- Upload flow: client requests an upload URL (server validates declared type and size) → client uploads → server verifies magic bytes, real dimensions, size → creates the `assets` row with hash and metadata.
- Limits: logo 5 MB, product image 10 MB. Allowed: PNG, JPG, WebP; SVG only for logos after sanitization.
- Resume or retry on interrupted uploads.
- Scheduled cleanup of orphaned and soft-deleted files (can be stubbed until Phase 11).

**Tests:** wrong MIME, oversized, corrupt, spoofed extension, malicious SVG, interrupted upload.

### 3.5 Template sync

**Do:** `pnpm templates:sync` upserts template metadata into `templates`. `src/server/templates`: `listTemplates(filters)`, `getTemplate(id)`.

---

## Phase 4: Core screens (vertical slice to Milestone M1)

Follow the design system for every screen. Every screen: mobile first at 360px, all states designed (loading, empty, error, success), Flexbox only, tokens only.

### 4.1 App shell

**Do**
- `(app)/app/layout.tsx`: requires the user.
- Mobile: top app bar (56px: logo or back, page title, credit badge) and bottom tab bar (64px plus safe area; Home, Templates, Create, My flyers, Account), per D1.
- Desktop (`lg`+): 248px left sidebar with logo, nav, credit summary, "Buy credits".
- Credit badge component (design system 10.4): count tabular; low state at 3 or fewer; empty state at 0; tapping opens a sheet (the sheet content is finished in Phase 5; for now show balance and "Buy credits" disabled with a plain note).
- Logo: build the text wordmark from the spec as a temporary asset (design system 2.3), with the symbol as a component from the construction rules. Flag it as temporary.
- Auto-save indicator slot ("Saved" or "Saving…") in the app bar for the editor.

**Done when:** you can sign in and navigate between empty placeholder pages on mobile and desktop, in light and dark.

### 4.2 Template gallery (`/app/templates`)

**Do**
- Page title, search field, horizontally scrollable category chips (segmented style) only if filters help. Preselect the user's business type if known.
- Template tiles per design system 10.1: image at true aspect ratio, 20px radius, title and category below, no card, no border, no shadow at rest; desktop hover adds `shadow-2` to the image.
- Layout with flex-wrap: 2 columns on mobile, 3 at `md`, 4 at `lg`; gaps 16 and 24.
- Thumbnails lazy-loaded with reserved aspect-ratio space and a `surface` placeholder.
- States: skeleton list, "No designs match 'xyz'" with "Clear search", error with retry.
- Template detail (`/app/templates/[id]`): large preview, title, category, formats, palette swatches, `brand` "Use this design" button. On mobile this may be a sheet.
- "Use this design" creates a draft flyer through a server action and redirects to the editor.

**Done when:** gallery loads fast on throttled 4G, keyboard and screen reader operable, 3 real templates shown. No fake templates.

### 4.3 Flyer editor (`/app/create/[draftId]`), the most important screen

Build in these sub-steps. Layout: desktop = preview stage fills the flexible area with a 420px form panel on the right; mobile = collapsible preview on top, form sections below, sticky bottom bar with the primary action.

**4.3.1 Form state and draft auto-save**
- `react-hook-form` + Zod (`FlyerContentSchema`). Validate on blur, then on change after the first error. Preserve data on error.
- Debounced `saveDraft` server action (validated, ownership-checked). Local copy in `localStorage` for offline recovery. Indicator shows "Saving…" or "Saved". Banner when offline: "You're offline. Your draft is saved on this phone."

**4.3.2 Content section**
- Headline (with character counter from the template's `maxLength`), offer/body, business name.
- **Price field** (design system 10.5): fixed `₦` prefix, `inputmode="numeric"`, thousands separators as you type, helper "Shows as ₦850,000". Old price optional; error "Old price must be higher than the new price."
- **Phone field** (10.6): `+234` prefix pill, `inputmode="tel"`, accepts `0803…`, `+234…`, `234…`; normalizes silently; helper "This number appears on your flyer exactly as shown here." Never wraps.
- Labels above fields; "(optional)" marked in muted text; inline errors with icon and text.

**4.3.3 Images section**
- Upload dropzone (10.7) for logo and product image with progress, cancel, replace, remove, and specific errors. On mobile it opens the system file or camera chooser.
- Uses the upload pipeline from 3.4.

**4.3.4 Style section**
- Color theme swatches (10.8) from the template's palettes; contrast warning icon on failing combinations.

**4.3.5 Format section**
- Format switcher (10.3): Status, Post, Story, Facebook, A4 as available for the template; shows pixel size under the selected item. Switching keeps all content and cross-fades the preview.

**4.3.6 Preview stage and generate flow**
- Stage per 10.2: `surface`, 28px radius, flyer at true proportions with `shadow-2`, optional zoom controls.
- "Generate flyer" server action: validate content → request render (preview purpose, lower resolution) via `RenderClient` → show **generation progress** (10.10) reflecting real job states ("Preparing your design", "Placing your details", "Checking your flyer") → show preview. Keep the previous render visible and cross-fade while updating.
- Failure: danger-tint alert with the reason, "Try again", and the statement that no credit was used.
- **Validation banner** (10.11): overflow, contrast, and image-quality warnings with a one-tap fix; blocking errors sit above the Export button and disable it with an explanation.
- Preview must match what will be exported: same template version, same content, same engine.

**Tests**
- Unit: form schemas, price and phone behavior.
- E2E (Playwright, 360px viewport): open a template → fill the form → generate → see preview → refresh the page and find the draft intact.
- Visual check of the screen in light and dark.

### 4.4 Export (modal on the editor)

**Do**
- Bottom sheet on mobile, dialog on desktop (design system 10.12): format summary row, file type segmented control (PNG, JPG), resolution toggle (Standard, High for print), row "This export uses 1 credit" with the balance after, one `brand` "Export flyer" button (full width on mobile).
- Server action `exportFlyer(flyerId, version)`:
  1. `requireUser()`, verify ownership and verified account.
  2. Validate content again server-side; re-run the validator through the full-resolution render.
  3. Create the `flyer_version` and call `consume_credit` in one transaction path.
  4. Render final resolution; **if the render or validation fails after deduction, insert a refund ledger row in the same failure path.**
  5. Store the export, return a short-lived signed download URL.
- Re-download of an existing version is free.
- Out of credits: block at export with a clear prompt (full flow finished in Phase 5); the draft is preserved.
- Success: "Flyer exported" with **Share** (primary, Web Share API where available) and **Save to device** (secondary). The same verb is used in the toast.

**Tests:** export consumes exactly one credit; failed render refunds; double-click does not double charge; exporting the same version twice charges once; mismatched critical text blocks export.

### 4.5 Milestone M1 check

- [ ] Sign in → pick a template → fill the form → correct preview → export PNG → credit decreases by one.
- [ ] Price and phone on the exported image equal the input exactly, for ₦5,000 and ₦12,500,000.
- [ ] Works at 360px on a throttled connection.
- [ ] RLS tests pass; no secrets in client bundle.
- [ ] Design QA checklist (design system 14.2) done for gallery, editor, export.

Report the M1 completion report to the founder before continuing.

---

## Phase 5: Credits UI and payments

### 5.1 Credit sheet and out-of-credits flow

**Do:** The credit badge sheet shows balance, what each action costs, and "Buy credits". Low-credit copy: "You have 2 credits left." Out-of-credits at export opens the same sheet; the draft is untouched.

### 5.2 Pricing configuration

**Do:** one configuration source (for example `src/config/pricing.ts`) for plans, credit packs, allowances, and starter credits. Amounts in kobo. Label values as proposals in the comments. Nothing else hard-codes a price.

### 5.3 Payments **[GATE]**

**Do**
- `PaymentProvider` interface; Paystack implementation (D3) in `src/server/billing`.
- `payments` and `subscriptions` tables and a `webhook_events` table (event id unique) with RLS; users can read their own payments only.
- Start checkout: server creates a `payments` row as `pending` and a provider checkout session. The client only receives the checkout URL.
- `POST /api/webhooks/payments`: verify signature → check event id for idempotency → **confirm the transaction with the provider API** → one DB transaction: mark `succeeded` and insert the credit grant (or activate the subscription). Duplicate events do nothing. Tolerate out-of-order delivery.
- Never grant access from a redirect or client callback; the return page polls payment status from the server and shows "Payment pending" for bank transfer delays.
- Failure states: failed payment, abandoned checkout, failed renewal (grace period, notification, downgrade). Receipts and billing history.
- Use sandbox keys only. No live charges.

**Tests:** valid, duplicate, forged, out-of-order, and failed events; sandbox purchase end to end.

### 5.4 Billing page (`/app/billing`)

**Do:** current plan and credits at the top, plan selector (design system 10.13) with tabular prices, billing history as a simple table (stacked list on mobile), clearly accessible cancel. No fake scarcity, "Most popular" only if true and data-backed. Payment error copy: "Payment didn't go through" plus reason and "Try again".

---

## Phase 6: Onboarding, My flyers, Brand profile, Dashboard

### 6.1 My flyers (`/app/flyers`)

**Do:** list of the user's flyers with thumbnail, title, format, date (9 Nov 2026 format, Africa/Lagos). Actions: open, duplicate, delete (confirmation naming the object: "Delete 'Weekend sale'? This removes the flyer and its exports."). Empty state: "No flyers yet" plus "Choose a design". Skeleton loading. "Duplicate" creates a new draft pinned to the original template version.

### 6.2 Brand profile (`/app/brand`)

**Do:** logo, colors, phone, business name, address, stored in `brand_profiles`. New drafts and "Create another" prefill from it. Saving uses the same validators as the editor (E.164 phone, uploads pipeline).

### 6.3 Onboarding

**Do:** after first sign-in, at most three skippable screens: business type, business name and contact, optional logo and colors. Business type preselects the gallery filter.

### 6.4 Dashboard (`/app`)

**Do:** greeting, credit balance, "Create another" with saved brand details prefilled, recent flyers. Keep it light; no decorative widgets.

### 6.5 Phone OTP (when D4 is decided)

**Do:** add phone OTP sign-in behind the chosen provider interface; rate-limit per number and per IP; never log OTP codes.

### 6.6 Account settings (`/app/settings`)

**Do:** profile, theme (Light, Dark, System, saved to the account), sign out, delete account and data per PRD retention rules.

---

## Phase 7: Public site

These pages carry no logic but must be honest. They may be built in parallel with Phases 5 and 6 by a second agent once Phase 2 can render real flyers.

### 7.1 Landing page (`/`)

**Do** (design system 11.2)
- Order: hero (`display-xl` once, one-line value statement, `brand` `xl` "Get started", live before-and-after of a real template filled in) → how it works in three real steps → template preview strip → the accuracy promise with a real example → pricing summary → FAQ → final call to action → footer with legal links.
- Use real flyers produced by the renderer. No fake logos, testimonials, or statistics.
- One optional orchestrated moment (hero flyer assembling once), skippable, never delaying content.
- Tagline "Sharp flyers, sharp sharp." on this page only, not in errors or billing.
- Marketing header: logo, Templates, Pricing, Log in, `brand` "Get started"; sheet menu on mobile.

### 7.2 Pricing (`/pricing`)

**Do:** reads from the pricing config; states plainly that prices are current offers; no fake urgency.

### 7.3 Legal and contact

**Do:** `/terms`, `/privacy`, `/contact` as document layout (680px column). Draft the structure and the technical facts (providers used, data retained) from the PRD. **Do not claim NDPA or other legal compliance**; flag the text for review by a qualified advisor.

### 7.4 SEO and sharing basics

**Do:** metadata, Open Graph image (1200x630) from the logo spec, favicon, PWA icons (maskable), `lang="en-NG"`.

---

## Phase 8: AI features (Should Have)

### 8.1 AI service layer skeleton

**Do**
- `src/server/ai` per README section 9: `index.ts`, `providers/`, `prompts/`, `schemas.ts`, `limits.ts`, `cost.ts`, `fallbacks.ts`.
- `LLMProvider`, `ImageProvider`, `BackgroundRemovalProvider` interfaces. Callers never import provider SDKs.
- `ai_requests` table (provider, model, usage, cost, latency, status) with RLS (**[GATE]** if it touches billing).
- `enforceLimits(userId, kind)`: per-user allowance and per-IP rate limit, checked server-side before every provider call.

### 8.2 `suggestCopy` (headline, offer wording, call to action)

**Do**
- Versioned prompt `prompts/copy.v1.ts`. The prompt gets business type, offer facts, tone, and the template's character limits. It never receives or returns phone, address, business name, or prices to rewrite.
- Zod `CopySuggestionsSchema`; retry once on invalid output; then a typed error.
- Post-filter: remove invented claims (warranty, discounts, specs not supplied by the user), enforce length, strip contact details.
- Timeout 8 seconds. Log every request. Failure never consumes credits.
- Fallback: user types their own text (editor always works without AI).
- Pidgin tone is optional, never default, never for critical text.
- Evaluation set in `tests/ai-eval` (50+ inputs: normal, adversarial, ambiguous, Pidgin). Report results and estimated cost per call.

### 8.3 Copy suggestion UI

**Do:** "Suggest headlines" button (ordinary icon, no sparkles). Three full-width rows (design system 10.9) with character count; tapping a row inserts the text (editable). "Try again" and "Write my own" ghost buttons. Nothing is inserted without a tap.

### 8.4 Background removal

**Do:** `removeBackground` through the AI layer; cache by image hash; keep the original; user can switch back. Reject or flag results with artifacts. Clear fallback: use the original image.

### 8.5 AI cost guardrails

**Do:** daily cost view per request type, alert threshold, per-flyer and per-day regeneration limits. Report cost per exported flyer. Do not invent provider prices; read them from the provider's current pricing and record the date.

---

## Phase 9: Formats, editing, duplicate, share

### 9.1 Remaining formats

**Do:** add `story`, `fb_post`, and `a4` regions to all templates (new template versions, never edit published ones). Update visual regression for every format. One design resizes into every format with its own safe areas.

### 9.2 Basic post-generation editing

**Do:** edit text fields, colors, and image position within template constraints. No free drag-and-drop canvas (Won't Have).

### 9.3 Share

**Do:** Web Share API with file sharing where supported (WhatsApp Status flow), with Save to device fallback.

### 9.4 More templates

**Do:** grow to 15 to 25 templates following playbook 23.1 in the skill. Each needs license notes, four content fixtures, and a real-phone check.

---

## Phase 10: Admin and analytics

### 10.1 Analytics events

**Do:** typed `track()` helper in `src/server/analytics` (and a thin client wrapper) for the PRD event list. No unnecessary personal data. Needed to measure activation, time to first export, repeat creators, and export success.

### 10.2 Observability

**Do:** error tracker for app and worker; render job logs (job id, template, format, duration, result); correlation id from UI to render to storage; alerts for render failures, webhook failures, and cost per export over the ceiling.

### 10.3 Admin panel (Could Have)

**Do:** `/admin` guarded by `requireAdmin()`: template management view, users, usage and AI cost. Admin actions write to `audit_logs`. Not reachable by obscure URL alone.

---

## Phase 11: Hardening and launch

### 11.1 Security pass

**Do:** run the security tests: cross-account access on every table and route, forged webhooks, malicious uploads, rate limits on auth, uploads, AI, and render endpoints. Confirm no secrets in the client bundle or logs. Secure cookie and header defaults. Dependency review.

### 11.2 Performance and slow networks

**Do:** test the core journey on throttled 4G and a mid-range Android phone. Check gallery, upload, preview, and export. Thumbnails under about 80 KB. Fix layout shift. No heavy libraries added for styling.

### 11.3 Accessibility pass

**Do:** keyboard-only path; TalkBack and VoiceOver check of the core journey; focus order; reduced motion; contrast for every new combination; 200% zoom. Light and dark both checked.

### 11.4 E2E and CI

**Do:** Playwright suites for sign up → pick template → export on mobile and desktop viewports; billing sandbox flow. Add them to CI (lint → typecheck → unit/integration → template validation → build → e2e on preview → deploy).

### 11.5 Deployment

**Do:** Next.js app on a Next-friendly host with preview deploys; render worker in a container host protected by the shared secret; Supabase daily backups and migrations applied through CI; public HTTPS webhook endpoint. Scheduled jobs for orphan cleanup and idempotent monthly resets.

### 11.6 Release blockers (must be zero)

Critical-text mismatch · cross-account data exposure · credit or payment errors · corrupt exports · broken mobile sign-up or export.

### 11.7 Validation sprint support

**Do:** make sure the PRD validation items can be measured: event tracking in place, a way to record paid pilot results, and export satisfaction prompt. Do not present any `[H]` or `[U]` item in the UI as proven.

---

## Phase 12: Post-MVP (do not start without approval)

- Mode B (prompt-to-design): the model returns a **structured design specification** validated by Zod and restricted to approved fonts, layout archetypes, and palettes, drawn by the same renderer and validator. Never arbitrary HTML, CSS, or script.
- Natural-language revision ("make the price bigger").
- Team seats, shared brand kits, scheduling, native or installable app (all out of MVP scope).

---

## Appendix A: Dependencies (approval needed before adding, per skill section 20)

For each, state purpose, license, maintenance status, size, and alternatives when requesting approval.

| Purpose | Candidate |
|---|---|
| Framework, styling | next, react, tailwindcss v4, tw-animate-css |
| UI primitives and icons | shadcn/ui (Radix), lucide-react, class-variance-authority, clsx, tailwind-merge, sonner, vaul (drawer) |
| Theme | next-themes (or a small inline script) |
| Forms and validation | react-hook-form, @hookform/resolvers, zod |
| Backend | @supabase/supabase-js, @supabase/ssr |
| Rendering | satori, @resvg/resvg-js, a font-metrics library (fontkit or opentype.js), sharp (JPG, image validation) |
| Upload validation | file-type (magic bytes), an SVG sanitizer |
| Testing | vitest, @playwright/test |
| Payments | Paystack server SDK or plain `fetch` (prefer plain `fetch` behind the interface) |

## Appendix B: Standard test fixtures

Use the same content fixtures everywhere (renderer, visual tests, e2e):

| Fixture | Headline | Price | Business name |
|---|---|---|---|
| short | "Solar sale" | ₦5,000 | "Sun Co" |
| normal | "5kVA inverter and battery package" | ₦850,000 | "BrightPower Solutions" |
| long | A headline near the template's `maxLength` | ₦2,450,000 | A 40-character name |
| extreme | A headline at `maxLength` with unbroken long words | ₦12,500,000 | A 60-character name |

Also vary: missing optional fields, transparent logo, small product image, wide product image, old price present.

## Appendix C: Definition of done for any step

- [ ] Requirement IDs quoted in the plan and report
- [ ] Invariants reviewed; none violated
- [ ] Inputs validated with Zod at every boundary; typed `Result` for expected failures
- [ ] RLS on every new user-owned table with cross-user tests
- [ ] Tests written with the change and run; failures reported honestly
- [ ] UI checked at 360px, tablet, desktop, light and dark; all states designed
- [ ] `check-design.sh` passes (no grid, gradients, blur, raw hex)
- [ ] Docs updated if behavior or architecture changed
- [ ] No unrelated changes in the diff
- [ ] Completion report written (what changed, IDs, invariants, verification, not done, follow-ups)

## Appendix D: Starter prompt for each agent session

> Read `README.md`, then `docs/IMPLEMENTATION_PLAN.md`. We are on step **X.Y**. Quote the PRD requirement IDs it covers, inspect the existing code and the canonical example, write a short plan, and wait for my approval if the step is marked [GATE]. Then implement the smallest coherent change, run lint, typecheck, and the tests named in the step, check the UI at 360px in light and dark, and finish with the completion report. Do not start the next step.
