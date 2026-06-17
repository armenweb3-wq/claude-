-- ============================================================================
-- Catalyst — startup ⇄ investor marketplace schema
-- ----------------------------------------------------------------------------
-- HOW TO RUN: open your Supabase project → SQL Editor → New query → paste this
-- whole file → Run. It is idempotent-ish: safe to run on a fresh project.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES  (one row per registered user, linked to Supabase auth.users)
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('founder', 'investor', 'admin');

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        public.user_role not null default 'founder',
  headline    text,
  bio         text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. STARTUPS  (a founder's company listing)
-- ---------------------------------------------------------------------------
create table if not exists public.startups (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null unique references public.profiles (id) on delete cascade,
  name         text not null,
  tagline      text,
  description  text,
  sector       text,
  stage        text,
  location     text,
  website      text,
  funding_goal numeric,
  published    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists startups_owner_idx on public.startups (owner_id);

-- ---------------------------------------------------------------------------
-- 3. INVESTORS  (an investor's / firm's listing)
-- ---------------------------------------------------------------------------
create table if not exists public.investors (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references public.profiles (id) on delete cascade,
  name        text not null,
  thesis      text,
  sectors     text[],
  stages      text[],
  check_min   numeric,
  check_max   numeric,
  location    text,
  website     text,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists investors_owner_idx on public.investors (owner_id);

-- ---------------------------------------------------------------------------
-- 4. CONNECTIONS  (one party reaching out to another — the "matchmaking")
-- ---------------------------------------------------------------------------
create type public.connection_status as enum ('pending', 'accepted', 'declined');

create table if not exists public.connections (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references public.profiles (id) on delete cascade,
  to_id       uuid not null references public.profiles (id) on delete cascade,
  message     text,
  status      public.connection_status not null default 'pending',
  created_at  timestamptz not null default now(),
  unique (from_id, to_id)
);
create index if not exists connections_to_idx   on public.connections (to_id);
create index if not exists connections_from_idx on public.connections (from_id);

-- ---------------------------------------------------------------------------
-- 5. AUTO-CREATE a profile row whenever someone signs up
--    Role + full name are passed through auth metadata at registration.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'founder')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 6. is_admin() helper — SECURITY DEFINER so admin policies don't recurse
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.startups    enable row level security;
alter table public.investors   enable row level security;
alter table public.connections enable row level security;

-- PROFILES: anyone signed in can read the directory; you edit only yourself;
-- admins can read & manage everyone.
create policy "profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "admins manage all profiles"
  on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- STARTUPS: published listings are public; owners manage their own; admins all.
create policy "published startups are public"
  on public.startups for select using (published or owner_id = auth.uid() or public.is_admin());
create policy "owners insert own startup"
  on public.startups for insert to authenticated with check (owner_id = auth.uid());
create policy "owners update own startup"
  on public.startups for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete own startup"
  on public.startups for delete to authenticated using (owner_id = auth.uid());
create policy "admins manage all startups"
  on public.startups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- INVESTORS: same pattern as startups.
create policy "published investors are public"
  on public.investors for select using (published or owner_id = auth.uid() or public.is_admin());
create policy "owners insert own investor"
  on public.investors for insert to authenticated with check (owner_id = auth.uid());
create policy "owners update own investor"
  on public.investors for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete own investor"
  on public.investors for delete to authenticated using (owner_id = auth.uid());
create policy "admins manage all investors"
  on public.investors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- CONNECTIONS: you can see ones you sent or received; create as yourself; the
-- recipient can update status (accept/decline); admins see all.
create policy "see own connections"
  on public.connections for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid() or public.is_admin());
create policy "create connection as self"
  on public.connections for insert to authenticated with check (from_id = auth.uid());
create policy "recipient updates connection"
  on public.connections for update to authenticated
  using (to_id = auth.uid()) with check (to_id = auth.uid());
create policy "admins manage connections"
  on public.connections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. MAKE YOURSELF AN ADMIN
--    After you register through the website, run this once with your email:
--
--      update public.profiles set role = 'admin'
--      where id = (select id from auth.users where email = 'you@example.com');
-- ---------------------------------------------------------------------------
