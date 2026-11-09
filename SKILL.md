---
name: sharpflyer-product-engineering
description: Enforces correct, accurate, secure, requirement-driven engineering of SharpFlyer AI, an AI-assisted promotional flyer tool for Nigerian businesses. Use whenever planning, writing, modifying, debugging, reviewing, or testing any SharpFlyer code, database schema, template, AI feature, rendering logic, credits, payments, uploads, authentication, or backend/API work, even if the user does not mention the product name. Also use for adding templates, new field types, AI features, plans or pricing, migrations, webhooks, and for any task that touches prices, phone numbers, business names, logos, credits, or exports.
---

# SharpFlyer AI Product Engineering Enforcement

## 0. Mission and authority

This skill defines the required engineering, product-accuracy, security, and review standards for SharpFlyer AI.

SharpFlyer exists to help Nigerian businesses create professional promotional flyers quickly and **correctly**. A flyer with the wrong price, wrong phone number, or wrong business name is worse than no flyer, because the customer publishes it and loses money or credibility. Accuracy, trust, and cost control are therefore the first engineering concerns, ahead of cleverness and speed of delivery.

The agent must make the founder's work easier. It must not create extra work through careless changes, silent scope expansion, invented requirements, unverified claims of success, or repeated violations of rules that are already written down here.

These standards are constraints and working procedures, not suggestions.

### 0.1 Instruction priority

Apply instructions in this order:

1. The user's explicit instruction for the current task.
2. The non-negotiable invariants in Section 2 of this skill.
3. `docs/PRD.md` (requirements, acceptance criteria, scope).
4. `README.md` (architecture, structure, conventions) and `docs/DECISIONS.md`.
5. The `design-quality-enforcement` skill for anything user-interface related.
6. The contextual recommendations in this skill.
7. The agent's own preferences.

Never silently override a higher-priority instruction because another approach is more familiar or convenient. If the user's request conflicts with an invariant in Section 2, **stop, explain the conflict in a few sentences, and ask one focused question** before proceeding. Do not implement the conflicting behavior and mention it afterward.

### 0.2 Three levels of rules

- **FORBIDDEN:** Do not do this unless the user explicitly authorises an exception for the specific task.
- **REQUIRED:** Must be done for the relevant task.
- **CONTEXTUAL:** Choose according to the task, existing code, and constraints. State the reasoning when the choice materially affects behavior, cost, or security.

### 0.3 Evidence rule

Never state that something works, passes, is secure, is fast, or is complete unless it was actually run, inspected, or tested in this session. Distinguish clearly between **verified**, **expected but unverified**, and **not done**.

---

## 1. Product context the agent must hold at all times

- **What it is:** a web app where a user picks a curated template, enters content (headline, offer, price, phone, logo, product image), and exports a flyer for WhatsApp Status, Instagram, Facebook, or print.
- **Mode A (MVP):** template-based adaptation. **Mode B (later):** prompt-to-design, which still renders through the same template renderer.
- **Initial customers:** solar and inverter businesses in Nigeria. Later: retail, fashion, real estate, restaurants, services.
- **Users:** business owners, social media managers, and sales staff, mostly on mid-range Android phones with variable mobile data.
- **Money:** Naira (₦), stored in kobo. Payments through a Nigerian gateway (Paystack or Flutterwave; check `docs/DECISIONS.md` for the current decision).
- **Differentiators:** curated starting point, reliable business data, brand memory, recurring-use workflow, local fit.
- **Stack (see README):** Next.js (App Router) + TypeScript + Tailwind, Supabase (Auth, Postgres, Storage, RLS), a separate render worker, a provider-agnostic AI service layer, Zod validation.

When facts about the product are missing or unclear, read `docs/PRD.md`. Do not invent product behavior.

---

## 2. Non-negotiable invariants

Violating any of these is a critical failure. Each is FORBIDDEN to break.

### 2.1 Critical text accuracy

1. **Critical fields are never generated, rewritten, or "improved" by an AI model or image model.** Critical fields are: business name, price, old price, phone/WhatsApp number, address, website/handle, and logo.
2. The renderer draws critical fields from structured user data.
3. **Rendered critical text must equal the input exactly** (after the defined formatting rules, such as thousands separators). The output validator must verify this and **block export** on mismatch.
4. AI-generated copy (headline, supporting text, call to action) may be suggested, but it must be inserted only when the user selects it, and it must remain editable.
5. AI must never invent prices, discounts, warranties, certifications, specifications, or guarantees that the user did not supply.

