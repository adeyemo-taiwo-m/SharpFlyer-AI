-- Step 3.1: Core schema migration and Row-Level Security (RLS)
-- Additive migration only. All timestamps are UTC timestamptz; all user-owned tables enforce RLS.

create extension if not exists "pgcrypto";

-- Helper trigger function for updated_at columns
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- 1. profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name_default text,
  business_type text,
  onboarding_state text not null default 'not_started'
    check (onboarding_state in ('not_started', 'in_progress', 'completed', 'skipped')),
  theme_preference text not null default 'system'
    check (theme_preference in ('light', 'dark', 'system')),
  is_admin boolean not null default false,
  starter_credits_granted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Prevent non-service-role callers from escalating is_admin or forging starter_credits_granted
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.starter_credits_granted := false;
    elsif tg_op = 'UPDATE' then
      new.is_admin := old.is_admin;
      new.starter_credits_granted := old.starter_credits_granted;
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 2. templates (versioned template catalog; definitions live in repo files)
create table if not exists public.templates (
  id text not null check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  version integer not null check (version >= 1),
  title text not null,
  category text not null,
  tags text[] not null default '{}',
  style text not null,
  formats text[] not null check (cardinality(formats) >= 1),
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  license jsonb not null,
  definition_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (id, version)
);

create index if not exists templates_category_status_idx on public.templates (category, status);

create trigger templates_set_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

alter table public.templates enable row level security;

create policy "templates_select_published" on public.templates
  for select using (status = 'published');

-- 3. assets (user-owned uploaded and rendered files)
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('logo', 'product_image', 'background', 'preview', 'export')),
  bucket text not null check (bucket in ('uploads', 'renders')),
  bucket_path text not null unique,
  hash text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')),
  size_bytes integer not null check (size_bytes > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists assets_user_id_idx on public.assets (user_id, created_at desc);
create index if not exists assets_user_hash_idx on public.assets (user_id, hash);

alter table public.assets enable row level security;

create policy "assets_select_own" on public.assets
  for select using (auth.uid() = user_id);

create policy "assets_insert_own" on public.assets
  for insert with check (auth.uid() = user_id);

create policy "assets_update_own" on public.assets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "assets_delete_own" on public.assets
  for delete using (auth.uid() = user_id);

-- 4. brand_profiles (one per user in MVP)
create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null check (char_length(trim(business_name)) between 1 and 80),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  address text check (address is null or char_length(address) <= 140),
  logo_asset_id uuid references public.assets(id) on delete set null,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists brand_profiles_logo_asset_id_idx on public.brand_profiles (logo_asset_id);

create trigger brand_profiles_set_updated_at
  before update on public.brand_profiles
  for each row execute function public.set_updated_at();

alter table public.brand_profiles enable row level security;

create policy "brand_profiles_select_own" on public.brand_profiles
  for select using (auth.uid() = user_id);

create policy "brand_profiles_insert_own" on public.brand_profiles
  for insert with check (auth.uid() = user_id);

create policy "brand_profiles_update_own" on public.brand_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "brand_profiles_delete_own" on public.brand_profiles
  for delete using (auth.uid() = user_id);

-- 5. flyers (drafts and active flyers pinned to a template version)
create table if not exists public.flyers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled flyer' check (char_length(trim(title)) between 1 and 120),
  template_id text not null,
  template_version integer not null,
  format text not null check (format in ('status', 'ig_post', 'story', 'fb_post', 'a4')),
  theme_id text not null,
  content jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'rendered', 'exported')),
  preview_asset_id uuid references public.assets(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (template_id, template_version) references public.templates(id, version) on delete restrict
);

create index if not exists flyers_user_id_updated_idx on public.flyers (user_id, updated_at desc);
create index if not exists flyers_template_idx on public.flyers (template_id, template_version);

create trigger flyers_set_updated_at
  before update on public.flyers
  for each row execute function public.set_updated_at();

alter table public.flyers enable row level security;

create policy "flyers_select_own" on public.flyers
  for select using (auth.uid() = user_id);

create policy "flyers_insert_own" on public.flyers
  for insert with check (auth.uid() = user_id);

create policy "flyers_update_own" on public.flyers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "flyers_delete_own" on public.flyers
  for delete using (auth.uid() = user_id);

-- 6. flyer_versions (immutable snapshots created at export)
create table if not exists public.flyer_versions (
  id uuid primary key default gen_random_uuid(),
  flyer_id uuid not null references public.flyers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  template_id text not null,
  template_version integer not null,
  format text not null check (format in ('status', 'ig_post', 'story', 'fb_post', 'a4')),
  theme_id text not null,
  content_snapshot jsonb not null,
  export_asset_id uuid references public.assets(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (flyer_id, version_number),
  foreign key (template_id, template_version) references public.templates(id, version) on delete restrict
);

create index if not exists flyer_versions_user_id_idx on public.flyer_versions (user_id, created_at desc);
create index if not exists flyer_versions_flyer_id_idx on public.flyer_versions (flyer_id, version_number desc);

-- Enforce immutability of flyer_versions snapshots
create or replace function public.prevent_flyer_version_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'flyer_versions rows are immutable snapshots and cannot be updated';
end;
$$;

create trigger flyer_versions_immutable
  before update on public.flyer_versions
  for each row execute function public.prevent_flyer_version_mutation();

alter table public.flyer_versions enable row level security;

-- Users can read their own flyer_versions; inserts happen via server functions
create policy "flyer_versions_select_own" on public.flyer_versions
  for select using (auth.uid() = user_id);
