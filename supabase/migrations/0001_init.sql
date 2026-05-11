-- ============================================================
-- 0001_init.sql  —  Project Saving initial schema
-- Run once in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    split_part(new.email, '@', 1)   -- e.g. "fan" from fan@gmail.com
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for users that existed before this trigger/migration ran.
insert into public.profiles (id, display_name)
select
  id,
  coalesce(
    raw_user_meta_data ->> 'full_name',
    raw_user_meta_data ->> 'name',
    split_part(email, '@', 1),
    'User'
  )
from auth.users
on conflict (id) do nothing;

-- ── goals ────────────────────────────────────────────────────
create table if not exists public.goals (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  target_amount numeric(12,2) not null check (target_amount > 0),
  start_date    date not null,
  end_date      date not null check (end_date >= start_date),
  updated_at    timestamptz not null default now()
);

-- ── savings_logs ─────────────────────────────────────────────
create table if not exists public.savings_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     numeric(12,2) not null check (amount > 0),
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists savings_logs_user_created
  on public.savings_logs (user_id, created_at desc);

create index if not exists savings_logs_created
  on public.savings_logs (created_at desc);

-- ── reactions ────────────────────────────────────────────────
create table if not exists public.reactions (
  log_id  uuid not null references public.savings_logs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji   text not null check (emoji in ('fire', 'heart', 'clap')),
  primary key (log_id, user_id, emoji)
);

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table public.profiles    enable row level security;
alter table public.goals       enable row level security;
alter table public.savings_logs enable row level security;
alter table public.reactions   enable row level security;

-- profiles
drop policy if exists "profiles: authenticated users can read" on public.profiles;
drop policy if exists "profiles: owner can insert"             on public.profiles;
drop policy if exists "profiles: owner can update"             on public.profiles;

create policy "profiles: authenticated users can read"
  on public.profiles for select
  to authenticated using (true);

create policy "profiles: owner can insert"
  on public.profiles for insert
  to authenticated with check (auth.uid() = id);

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated using (auth.uid() = id);

-- goals
drop policy if exists "goals: authenticated users can read" on public.goals;
drop policy if exists "goals: owner can insert"            on public.goals;
drop policy if exists "goals: owner can update"            on public.goals;

create policy "goals: authenticated users can read"
  on public.goals for select
  to authenticated using (true);

create policy "goals: owner can insert"
  on public.goals for insert
  to authenticated with check (auth.uid() = user_id);

create policy "goals: owner can update"
  on public.goals for update
  to authenticated using (auth.uid() = user_id);

-- savings_logs
drop policy if exists "savings_logs: authenticated users can read" on public.savings_logs;
drop policy if exists "savings_logs: owner can insert"            on public.savings_logs;
drop policy if exists "savings_logs: owner can update"            on public.savings_logs;
drop policy if exists "savings_logs: owner can delete"            on public.savings_logs;

create policy "savings_logs: authenticated users can read"
  on public.savings_logs for select
  to authenticated using (true);

create policy "savings_logs: owner can insert"
  on public.savings_logs for insert
  to authenticated with check (auth.uid() = user_id);

create policy "savings_logs: owner can update"
  on public.savings_logs for update
  to authenticated using (auth.uid() = user_id);

create policy "savings_logs: owner can delete"
  on public.savings_logs for delete
  to authenticated using (auth.uid() = user_id);

-- reactions
drop policy if exists "reactions: authenticated users can read" on public.reactions;
drop policy if exists "reactions: owner can insert"            on public.reactions;
drop policy if exists "reactions: owner can delete"            on public.reactions;

create policy "reactions: authenticated users can read"
  on public.reactions for select
  to authenticated using (true);

create policy "reactions: owner can insert"
  on public.reactions for insert
  to authenticated with check (auth.uid() = user_id);

create policy "reactions: owner can delete"
  on public.reactions for delete
  to authenticated using (auth.uid() = user_id);