### 2.2 Credits and money

6. The credit ledger is **append-only**. Never update or delete ledger rows. Corrections are new rows (adjustment or refund).
7. Balance is always derived from the ledger. Never store a mutable balance that can drift from it (a cached value is allowed only if it is rebuilt from, and verified against, the ledger).
8. **A failed render or failed AI call never consumes credits.** If a deduction occurred before a failure, a refund row must be created in the same failure path.
9. Credit consumption must be atomic and concurrency-safe (database function or transaction with locking). No read-then-write race conditions.
10. A re-download of an already exported flyer version is free.
11. Money amounts are integers in kobo. Never use floating point for money.

### 2.3 Payments

12. **Payment success is confirmed only by a verified server-side webhook plus provider verification.** A client redirect or client-side callback is never proof of payment.
13. Webhook handlers verify the signature, are **idempotent** (store processed event IDs), and tolerate duplicate and out-of-order delivery.
14. Never store card data. Never log secrets, full payloads containing personal data, or signature secrets.
15. Plan and credit changes happen only inside the verified webhook path or an admin-audited path.

### 2.4 Data and security

16. **Row-level security (RLS) is enabled on every user-owned table**, with explicit policies. A table without RLS is a bug.
17. **The Supabase service-role key is used only in server-side code.** Never in client bundles, never in logs, never in public environment variables.
18. Users can access only their own data. Cross-account access is a release-blocking defect.
19. All input is validated at the boundary with Zod (forms, route handlers, server actions, webhooks, AI output, template files). Never trust client-supplied IDs, prices, credit amounts, or plan names.
20. **All uploads are validated server-side** by declared type, magic bytes, size, and dimensions. SVG logos are sanitized. Never trust a file extension.
21. AI model output is untrusted input. It must pass schema validation before use.
22. Secrets live only in environment variables and are validated in `src/lib/env.ts`. Never hard-code secrets, keys, or tokens.

### 2.5 AI usage

23. **Every AI call goes through the AI service layer** (`src/server/ai`). No direct provider SDK calls from routes, components, or other services.
24. Image models never generate text, prices, logos, or phone numbers. Background prompts must explicitly forbid text, and results that appear to contain text are rejected or regenerated.
25. Every AI feature has a **non-AI fallback** so the user can always finish a flyer.
26. Every AI call is logged (provider, model, units or tokens, cost, latency, status) and subject to per-user limits.

### 2.6 Templates and licensing

27. Templates are **data** (validated JSON), not code. Published template versions are **immutable**. Changes create a new version; existing flyers stay pinned to their version.
28. Fonts, images, and decorative assets must be commercially licensed or original. Record license info in template metadata. Never copy competitors' designs or scrape flyers from social platforms.
29. The same template version plus the same content must always render the same image (deterministic).

### 2.7 Scope and honesty

30. Do not add features outside the PRD MVP scope without approval (see Section 19).
31. Do not fabricate data, metrics, reviews, customers, benchmarks, provider pricing, or legal conclusions.
32. Do not claim NDPA or other legal compliance. Implement the technical measures in the PRD and flag legal questions for a qualified advisor.

---

## 3. Required workflow for every task

Do not jump from request to code. Use these stages.

### Stage A: Understand

- Restate the goal in one or two sentences.
- Identify the **requirement IDs** involved (FR-xxx, NFR-xxx, AI-xxx in `docs/PRD.md`). If none apply, say so; the task may be out of scope.
- Identify the invariants in Section 2 that the task touches.
- Identify the affected layers: UI, route handler/server action, service, database, render worker, AI layer, templates, external provider.
- Identify what must remain unchanged.
- Ask a focused question only when a missing decision materially blocks correct work. Do not ask what can be learned by reading the repo or PRD.

### Stage B: Inspect

- Read `README.md` and the relevant PRD sections.
- Inspect the existing code for the affected area: structure, patterns, naming, types, tests, migrations.
- Find the **canonical example** of a similar feature in the repo and follow it.
- Check `docs/DECISIONS.md` so settled decisions are not reversed.
- Never assume a library, helper, table, column, or environment variable exists. Verify it.

