# Deployment runbook

## Web app

Deploy the Next.js app to a Next-compatible host with preview deployments enabled. Set the public Supabase URL/key and server-only service role, Paystack, AI, render worker, and error tracker variables in the host secret manager. Never expose server-only values through `NEXT_PUBLIC_*` or client components.

## Render worker

Build `render-worker/Dockerfile` and deploy it as a private container service. Set `RENDER_WORKER_SECRET`; allow only the web app to call `/render`, keep `/health` public to the platform health check, and ship structured job logs with job id, correlation id, template, format, duration, and result.

## Database and scheduled jobs

Apply Supabase migrations through CI before the web deployment. Turn on daily backups and verify a restore in the release checklist. Schedule idempotent monthly credit resets and orphaned-upload/render cleanup; both jobs must use service-role server code and write audit/observability records when they mutate data.

## Webhooks and alerts

Expose the public HTTPS Paystack webhook route, verify its signature, and keep event idempotency enabled. Alert on failed webhooks, render failure rate, and AI cost per export. Provider pricing must be read from the provider's current pricing before setting the cost ceiling; record the checked date in `ai_requests.pricing_checked_at`.
