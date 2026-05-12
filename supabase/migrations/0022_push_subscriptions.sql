-- ============================================================
-- 0022_push_subscriptions.sql
-- Web Push subscriptions for the Phase 6.8 "nudge" feature.
-- Each row stores a single PushSubscription registered by a
-- (user, device) pair. Users may have multiple rows (phone + desktop).
-- The send-nudge edge function selects rows for the partner user_id
-- and POSTs an encrypted push to each endpoint.
-- ============================================================

begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Users can manage their own subscriptions from the client. Cross-user
-- SELECT is intentionally forbidden — the send-nudge edge function
-- runs with the service role and reads partner endpoints server-side.
drop policy if exists "push_subs_insert_own" on public.push_subscriptions;
drop policy if exists "push_subs_select_own" on public.push_subscriptions;
drop policy if exists "push_subs_update_own" on public.push_subscriptions;
drop policy if exists "push_subs_delete_own" on public.push_subscriptions;

create policy "push_subs_insert_own"
  on public.push_subscriptions
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "push_subs_select_own"
  on public.push_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "push_subs_delete_own"
  on public.push_subscriptions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Optional throttle table so a user cannot spam nudges.
create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_nudges_from_to_time
  on public.nudges (from_user, to_user, created_at desc);

alter table public.nudges enable row level security;

drop policy if exists "nudges_insert_own" on public.nudges;
drop policy if exists "nudges_select_own_pair" on public.nudges;

create policy "nudges_insert_own"
  on public.nudges
  for insert
  to authenticated
  with check (from_user = auth.uid());

create policy "nudges_select_own_pair"
  on public.nudges
  for select
  to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

commit;