### Stage C: Plan

Write a short plan before coding any non-trivial change:

- Requirement IDs covered.
- Files to create or change.
- Data model or migration changes (if any) and their RLS implications.
- Invariants touched and how they are preserved.
- Failure modes and how each is handled.
- Tests to add or update.
- What is explicitly out of scope.

For changes touching billing, authentication, RLS, the credit ledger, or the render validator, present the plan and **wait for approval** before implementing.

### Stage D: Implement

- Make the smallest coherent change that fully solves the task.
- Follow existing conventions and the dependency direction in Section 4.
- Validate at every boundary. Return typed results for expected failures.
- Handle loading, empty, error, and edge cases, not only the happy path.
- Do not add unrequested features, abstractions, or dependencies.

### Stage E: Verify

- Run linting, type checking, and the relevant tests.
- Add tests required by Section 17.
- For UI work, run the app and inspect the rendered result (see Section 14).
- For rendering work, render real samples with short, normal, long, and extreme content.
- Re-read the diff against the invariants checklist (Section 21).

### Stage F: Report

Provide the completion report described in Section 24.

---

## 4. Architecture rules

### 4.1 Dependency direction

```
app/ and components/  →  server/ and schemas/  →  lib/
render-worker/        →  schemas/ and shared types only
```

- `server/` never imports from `app/` or `components/`.
- `lib/` has no side effects and no imports from `server/`.
- The `render-worker` never imports server business logic and never calls AI providers or billing.
- Client components never import from `server/` (except through server actions or route handlers).

### 4.2 Layer responsibilities

| Layer | Does | Does not |
|---|---|---|
| Route handlers / server actions | Authenticate, validate, call a service, map result to response | Contain business rules, long-running work, or direct provider calls |
| Services (`src/server/*`) | Business logic, transactions, orchestration | Know about HTTP or React |
| Render worker | Turn template + content into an image and validate it | Charge credits, call AI, read user accounts |
| AI service layer | Provider calls, prompts, schema validation, limits, logging, fallbacks | Be bypassed by callers |
| Database | Source of truth, RLS, ledger integrity | Be written to by clients with elevated privileges |

### 4.3 Long-running work

Rendering, background removal, and AI generation are **jobs**: enqueue, track status, handle timeout and retry, and make them idempotent. Never block a request handler on heavy work beyond its limit.

### 4.4 Provider independence

Payment, AI, OTP, and email providers sit behind interfaces (`PaymentProvider`, `LLMProvider`, `ImageProvider`, and so on). Business logic depends on the interface, never on a provider SDK type. This keeps providers replaceable.

---

## 5. Templates and rendering

### 5.1 Template definition rules

REQUIRED for every template (`templates/<id>/template.json`):

- Validates against `TemplateSchema`.
- Declares `meta` (id, version, title, category, tags, style, **license info**).
- Declares supported `formats` with dimensions and safe areas.
- Declares at least one `palette` with named roles (bg, primary, accent, text, muted).
- Declares `fields` with key, type, required flag, and max length.
- Declares `regions` per format for every field, with font, size range, line height, alignment, overflow rule, and color role.
- Declares image `fit` rules (contain, cover, smart-crop) and transparency handling.
- Declares `constraints` (minimum contrast, maximum lines).
- Uses only approved, licensed, embedded fonts.

FORBIDDEN:

- Hard-coded user content inside a template (except clearly labeled sample values used only for previews).
- Editing a published template version in place.
- Fields that let the user supply free-form HTML or script.
- Regions that can overlap safe-area margins without an explicit reason.

### 5.2 Renderer behavior

REQUIRED:

1. Pin the template version for the flyer.
2. Resolve palette and theme tokens.
3. Fit text deterministically: wrap, then shrink within `minSize` to `maxSize`; only optional fields may truncate; required fields that cannot fit produce a warning or failure, never silent clipping.
4. Place images with the declared fit mode; never stretch; preserve transparency.
5. Rasterize at the requested size and scale.
6. Run the output validator (Section 6).
7. Return `{ ok, warnings, errors, metrics }`. Never return a file when validation failed.

### 5.3 Rendering verification

When changing renderer, fitting, or template logic, render each affected template with:

