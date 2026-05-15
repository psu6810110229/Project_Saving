-- ============================================================
-- 0037_notifications.sql
-- Task 23.1 — Notification foundation.
--
-- Adds:
--   * public.notifications              — per-recipient in-app log
--   * public.notification_preferences   — global per-user toggles
--   * public.notification_delivery_attempts — small debug log
--   * push_subscriptions hardening (updated_at, last_seen_at,
--     own-update policy)
--   * RLS policies for all of the above
--   * RPCs:
--       get_notification_preferences()
--       update_notification_preferences(...)
--       list_notifications(p_limit, p_before)
--       unread_notification_count()
--       mark_notification_read(p_notification_id uuid)
--       mark_all_notifications_read()
--
-- The notification log is the source of truth for the in-app
-- Notification Center. Direct client inserts are not allowed —
-- partner-facing event creation lands in 23.2+ via security-definer
-- helper RPCs. Every row must carry a non-empty target_route and
-- fallback_route so the tap-target resolver always has somewhere
-- to go.
-- ============================================================

begin;

-- ── notifications ───────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  room_id uuid references public.rooms(id) on delete cascade,
  event_key text not null,
  category text not null,
  channel_policy text not null default 'in_app',
  title text not null,
  body text not null,
  cta_label text,
  target_route text not null,
  target_section text,
  fallback_route text not null,
  push_safe boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  source_table text,
  source_id uuid,
  dedupe_key text not null,
  read_at timestamptz,
  clicked_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_category_check check (category in (
    'nudge', 'saving_reminder', 'partner_activity', 'product'
  )),
  constraint notifications_channel_policy_check check (channel_policy in (
    'in_app', 'push_candidate', 'push_sent', 'push_skipped'
  )),
  constraint notifications_target_route_not_empty check (length(btrim(target_route)) > 0),
  constraint notifications_fallback_route_not_empty check (length(btrim(fallback_route)) > 0),
  constraint notifications_recipient_dedupe_unique unique (recipient_user_id, dedupe_key)
);

create index if not exists idx_notifications_recipient_recent
  on public.notifications (recipient_user_id, created_at desc)
  where archived_at is null;

create index if not exists idx_notifications_recipient_unread
  on public.notifications (recipient_user_id, read_at)
  where read_at is null and archived_at is null;

create index if not exists idx_notifications_room_recent
  on public.notifications (room_id, created_at desc);

create index if not exists idx_notifications_source
  on public.notifications (source_table, source_id);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;

-- Recipients see only their own notifications.
create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (recipient_user_id = auth.uid());

-- Direct updates are restricted to own rows. The client is expected
-- to use the mark_*_read RPCs; column-level write control happens at
-- the RPC layer.
create policy "notifications_update_own"
  on public.notifications
  for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

-- No insert/delete policies → clients cannot fabricate notifications
-- for another user. Service role (edge functions) bypasses RLS, and
-- future security-definer helpers will own creation.

-- ── notification_preferences ────────────────────────────────────
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  master_enabled boolean not null default true,
  push_enabled boolean not null default false,
  nudges_enabled boolean not null default true,
  saving_reminders_enabled boolean not null default false,
  partner_activity_enabled boolean not null default true,
  product_updates_enabled boolean not null default true,
  prompt_dismissed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_prefs_select_own" on public.notification_preferences;
drop policy if exists "notification_prefs_insert_own" on public.notification_preferences;
drop policy if exists "notification_prefs_update_own" on public.notification_preferences;

create policy "notification_prefs_select_own"
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "notification_prefs_insert_own"
  on public.notification_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "notification_prefs_update_own"
  on public.notification_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── notification_delivery_attempts ──────────────────────────────
create table if not exists public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  push_subscription_id uuid references public.push_subscriptions(id) on delete set null,
  channel text not null,
  status text not null,
  error_code text,
  error_message text,
  attempted_at timestamptz not null default now(),
  constraint nda_channel_check check (channel in ('push')),
  constraint nda_status_check check (status in ('queued', 'sent', 'skipped', 'failed', 'expired'))
);

create index if not exists idx_nda_notification
  on public.notification_delivery_attempts (notification_id, attempted_at desc);

create index if not exists idx_nda_recipient
  on public.notification_delivery_attempts (recipient_user_id, attempted_at desc);

create index if not exists idx_nda_status
  on public.notification_delivery_attempts (status, attempted_at desc);

alter table public.notification_delivery_attempts enable row level security;

-- No client-side policies. Service role writes/reads attempts; clients
-- never read partner delivery telemetry.

-- ── push_subscriptions hardening ────────────────────────────────
alter table public.push_subscriptions
  add column if not exists updated_at timestamptz not null default now();

alter table public.push_subscriptions
  add column if not exists last_seen_at timestamptz;

drop policy if exists "push_subs_update_own" on public.push_subscriptions;

