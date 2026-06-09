-- =============================================================================
-- 2026 World Cup Bracket Database Schema
-- Run this in your Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → paste this entire file → Run
-- =============================================================================

-- Profiles table — display info for each user
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  created_at  timestamptz not null default now()
);

-- Brackets table — one user can save multiple brackets, but typically one per tournament
create table if not exists public.brackets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null default 'My Bracket',
  picks         jsonb not null default '{}'::jsonb,
  champion      text,
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists brackets_user_id_idx on public.brackets(user_id);
create index if not exists brackets_public_idx on public.brackets(is_public) where is_public = true;

-- Auto-update updated_at on bracket changes
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.brackets;
create trigger set_updated_at
  before update on public.brackets
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- Row Level Security (RLS) — controls who can read/write what
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.brackets enable row level security;

-- Profiles: anyone can read (for leaderboard display names), only owner can edit
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Brackets: public ones are readable by anyone; users manage their own
drop policy if exists "Public brackets are viewable by everyone" on public.brackets;
create policy "Public brackets are viewable by everyone"
  on public.brackets for select using (is_public = true or auth.uid() = user_id);

drop policy if exists "Users can insert their own brackets" on public.brackets;
create policy "Users can insert their own brackets"
  on public.brackets for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own brackets" on public.brackets;
create policy "Users can update their own brackets"
  on public.brackets for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own brackets" on public.brackets;
create policy "Users can delete their own brackets"
  on public.brackets for delete using (auth.uid() = user_id);

-- =============================================================================
-- Auto-create a profile row whenever a new user signs up
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Tournament results — the single source of truth for ACTUAL outcomes.
-- One row (id = 'wc2026'), shaped like a bracket's picks so scoring can compare
-- a user's picks directly against it. Anyone can read it (needed for the
-- leaderboard); only the service role may write (scripts/enter-result.mjs, or a
-- future nightly cron). There are intentionally no write policies for end users.
-- =============================================================================
create table if not exists public.tournament_results (
  id                  text primary key default 'wc2026',
  group_standings     jsonb not null default '{}'::jsonb,   -- { "A": ["MEX","KOR","RSA","CZE"], ... }
  third_place_advance jsonb not null default '[]'::jsonb,   -- ["A","C","D","F","G","I","J","L"]
  match_winners       jsonb not null default '{}'::jsonb,   -- { "M73": "BRA", "M74": "GER", ... }
  updated_at          timestamptz not null default now()
);

insert into public.tournament_results (id) values ('wc2026')
  on conflict (id) do nothing;

alter table public.tournament_results enable row level security;

drop policy if exists "Results are viewable by everyone" on public.tournament_results;
create policy "Results are viewable by everyone"
  on public.tournament_results for select using (true);
-- No insert/update/delete policies on purpose → writes require the service role key.

drop trigger if exists set_results_updated_at on public.tournament_results;
create trigger set_results_updated_at
  before update on public.tournament_results
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- Picks lock — freeze all bracket edits once the tournament kicks off.
-- `picks_lock_at` lives on the results row (null = open / no lock). When set,
-- end users can no longer UPDATE their brackets after that time. The service
-- role (scripts) is unaffected, so results entry still works.
-- =============================================================================
alter table public.tournament_results
  add column if not exists picks_lock_at timestamptz;

create or replace function public.picks_open()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select picks_lock_at from public.tournament_results where id = 'wc2026'),
    'infinity'::timestamptz
  ) > now();
$$;

-- Re-create the bracket UPDATE policy to also require picks to be open.
drop policy if exists "Users can update their own brackets" on public.brackets;
create policy "Users can update their own brackets"
  on public.brackets for update
  using (auth.uid() = user_id and public.picks_open())
  with check (auth.uid() = user_id and public.picks_open());