- Short, typical, long, and extreme-length headlines.
- Missing optional fields.
- Very large and very small prices (for example ₦5,000 and ₦12,500,000).
- Long business names and addresses.
- Transparent logos and product images, small images, and wide images.
- Every supported format.

Inspect the images (or run visual regression) before claiming the change works.

---

## 6. Output validation (critical text and quality)

The validator is a release gate. REQUIRED checks before any export:

- Rendered critical text nodes equal the structured input (after formatting).
- Required regions are populated.
- No text overflows its region or the safe area.
- Contrast meets the minimum (4.5:1 body, 3:1 large text) or a warning with a one-tap fix is raised.
- Images are not stretched and not below the quality threshold (warn, allow user override where the PRD says so).

FORBIDDEN:

- Weakening or bypassing validation to make a test pass.
- Catching a validation error and exporting anyway.
- Normalizing away differences in a way that could hide a wrong digit or character.

When the validator fails, **fix the cause**, not the check.

---

## 7. Credits, plans, and usage limits

REQUIRED:

- All credit changes go through a single service module (`src/server/credits`) backed by database functions.
- Each ledger row has: user, signed integer `delta`, `reason` (grant, purchase, export, refund, adjustment), `reference_id`, timestamp.
- Show the credit cost **before** any action that consumes credits.
- Deduct on **successful** export of a new flyer version; refund automatically on system failure after deduction.
- Rate limits and AI allowances are enforced server-side. Client checks are only for user experience.
- Monthly resets are scheduled jobs and are idempotent.

FORBIDDEN:

- Adding credits or changing a plan from the client.
- Trusting a client-provided credit amount or price.
- Granting credits without a ledger row.
- Running credit math in application memory without the database transaction.

Tests required for any change in this area: balance equals sum of ledger; concurrent exports with a balance of one; failed render leaves balance unchanged; refund path; duplicate request idempotency.

---

## 8. Payments and billing

REQUIRED:

- Wrap the gateway behind `PaymentProvider`.
- Create a `payments` row as `pending` when checkout starts.
- On webhook: verify signature, check event-ID idempotency, **confirm the transaction with the provider API**, then in one database transaction mark the payment succeeded and grant credits or activate the subscription.
- Support failure states: failed payment, abandoned checkout, failed renewal (grace period, notification, downgrade).
- Provide receipts and billing history.
- Test with the provider's sandbox and simulated duplicate and forged webhooks.

FORBIDDEN:

- Granting access on redirect or client callback.
- Hard-coding plan prices in several places. Pricing lives in one configuration source.
- Starting real charges or live payments during development or testing without explicit authorisation.
- Logging full webhook payloads containing personal or financial data.

Pricing figures are **proposals to be validated**. Do not present them as final. Reference `docs/PRD.md` and `docs/DECISIONS.md`.

---

## 9. AI service layer

### 9.1 Structure

All AI code lives under `src/server/ai`: `providers/`, `prompts/`, `schemas.ts`, `limits.ts`, `cost.ts`, `fallbacks.ts`, and a public `index.ts`.

### 9.2 Required behavior per AI function

1. Enforce limits and allowance **before** calling the provider.
2. Build the prompt from a **versioned** prompt file (`copy.v1`, `copy.v2`). No inline prompts elsewhere.
3. Call the provider with a timeout.
4. Parse and **validate** the output with Zod. On failure: retry once, then return a typed error.
5. Apply post-filters (for example, remove invented claims, enforce character limits, strip phone numbers or addresses).
6. Log the request (provider, model, usage, cost, latency, status).
7. Return a typed `Result`. Errors carry a stable code (`AI_TIMEOUT`, `AI_INVALID_OUTPUT`, `AI_LIMIT_REACHED`, `AI_REFUSED`).
8. Never consume credits on failure.

### 9.3 Prompt and evaluation discipline

- Changing a prompt, model, or provider requires re-running the evaluation set and reporting the results.
- Evaluation sets are stored in the repo (`tests/ai-eval`) and include normal, adversarial, ambiguous, and multilingual or Pidgin-flavored inputs.
- Copy suggestions must pass: within length limits, no invented claims, tone matches request, no contact details inserted.

### 9.4 AI cost control

- Cache results where valid (for example, background removal keyed by image hash).
- Limit regenerations per flyer and per day.
- Prefer smaller or cheaper models for simple text tasks, and justify any larger model choice.
- Report estimated cost per exported flyer when adding or changing an AI feature.

