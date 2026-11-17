-- Phase 8: server-side AI request audit, usage, and cost records.
-- Provider pricing is never inferred here; cost_usd is nullable until a provider
-- supplies a recorded price and pricing_checked_at timestamp.

create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flyer_id uuid references public.flyers(id) on delete set null,
  kind text not null check (kind in ('copy_suggestions', 'background_removal')),
  provider text not null,
  model text,
  usage jsonb not null default '{}'::jsonb,
  cost_usd numeric(12, 6),
  pricing_checked_at timestamptz,
  latency_ms integer not null check (latency_ms >= 0),
  status text not null check (status in ('succeeded', 'failed', 'timed_out', 'refused', 'cache_hit', 'unavailable')),
  error_code text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_requests_user_created_idx on public.ai_requests (user_id, created_at desc);
create index if not exists ai_requests_kind_created_idx on public.ai_requests (kind, created_at desc);

alter table public.ai_requests enable row level security;

create policy "ai_requests_select_own" on public.ai_requests
  for select using (auth.uid() = user_id);

-- Inserts are service-only so clients cannot forge usage, cost, or provider status.
