-- Phase 10/11: privacy-minimal analytics, admin audit logs, and render observability.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null check (event in (
    'sign_in_completed', 'template_viewed', 'template_selected', 'flyer_created',
    'draft_saved', 'preview_generated', 'preview_failed', 'export_started',
    'export_succeeded', 'export_failed', 'flyer_shared', 'share_fallback_used',
    'ai_suggestion_requested', 'ai_suggestion_selected', 'paid_pilot_payment_succeeded',
    'export_satisfaction_submitted'
  )),
  properties jsonb not null default '{}'::jsonb,
  correlation_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists analytics_events_event_created_idx on public.analytics_events (event, created_at desc);
create index if not exists analytics_events_user_created_idx on public.analytics_events (user_id, created_at desc);
alter table public.analytics_events enable row level security;
create policy "analytics_events_select_own" on public.analytics_events
  for select using (auth.uid() = user_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_created_idx on public.audit_logs (actor_user_id, created_at desc);
alter table public.audit_logs enable row level security;
-- No client policies: writes and reads are performed by server-side admin code.

create table if not exists public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id text not null unique,
  correlation_id text,
  user_id uuid references auth.users(id) on delete set null,
  template_id text not null,
  template_version integer not null check (template_version >= 1),
  format text not null check (format in ('status', 'ig_post', 'story', 'fb_post', 'a4')),
  purpose text not null check (purpose in ('preview', 'export')),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  result text not null check (result in ('succeeded', 'failed')),
  error_code text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists render_jobs_created_idx on public.render_jobs (created_at desc);
create index if not exists render_jobs_user_created_idx on public.render_jobs (user_id, created_at desc);
alter table public.render_jobs enable row level security;
create policy "render_jobs_select_own" on public.render_jobs
  for select using (auth.uid() = user_id);