### 9.5 Mode B (prompt-to-design)

The model returns a **structured design specification** validated against a schema, restricted to approved fonts, layout archetypes, and palette constraints. It never returns arbitrary HTML, CSS, or script. The same renderer and validator apply.

---

## 10. Database, migrations, and RLS

REQUIRED:

- All schema changes are SQL migrations in `supabase/migrations`, never manual edits.
- Every new user-owned table: enable RLS, add explicit select/insert/update/delete policies (or deliberately none for server-only writes), add indexes for common queries and foreign keys.
- Use `timestamptz` and store UTC. Store money as integer kobo. Store phones in E.164.
- Use constraints (not null, check, foreign keys, enums) to enforce rules at the database level.
- Make migrations safe: additive first, backfill separately, destructive changes only after approval.
- Provide a way to test policies: cross-user access tests.
- Regenerate TypeScript database types after schema changes.

FORBIDDEN:

- Disabling RLS "temporarily" and leaving it off.
- Using `USING (true)` policies on user data.
- Dropping columns, tables, or data without explicit approval and a recovery plan.
- Editing a migration that has already been applied elsewhere (create a new one).

Any migration that touches `credit_ledger`, `payments`, `subscriptions`, or auth-related tables requires an approved plan first.

---

## 11. Authentication and authorization

REQUIRED:

- Every route handler and server action begins with `requireUser()` unless explicitly public. Admin routes use `requireAdmin()`.
- Authorization is enforced twice: in code (ownership checks) and in the database (RLS).
- Admin role is stored server-side and is not user-editable.
- OTP and login endpoints are rate-limited per identifier and per IP.
- Export requires a verified account.
- Sessions and tokens follow Supabase defaults; do not invent custom session schemes.

FORBIDDEN:

- Authorizing based on a client-supplied user ID.
- Exposing admin functions behind a hidden URL only.
- Returning different error messages that reveal whether an account exists on login or recovery flows.

---

## 12. Uploads and storage

REQUIRED:

- Private buckets. Downloads use short-lived signed URLs.
- Validate declared MIME type and size before issuing an upload URL; verify magic bytes and dimensions after upload.
- Limits: logo 5 MB, product image 10 MB (adjust only through PRD changes).
- Allowed types: PNG, JPG, WebP; SVG only for logos and only after sanitization.
- Store `hash`, `width`, `height`, `mime_type`, `size` in the `assets` table.
- Clean up orphaned and soft-deleted files through a scheduled job.
- Handle interrupted uploads with retry or resume.

FORBIDDEN:

- Public buckets for user content.
- Trusting the filename or extension.
- Serving user-uploaded SVG without sanitization.

---

## 13. Server conventions: errors, results, validation

- Expected failures return `Result<T, AppError>`; do not throw for validation, insufficient credits, provider timeouts, or not-found.
- `AppError` has a stable `code` and a user-safe `message`. The UI maps codes to friendly text.
- Unexpected exceptions are caught at the boundary, logged to the error tracker, and shown as a generic retryable error.
- Never expose stack traces, provider error bodies, SQL errors, or internal IDs to the client.
- Zod schemas live in `src/schemas` and are shared between client and server.
- Idempotency: any operation that could be retried (render requests, exports, webhooks, credit grants) must be safe to repeat.
- Use consistent naming: `camelCase` for code, `PascalCase` for components and types, `snake_case` for database columns.

---

## 14. Frontend and UI work

All UI work must also comply with the `design-quality-enforcement` skill. In case of conflict on visual or UX matters, that skill wins. This section adds SharpFlyer-specific requirements.

REQUIRED:

- **Mobile first** at 360px width on a mid-range Android phone over a 4G connection.
- Complete the core journey (gallery → form → preview → export) without horizontal scrolling or hidden controls.
- Server components by default; `"use client"` only for genuine interactivity.
- Show credit cost before consuming actions; show clear loading, error, empty, and success states.
- Draft auto-save and recovery after refresh or connection loss.
- Optimized images, lazy loading, small template thumbnails (under about 80 KB), resumable uploads.
- Inline validation with plain-language messages (for example, "Enter a valid phone number, like 0803 123 4567").
- Accessibility: semantic HTML, visible focus, labels, adequate contrast, keyboard operation.

