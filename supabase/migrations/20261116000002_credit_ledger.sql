-- Step 3.2: Append-only credit ledger and atomic credit functions
-- Invariant 3: Credits are an append-only ledger. Balance is always derived as sum(delta).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'credit_reason') then
    create type public.credit_reason as enum ('grant', 'purchase', 'export', 'refund', 'adjustment');
  end if;
end
$$;

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  delta integer not null check (delta <> 0),
  reason public.credit_reason not null,
  reference_id text not null check (char_length(trim(reference_id)) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, reason, reference_id)
);

create index if not exists credit_ledger_user_created_idx on public.credit_ledger (user_id, created_at desc);

-- Enforce append-only invariant: forbid UPDATE and DELETE on credit_ledger
create or replace function public.prevent_credit_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'credit_ledger is append-only; rows may never be updated or deleted';
end;
$$;

create trigger credit_ledger_append_only
  before update or delete on public.credit_ledger
  for each row execute function public.prevent_credit_ledger_mutation();

alter table public.credit_ledger enable row level security;

-- Users can read their own ledger rows; zero insert/update/delete policies for clients
create policy "ledger_select_own" on public.credit_ledger
  for select using (auth.uid() = user_id);

-- Atomic credit consumption with per-user advisory lock and idempotency on ('export', p_reference_id)
create or replace function public.consume_credit(
  p_user_id uuid,
  p_reference_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_user_id is null or p_reference_id is null or char_length(trim(p_reference_id)) = 0 then
    raise exception 'invalid_arguments';
  end if;

  -- Serialize all ledger operations for this user within the transaction
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Idempotency check: if already consumed for this reference_id, return current balance without double charging
  if exists (
    select 1
    from public.credit_ledger
    where user_id = p_user_id
      and reason = 'export'
      and reference_id = p_reference_id
  ) then
    select coalesce(sum(delta), 0)::integer
    into v_balance
    from public.credit_ledger
    where user_id = p_user_id;

    return v_balance;
  end if;

  select coalesce(sum(delta), 0)::integer
  into v_balance
  from public.credit_ledger
  where user_id = p_user_id;

  if v_balance < 1 then
    raise exception 'insufficient_credits';
  end if;

  insert into public.credit_ledger (user_id, delta, reason, reference_id)
  values (p_user_id, -1, 'export', p_reference_id);

  return v_balance - 1;
end;
$$;

-- Atomic credit refund for a failed export after deduction, idempotent on ('refund', p_reference_id)
create or replace function public.refund_credit(
  p_user_id uuid,
  p_reference_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_user_id is null or p_reference_id is null or char_length(trim(p_reference_id)) = 0 then
    raise exception 'invalid_arguments';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Idempotency check: if already refunded for this reference_id, return current balance
  if exists (
    select 1
    from public.credit_ledger
    where user_id = p_user_id
      and reason = 'refund'
      and reference_id = p_reference_id
  ) then
    select coalesce(sum(delta), 0)::integer
    into v_balance
    from public.credit_ledger
    where user_id = p_user_id;

    return v_balance;
  end if;

  -- Verify an export deduction exists for this reference before refunding
  if not exists (
    select 1
    from public.credit_ledger
    where user_id = p_user_id
      and reason = 'export'
      and reference_id = p_reference_id
  ) then
    raise exception 'export_deduction_not_found';
  end if;

  insert into public.credit_ledger (user_id, delta, reason, reference_id)
  values (p_user_id, 1, 'refund', p_reference_id);

  select coalesce(sum(delta), 0)::integer
  into v_balance
  from public.credit_ledger
  where user_id = p_user_id;

  return v_balance;
end;
$$;

-- Atomic credit grant (starter grant, purchase, or admin adjustment), idempotent on (p_reason, p_reference_id)
create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason public.credit_reason,
  p_reference_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 or p_reference_id is null or char_length(trim(p_reference_id)) = 0 then
    raise exception 'invalid_arguments';
  end if;

  if p_reason not in ('grant', 'purchase', 'adjustment') then
    raise exception 'invalid_grant_reason';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  if not exists (
    select 1
    from public.credit_ledger
    where user_id = p_user_id
      and reason = p_reason
      and reference_id = p_reference_id
  ) then
    insert into public.credit_ledger (user_id, delta, reason, reference_id)
    values (p_user_id, p_amount, p_reason, p_reference_id);
  end if;

  select coalesce(sum(delta), 0)::integer
  into v_balance
  from public.credit_ledger
  where user_id = p_user_id;

  return v_balance;
end;
$$;

-- Restrict execution of ledger functions to service_role only
revoke all on function public.consume_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.refund_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.grant_credits(uuid, integer, public.credit_reason, text) from public, anon, authenticated;

grant execute on function public.consume_credit(uuid, text) to service_role;
grant execute on function public.refund_credit(uuid, text) to service_role;
grant execute on function public.grant_credits(uuid, integer, public.credit_reason, text) to service_role;