create policy "push_subs_update_own"
  on public.push_subscriptions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── RPC: get_notification_preferences ───────────────────────────
-- Returns the caller's preferences row, creating defaults on first
-- call. Idempotent.
create or replace function public.get_notification_preferences()
returns public.notification_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.notification_preferences;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_row
    from public.notification_preferences
    where user_id = v_user_id;

  if not found then
    insert into public.notification_preferences (user_id)
      values (v_user_id)
      on conflict (user_id) do nothing;

    select * into v_row
      from public.notification_preferences
      where user_id = v_user_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.get_notification_preferences() from public;
grant execute on function public.get_notification_preferences() to authenticated;

-- ── RPC: update_notification_preferences ────────────────────────
-- Partial update: any null argument means "leave unchanged". Always
-- restricted to the caller's own row, and refreshes updated_at.
create or replace function public.update_notification_preferences(
  p_master_enabled boolean default null,
  p_push_enabled boolean default null,
  p_nudges_enabled boolean default null,
  p_saving_reminders_enabled boolean default null,
  p_partner_activity_enabled boolean default null,
  p_product_updates_enabled boolean default null,
  p_prompt_dismissed_until timestamptz default null,
  p_clear_prompt_dismissed boolean default false
)
returns public.notification_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.notification_preferences;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into public.notification_preferences (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

  update public.notification_preferences
    set master_enabled            = coalesce(p_master_enabled, master_enabled),
        push_enabled              = coalesce(p_push_enabled, push_enabled),
        nudges_enabled            = coalesce(p_nudges_enabled, nudges_enabled),
        saving_reminders_enabled  = coalesce(p_saving_reminders_enabled, saving_reminders_enabled),
        partner_activity_enabled  = coalesce(p_partner_activity_enabled, partner_activity_enabled),
        product_updates_enabled   = coalesce(p_product_updates_enabled, product_updates_enabled),
        prompt_dismissed_until    = case
                                      when p_clear_prompt_dismissed then null
                                      else coalesce(p_prompt_dismissed_until, prompt_dismissed_until)
                                    end,
        updated_at                = now()
    where user_id = v_user_id
    returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_notification_preferences(
  boolean, boolean, boolean, boolean, boolean, boolean, timestamptz, boolean
) from public;
grant execute on function public.update_notification_preferences(
  boolean, boolean, boolean, boolean, boolean, boolean, timestamptz, boolean
) to authenticated;

-- ── RPC: list_notifications ─────────────────────────────────────
-- Returns the caller's most recent un-archived notifications, newest
-- first. `p_before` lets the client page back through history.
create or replace function public.list_notifications(
  p_limit integer default 30,
  p_before timestamptz default null
)
returns table (
  id uuid,
  recipient_user_id uuid,
  actor_user_id uuid,
  room_id uuid,
  event_key text,
  category text,
  channel_policy text,
  title text,
  body text,
  cta_label text,
  target_route text,
  target_section text,
  fallback_route text,
  push_safe boolean,
  payload jsonb,
  read_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 100));
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
    select n.id, n.recipient_user_id, n.actor_user_id, n.room_id,
           n.event_key, n.category, n.channel_policy,
           n.title, n.body, n.cta_label,
           n.target_route, n.target_section, n.fallback_route,
           n.push_safe, n.payload,
           n.read_at, n.clicked_at, n.created_at
      from public.notifications n
     where n.recipient_user_id = v_user_id
       and n.archived_at is null
       and (p_before is null or n.created_at < p_before)
     order by n.created_at desc
     limit v_limit;
end;
$$;

revoke all on function public.list_notifications(integer, timestamptz) from public;
grant execute on function public.list_notifications(integer, timestamptz) to authenticated;

-- ── RPC: unread_notification_count ──────────────────────────────
create or replace function public.unread_notification_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select count(*)::int into v_count
    from public.notifications
    where recipient_user_id = v_user_id
      and read_at is null
      and archived_at is null;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.unread_notification_count() from public;
grant execute on function public.unread_notification_count() to authenticated;

-- ── RPC: mark_notification_read ─────────────────────────────────
-- Idempotent: re-marking a read notification is a no-op (read_at is
-- preserved via coalesce). Only the recipient can mark their row.
create or replace function public.mark_notification_read(p_notification_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_read_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_notification_id is null then
    raise exception 'notification id required' using errcode = '22023';
  end if;

  update public.notifications
    set read_at = coalesce(read_at, now())
    where id = p_notification_id
      and recipient_user_id = v_user_id
    returning read_at into v_read_at;

  if not found then
    raise exception 'notification not found' using errcode = 'P0002';
  end if;

  return v_read_at;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

-- ── RPC: mark_all_notifications_read ────────────────────────────
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  with upd as (
    update public.notifications
      set read_at = now()
      where recipient_user_id = v_user_id
        and read_at is null
        and archived_at is null
      returning 1
  )
  select count(*)::int into v_count from upd;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

commit;