FORBIDDEN (in addition to the design skill):

- Displaying fake templates, fake customers, fake ratings, or invented statistics on any page.
- Showing a preview that differs from what will be exported.
- Client-side-only enforcement of credit, plan, or rate limits.
- Calling AI or payment providers directly from the browser.

UI verification:

- Run the app and inspect real screens at 360px, a tablet width, and desktop; check portrait and landscape.
- Test the preview and export on a real or emulated mid-range phone.
- Check slow-network behavior (throttle) for gallery, upload, and render.

---

## 15. Nigerian market requirements

- Currency: Naira (₦). Use a shared `formatNaira()` helper. Store kobo. Display thousands separators (₦850,000).
- Phone numbers: accept Nigerian formats (`0803 123 4567`, `+234 803 123 4567`, `2348031234567`); store E.164; display in the user's preferred format; warn rather than reject plausible international numbers.
- Time zone: store UTC, display in `Africa/Lagos`.
- Payments: support card, bank transfer, USSD, and bank apps through the gateway. Handle bank-transfer delays and pending states gracefully.
- Connectivity: assume variable bandwidth and interruptions. Optimize payloads, retry sensibly, preserve drafts.
- Language: English (Nigeria). Pidgin-flavored copy is an optional tone in AI suggestions, never the default and never used for critical text.
- WhatsApp Status (1080x1920) and Instagram formats are first-class. Share and download must work well on mobile browsers.
- Cost sensitivity: prices, limits, and free-tier rules must be configurable and justified by margin analysis, not guesses.

---

## 16. Privacy and security practices

REQUIRED:

- Collect only the data the product needs. Avoid unnecessary personal data in analytics events.
- Provide data deletion paths for flyers, assets, and accounts per the PRD retention rules.
- Disclose third-party processing (AI, payments, OTP, email) in the privacy documentation; flag open questions about provider data terms.
- Rate-limit authentication, uploads, AI, and render endpoints.
- Use HTTPS only. Set secure cookie and header defaults.
- Keep dependencies minimal and reviewed; check licenses and maintenance status before adding one.
- Log security-relevant events (admin actions, failed webhooks, repeated failed logins) without logging secrets.

FORBIDDEN:

- Logging tokens, OTP codes, service keys, card data, or full personal records.
- Using customer content to train models or sending it to providers whose terms are unknown without flagging it.
- Disabling security features to speed up development.

---

## 17. Testing requirements by change type

| Change type | Required tests |
|---|---|
| Formatting helpers (Naira, phone) | Unit tests with edge cases (zero, very large, invalid, international) |
| Text-fit or renderer logic | Unit tests plus visual regression for affected templates in all formats |
| New or changed template | Schema validation, sample render, visual snapshots (short, normal, long, extreme content), phone check |
| Output validator | Tests proving mismatches, overflow, and contrast failures are caught; tests proving valid output passes |
| Credits / ledger | Balance equals ledger sum; concurrency test; failed-render refund; idempotent retry |
| Payments / webhooks | Valid, duplicate, forged, out-of-order, and failed-payment events |
| RLS / migrations | Cross-user read/write denial tests; migration applies cleanly on a fresh database |
| AI features | Schema validation, failure and timeout paths, limit enforcement, evaluation set results, cost report |
| Upload handling | Wrong MIME, oversized, corrupt, spoofed extension, malicious SVG, interrupted upload |
| Auth / routes | Unauthenticated, wrong-user, and admin-only access tests |
| UI flows | End-to-end test of the changed journey at a mobile viewport |

Rules:

- Write tests with the change, not after.
- Do not delete or weaken a test to make it pass. If a test is wrong, explain why and fix it deliberately.
- Do not mock the thing being verified (for example, do not mock the validator when testing validation).
- Report which tests were run and which could not be run.

---

## 18. Observability and analytics

REQUIRED:

- Track events from the PRD event list through the typed `track()` helper; do not scatter raw analytics calls.
- Log render jobs with job ID, template, format, duration, and result.
- Log AI requests with cost and latency; support a daily cost view.
- Alert on render failures, webhook failures, and cost per export above the agreed ceiling.
- Include correlation IDs so a failed export can be traced from UI to render to storage.

FORBIDDEN:

- Tracking unnecessary personal data.
- Adding events that do not map to a product question.
- Swallowing errors silently.

---

## 19. Scope control and preserving existing work

Before changing existing code:

1. Inspect the relevant files and current behavior.
2. Identify what works today.
3. Identify the exact change requested.
4. Check dependencies, callers, and tests.
5. Choose the smallest coherent change.

FORBIDDEN:

- Adding features outside the PRD MVP scope. The PRD's "Won't Have" list includes: a full drag-and-drop editor, team collaboration, video/animation generation, social auto-posting, scraping competitor designs, and native apps.
- Large refactors to solve small problems.
- Renaming, reformatting, or reorganizing unrelated files.
- Replacing working components or patterns without justification.
- Silently changing database schema, environment variables, or dependencies.
- Introducing a new pattern when an established one exists.

If broader changes are necessary, explain why and obtain approval when scope or risk is significant.

---

## 20. Dependencies, secrets, and destructive actions

Approval is required before:

- Adding a new dependency or external service.
- Changing the database schema or RLS policies.
- Altering billing, credit, or authentication logic.
- Changing environment variable names or deployment configuration.
- Deleting data, dropping tables, or running irreversible commands.
- Spending money (live payments, paid AI calls beyond small tests, paid services).

Guidelines:

- Prefer the platform and existing dependencies.
- For a new dependency: state purpose, maintenance status, license, size, and alternatives.
- Use test or sandbox keys. Never commit real keys. Update `.env.example` when adding variables.
- Run destructive commands only in local or test environments, and say so.

---

## 21. Review gates

### 21.1 Pre-implementation gate

Verify before coding any non-trivial change:

- [ ] Requirement IDs identified (or out-of-scope status noted).
- [ ] Relevant PRD, README, and DECISIONS sections read.
- [ ] Existing code and a canonical example inspected.
- [ ] Invariants in Section 2 reviewed; none will be violated.
- [ ] Failure modes and edge cases listed.
- [ ] Migration, RLS, and security implications considered.
- [ ] AI and cost implications considered.
- [ ] Test plan defined.
- [ ] Scope is limited and approved where required.

### 21.2 Post-implementation gate

Verify before declaring completion:

- [ ] Critical text is still rendered from structured data and validated.
- [ ] Credits cannot be lost, duplicated, or consumed on failure.
- [ ] Payment confirmation relies only on verified webhooks.
- [ ] RLS covers every new or changed table; cross-user tests pass.
- [ ] No secrets in client code, logs, or the repo.
- [ ] All inputs and AI outputs are validated with schemas.
- [ ] Uploads are validated server-side.
- [ ] Errors return typed results with safe messages.
- [ ] Idempotency holds for retried operations.
- [ ] Lint, type check, and relevant tests ran and passed (or exceptions are reported).
- [ ] UI checked at mobile and desktop sizes where relevant.
- [ ] Docs updated (README, PRD, DECISIONS) if behavior or architecture changed.
- [ ] No unrelated changes slipped into the diff.

### 21.3 Rejection protocol

A critical violation means the change fails review.

1. Stop extending the failed approach.
2. Identify the exact violated rule.
3. Explain the real-world impact (for example, "a wrong digit in a price could be published to customers").
4. Fix the root cause rather than patching symptoms.
5. Re-run the relevant tests and re-inspect the result.

Do not weaken checks, add exceptions, or rename things to hide a violation.

---

## 22. Handling uncertainty and feedback

- Do not guess when a missing requirement materially changes behavior, security, money, or data. Ask one focused question.
- Do not repeatedly ask for information already in the PRD, README, or this skill.
- When the user rejects a result, find the underlying reason, apply it to the actual work, and avoid repeating it elsewhere.
- Do not argue for a forbidden pattern because it is convenient or conventional.
- When a requirement is ambiguous or contradictory, point to the exact sections and propose options with a recommendation.
- When the plan is wrong, say so promptly instead of continuing.

---

## 23. Task playbooks

### 23.1 Add a new template

1. Confirm category, formats, and fields needed; confirm license and font rights.
2. Create `templates/<id>/` with `template.json`, `preview.png`, `assets/`, and license notes.
3. Validate with the template schema command.
4. Render samples with short, normal, long, and extreme content in every supported format.
5. Verify the phone number, price, and business name render exactly.
6. Add visual regression snapshots.
7. Sync metadata to the database.
8. Review on a mobile-size screen.
9. Report: formats, palettes, fonts, license source, and any limitations.

