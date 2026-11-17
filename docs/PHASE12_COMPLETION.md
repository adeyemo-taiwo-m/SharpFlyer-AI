# Phase 12 completion report

## Requirement mapping

- PRD section 6.1: Mode B prompt-to-design is implemented as a constrained, authenticated alternative creation flow.
- PRD section 7.1 and 7.4: `/app/create/ai` is available and can propose a design, apply a structured revision, and open the ordinary editor after an explicit user action.
- `docs/AI_SPEC.md` section 7.4: the design specification is strict Zod data, uses approved fonts/archetypes/palettes, contains field references only, and is passed to the existing renderer/validator.
- No `AI-xxx` identifiers are present in the current PRD for these requirements; no identifier was fabricated.

## What changed

- Added `DesignSpecSchema`, prompt/revision schemas, approved allowlists, and provider methods under `src/server/ai`.
- Added `designFromPrompt`, `reviseDesign`, `applyDesignRevision`, and `renderDesignSpec` with retry-on-invalid output, 8-second timeout, server-side per-user/IP/flyer limits, request audit records, and typed `Result` failures.
- Added the `/app/create/ai` prompt/review/revision UI. Nothing is inserted into a flyer without tapping “Use this design”.
- Extended the `ai_requests` kind constraint for design requests while preserving the existing RLS and service-only insert behavior.
- Added integration coverage for invalid-output retry, safe revision, render-client delegation, and arbitrary-markup rejection.

## Invariants reviewed

- Critical fields remain structured references and are rendered from user content; the AI layer never receives critical contact/business values as rewrite text.
- Unknown schema keys and arbitrary HTML/CSS/SVG/script are rejected.
- Provider calls are isolated behind `src/server/ai`; provider failure releases the allowance and does not consume credits.
- Design output is resolved to an approved existing template and then sent through the canonical render client/worker.
- No new user-owned table was added; `ai_requests` retains its existing RLS policy and service-only writes.

## Verification

- `npx tsc --noEmit` passed.
- `npm.cmd run lint` passed.
- `node_modules\\.bin\\vitest.cmd run tests/integration/ai-design.test.ts` passed: 4 tests.
- `npm.cmd run check:design` passed.
- `npm.cmd run check:security` passed.
- `npm.cmd run build` passed and includes `/app/create/ai`.
- Visual regression passed: 60 tests.
- The full suite ran 25 of 26 files successfully (101 of 102 tests). The remaining failure is an existing brittle `tests/integration/template-catalog.test.ts` assertion for the exact substring `"version":2` while the committed JSON is formatted as `"version": 2`; no template file was changed in this phase.
- `npm.cmd run templates:validate` was blocked by the environment's `uv_os_get_passwd returned ENOMEM` error before validation started.

## Not started by design

Team seats, shared brand kits, scheduling, and native/installable app work remain out of scope. A production model provider is not configured in this repository; the typed unavailable result and the ordinary template/editor fallback remain active until one is approved and configured.
