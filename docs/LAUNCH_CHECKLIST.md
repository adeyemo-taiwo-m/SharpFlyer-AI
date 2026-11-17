# Phase 11 launch checklist

This is an evidence checklist, not a claim that a production device or host has already been tested.

## Release blockers

- [ ] Critical-text render check passes for every template and format.
- [ ] Cross-account access tests pass for every user-owned table and route.
- [ ] Credit, refund, payment idempotency, and forged-webhook tests pass.
- [ ] PNG/JPG exports open on Android, iOS, and desktop.
- [ ] Mobile sign-up, preview, and export complete on a real phone.

## Device and network pass

- [ ] Mid-range Android, 360 px viewport, throttled 4G: gallery, upload, preview, export.
- [ ] iPhone VoiceOver and Android TalkBack: core journey, focus order, error announcements.
- [ ] Keyboard-only path and 200% zoom.
- [ ] Light and dark themes, contrast for every palette, reduced motion.
- [ ] Public raster thumbnails remain under 80 KB; no layout shift is visible while loading.

## Measurement

- [ ] `sign_in_completed`, template, draft, preview, export, share, AI, and satisfaction events are present.
- [ ] Paid pilot outcomes are recorded using `docs/PAID_PILOT_LOG.md`.
- [ ] Admin alert thresholds are configured from current provider pricing and actual export volume.
- [ ] UI copy does not present `[H]` or `[U]` validation items as proven.
