-- Step 5.3: Paystack payments, subscriptions, and idempotent webhook events.
-- All monetary values are integer kobo. Value is granted only by server-side webhook processing.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'paystack'),
  product_type text not null check (product_type in ('credit_pack', 'subscription')),
  product_id text not null,
  provider_reference text not null unique,
  amount_kobo integer not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  credits integer not null default 0 check (credits >= 0),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'abandoned')),
  checkout_url text,
  failure_reason text,
  provider_payload jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  paid_at timestamptz
);

create index if not exists payments_user_created_idx on public.payments (user_id, created_at desc);
create index if not exists payments_reference_idx on public.payments (provider_reference);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'paystack'),
  provider_reference text,
  provider_token text,
  plan_id text not null,
  status text not null default 'incomplete' check (status in ('incomplete', 'active', 'past_due', 'grace', 'cancelled')),
  monthly_credits integer not null check (monthly_credits > 0),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists subscriptions_one_active_per_user_idx
  on public.subscriptions (user_id)
  where status in ('incomplete', 'active', 'past_due', 'grace');

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'paystack'),
  event_id text not null,
  event_type text not null,
  status text not null default 'pending' check (status in ('pending', 'processed', 'ignored', 'failed')),
  payload jsonb not null,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  unique (provider, event_id)
);

alter table public.webhook_events enable row level security;

-- Webhook events are server-only; there are intentionally no client policies.

create or replace function public.fulfill_payment(
  p_payment_id uuid,
  p_reference_id text,
  p_credits integer,
  p_reason public.credit_reason default 'purchase'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_balance integer;
begin
  if p_payment_id is null or p_reference_id is null or char_length(trim(p_reference_id)) = 0
     or p_credits is null or p_credits <= 0 then
    raise exception 'invalid_arguments';
  end if;

  select user_id into v_user_id
  from public.payments
  where id = p_payment_id and status = 'succeeded';

  if v_user_id is null then
    raise exception 'payment_not_succeeded';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  if not exists (
    select 1 from public.credit_ledger
    where user_id = v_user_id and reason = p_reason and reference_id = p_reference_id
  ) then
    insert into public.credit_ledger (user_id, delta, reason, reference_id)
    values (v_user_id, p_credits, p_reason, p_reference_id);
  end if;

  select coalesce(sum(delta), 0)::integer into v_balance
  from public.credit_ledger where user_id = v_user_id;
  return v_balance;
end;
$$;

revoke all on function public.fulfill_payment(uuid, text, integer, public.credit_reason) from public, anon, authenticated;
grant execute on function public.fulfill_payment(uuid, text, integer, public.credit_reason) to service_role;

-- Provider verification happens in the server before this function is called.
-- This function is the single database transaction that commits the verified payment,
-- its idempotent credit grant, and the initial subscription activation.
create or replace function public.confirm_payment_and_grant(
  p_payment_id uuid,
  p_amount_kobo integer,
  p_currency text,
  p_provider_payload jsonb,
  p_paid_at timestamptz,
  p_subscription_code text default null,
  p_provider_token text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_balance integer;
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payment_not_found';
  end if;

  if v_payment.status = 'succeeded' then
    select coalesce(sum(delta), 0)::integer into v_balance
    from public.credit_ledger where user_id = v_payment.user_id;
    return v_balance;
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'payment_not_pending';
  end if;

  if p_amount_kobo is distinct from v_payment.amount_kobo
     or upper(coalesce(p_currency, '')) <> v_payment.currency then
    raise exception 'payment_amount_mismatch';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_payment.user_id::text));

  update public.payments
  set status = 'succeeded',
      provider_payload = p_provider_payload,
      paid_at = coalesce(p_paid_at, timezone('utc', now())),
      failure_reason = null
  where id = v_payment.id;

  insert into public.credit_ledger (user_id, delta, reason, reference_id)
  values (
    v_payment.user_id,
    v_payment.credits,
    'purchase',
    case when v_payment.product_type = 'subscription'
      then 'subscription:' || v_payment.id::text
      else 'payment:' || v_payment.id::text
    end
  )
  on conflict (user_id, reason, reference_id) do nothing;

  if v_payment.product_type = 'subscription' then
    update public.subscriptions
    set status = 'active',
        provider_reference = coalesce(p_subscription_code, provider_reference),
        provider_token = coalesce(p_provider_token, provider_token),
        current_period_start = coalesce(p_paid_at, timezone('utc', now())),
        current_period_end = coalesce(p_paid_at, timezone('utc', now())) + interval '31 days',
        cancel_at_period_end = false
    where user_id = v_payment.user_id
      and plan_id = v_payment.product_id
      and status <> 'cancelled';
  end if;

  select coalesce(sum(delta), 0)::integer into v_balance
  from public.credit_ledger where user_id = v_payment.user_id;
  return v_balance;
end;
$$;

revoke all on function public.confirm_payment_and_grant(uuid, integer, text, jsonb, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.confirm_payment_and_grant(uuid, integer, text, jsonb, timestamptz, text, text) to service_role;