### 23.2 Add a new field type or fit mode

1. Update `TemplateSchema` and shared types.
2. Implement renderer support and validation rules.
3. Decide whether the field is **critical**; if so, add exact-match validation.
4. Add form UI support and validation rules.
5. Update `docs/TEMPLATE_SPEC.md` and the README.
6. Add unit and visual tests; confirm existing templates are unaffected.

### 23.3 Add or change an AI feature

1. Define the task, inputs, outputs, limits, and fallback; map to AI-xxx requirements.
2. Add a Zod output schema and a versioned prompt.
3. Implement the function in `src/server/ai` with limits, timeout, retry, logging, and typed errors.
4. Add the evaluation set and run it; report results and estimated cost per call.
5. Wire UI with an explicit user action, visible cost if applicable, and a non-AI fallback.
6. Confirm failures never consume credits and never block the user from finishing.

### 23.4 Add a plan, credit pack, or pricing change

1. Confirm the decision (pricing is a hypothesis; check `docs/DECISIONS.md`).
2. Change pricing in the single configuration source only.
3. Update plan allowances, ledger grants, and display text consistently.
4. Test purchase, renewal, cancellation, downgrade, and duplicate-webhook paths in sandbox.
5. Check margin impact using current AI and infrastructure cost data; do not invent numbers.

### 23.5 Add an API route or server action

1. Start with `requireUser()` (or `requireAdmin()`); document if public.
2. Validate input with a Zod schema.
3. Call a service function; keep the handler thin.
4. Return `Result`-mapped responses with stable error codes.
5. Add rate limiting where abuse or cost is possible.
6. Add tests: unauthenticated, wrong user, invalid input, success.

### 23.6 Add a database table or change schema

1. Write a migration (additive first).
2. Add constraints, indexes, and RLS with explicit policies.
3. Regenerate types.
4. Add cross-user access tests.
5. Update `docs/DATA_MODEL.md` and the README summary.
6. Request approval if the change touches money, auth, or deletion.

### 23.7 Fix a bug

1. Reproduce it and write a failing test where practical.
2. Find the root cause; do not patch the symptom.
3. Check whether an invariant was violated; if so, strengthen the guard.
4. Fix with the smallest change.
5. Confirm the test passes and nearby behavior is unaffected.
6. Report cause, fix, and prevention.

### 23.8 Investigate cost or performance

1. Measure first (logs, metrics, real timings); do not guess.
2. Identify the largest contributors (AI calls, render time, image sizes, queries).
3. Propose changes with expected impact and trade-offs.
4. Re-measure after the change and report the actual result.

---

## 24. Completion report

When a task is complete, provide a concise report:

1. **What changed:** files and behavior, in plain language.
2. **Requirements covered:** requirement IDs (FR/NFR/AI) addressed.
3. **Invariants checked:** which of Section 2 were relevant and how they were preserved.
4. **Verification:** commands run, tests added and passed, viewports and flows checked, samples rendered.
5. **Not verified or not done:** anything skipped, blocked, or assumed.
6. **Follow-ups or decisions needed:** open questions, risks, and recommended next steps.

Do not claim that everything passed if it was not run. Do not write long self-congratulatory summaries. Be transparent about limitations.

---

## 25. Final operating principles

- **Accuracy before cleverness.** A correct price on a plain layout beats a beautiful wrong one.
- **Structured data before generated text.** Critical facts come from the user's inputs.
- **The ledger is the truth.** Credits are derived, never guessed.
- **Webhooks confirm payments.** Redirects do not.
- **RLS before convenience.** Data isolation is not optional.
- **Validate every boundary.** Treat AI output and uploads as untrusted.
- **Fail safely.** Failures never cost the user money or lose their work.
- **Mobile and slow networks first.** Real users are on phones.
- **Requirements before features.** Trace work to the PRD.
- **Verify before claiming.** Evidence, not promises.
- **Preserve working software.** Change only what the task requires.
- **Ask when stakes are high and facts are missing.** Money, security, and data deserve a question.

**Never ship a flyer-generation change that you have not seen produce correct flyers.**
