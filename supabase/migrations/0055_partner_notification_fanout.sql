-- ============================================================
-- 0055_partner_notification_fanout.sql
-- Task 31 — Multi-user notification fan-out.
--
-- Replaces the single-recipient `_other_room_member(...)` pattern in
-- every in-scope `notify_*` RPC with an explicit loop over every other
-- current room member. Each recipient is gated independently by
-- `_insert_partner_notification` (master_enabled +
-- partner_activity_enabled, defaults from 0037). Per-recipient dedupe
-- still relies on the existing unique index
-- `(recipient_user_id, dedupe_key)`; the dedupe keys already include
-- the recipient id, so they remain collision-free under fan-out.
--
-- In-scope (this migration):
--   * notify_partner_deposit         — return type uuid → jsonb
--   * notify_balance_checked         — body only, return uuid
--   * notify_plan_created            — body only, return uuid
--   * notify_plan_changed            — body only, return uuid
--   * notify_plan_paused             — body only, return uuid
--   * notify_plan_resumed            — body only, return uuid
--   * notify_goal_changed            — body only, return uuid
--   * notify_room_joined             — body only, return uuid
--   * notify_room_left               — body only, return uuid
--   * notify_bucket_added            — body only, return uuid
--   * notify_bucket_updated          — body only, return uuid
--   * _smart_check_goal_reached      — body only, returns void
--
-- Out of scope (explicitly not touched here):
--   * _smart_check_overtaking — N-player crossing semantics are a
--     product question that requires its own design. Today's 2-user
--     behaviour stays exactly as 0043 left it. Tracked as a follow-up.
--   * _other_room_member — receives a documentation COMMENT only; the
--     body, grants, and signature are unchanged. It is still used by
--     `_smart_check_overtaking`.
--   * room_members capacity (enforce_two_player_cap, 0023) and
--     join_room_by_code (0024). NOT TOUCHED.
--
-- Caller audit (re-run with `rg "notify_partner_deposit"` and
-- `rg "notification_id" src/` during implementation):
--   * notify_partner_deposit has exactly one production caller —
--     the `notify-partner-deposit` edge function. The fallback in
--     src/lib/notifyEvents.ts also invokes it but discards the
--     return value via the generic `call(...)` helper. No client UI
--     reads `notification_id` from the edge function's HTTP response
--     body (the references in src/sw.ts and NudgeButton.tsx are
--     either for the push payload — which is per-recipient and
--     unchanged — or for the unrelated `send-nudge` response).
--   * All other notify_* RPCs in this migration are invoked from
--     src/lib/notifyEvents.ts via `supabase.rpc(...)` with the
--     return value discarded. Safe to keep `returns uuid` and
--     return null after the loop.
--
-- Deployment ordering (see plan §6):
--   1. Deploy the new edge function first (tolerates BOTH uuid and
--      jsonb return shapes so push continues during the gap).
--   2. Apply this migration. The edge function then takes the new
--      jsonb path automatically.
-- ============================================================

begin;

-- ── _other_room_member: documentation only ─────────────────────
-- Body, grants, signature unchanged. Its sole intentional caller
-- after this migration is `_smart_check_overtaking`, which is
-- queued for an N-player redesign in a follow-up task.
comment on function public._other_room_member(uuid, uuid) is
  'Legacy single-recipient helper. Returns at most one other room ' ||
  'member. Do not use for new partner-activity fan-out paths — loop ' ||
  'public.room_members directly per the pattern in ' ||
  '0053_rename_room.sql. After migration 0055 the only intentional ' ||
  'remaining caller is _smart_check_overtaking, which is queued for ' ||
  'an N-player redesign.';

-- ── notify_partner_deposit: return uuid → jsonb (fan-out) ──────
-- PostgreSQL CREATE OR REPLACE cannot change a function's return
-- type, so we DROP first, then CREATE, then re-issue grants.
--
-- Return shape:
--   * null               → no other members in the room
--   * '[]'::jsonb        → other members existed but every per-
--                          recipient insert was deduped
--   * non-empty jsonb[]  → one entry per inserted in-app row, shape
--                          {"notification_id": uuid, "recipient_user_id": uuid}
drop function if exists public.notify_partner_deposit(uuid);

create function public.notify_partner_deposit(p_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor       uuid := auth.uid();
  v_log_user    uuid;
  v_room_id     uuid;
  v_amount      numeric;
  v_bucket_id   uuid;
  v_bucket_name text;
  v_actor_name  text;
  v_title       text;
  v_body        text;
  v_payload     jsonb;
  v_dedupe      text;
  v_id          uuid;
  v_member      record;
  v_results     jsonb := '[]'::jsonb;
  v_has_other   boolean;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_log_id is null then
    raise exception 'log id required' using errcode = '22023';
  end if;

  select s.user_id, s.room_id, s.amount, s.bucket_id
    into v_log_user, v_room_id, v_amount, v_bucket_id
  from public.savings_logs s
  where s.id = p_log_id;

  if v_log_user is null then
    raise exception 'log not found' using errcode = 'P0002';
  end if;
  if v_log_user <> v_actor then
    raise exception 'cannot notify on another user log' using errcode = '42501';
  end if;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  if v_bucket_id is not null then
    select b.name into v_bucket_name
      from public.buckets b
     where b.id = v_bucket_id;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_title := v_actor_name || ' added savings';
  v_body  := '฿' || trim(to_char(v_amount, 'FM999,999,999,990'))
             || coalesce(' was recorded for ' || v_bucket_name || '.', ' was recorded.');
  v_payload := jsonb_build_object(
    'amount', v_amount,
    'bucket_id', v_bucket_id,
    'bucket_name', v_bucket_name,
    'actor_name', v_actor_name,
    'log_id', p_log_id
  );

  -- Fan out one in-app notification per OTHER current member.
  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'deposit:' || p_log_id::text || ':' || v_member.user_id::text;
    v_id := public._insert_partner_notification(
      v_member.user_id, v_actor, v_room_id, 'partner_deposited', v_dedupe,
      v_title, v_body, 'View activity',
      '/dashboard', 'activity', '/dashboard',
      false,
      v_payload, 'savings_logs', p_log_id
    );
    if v_id is not null then
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'notification_id', v_id,
          'recipient_user_id', v_member.user_id
        )
      );
    end if;
  end loop;

  -- Distinguish "no other members" (return null → edge function emits
  -- `no_partner`) from "other members existed but all were deduped or
  -- preference-suppressed" (return '[]' → edge function emits
  -- `duplicate`). The edge function relies on this distinction.
  if jsonb_array_length(v_results) = 0 then
    select exists (
      select 1 from public.room_members rm
       where rm.room_id = v_room_id and rm.user_id <> v_actor
    ) into v_has_other;
    if not v_has_other then
      return null;
    end if;
    return '[]'::jsonb;
  end if;

  return v_results;
end;
$$;

-- DROP wiped the grants — re-issue them. Without these the
-- edge-function call (made under the caller's JWT) would fail with a
-- permission error.
revoke all on function public.notify_partner_deposit(uuid) from public;
grant execute on function public.notify_partner_deposit(uuid) to authenticated;

-- ── notify_balance_checked ─────────────────────────────────────
-- Return type unchanged (uuid → returns null after the loop). All
-- callers in src/lib/notifyEvents.ts discard the return value.
create or replace function public.notify_balance_checked(p_checkpoint_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor       uuid := auth.uid();
  v_ck_user     uuid;
  v_room_id     uuid;
  v_actor_name  text;
  v_dedupe      text;
  v_member      record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_checkpoint_id is null then
    raise exception 'checkpoint id required' using errcode = '22023';
  end if;

  select bc.user_id, bc.room_id
    into v_ck_user, v_room_id
  from public.balance_checkpoints bc
  where bc.id = p_checkpoint_id;

  if v_ck_user is null then
    raise exception 'checkpoint not found' using errcode = 'P0002';
  end if;
  if v_ck_user <> v_actor then
    raise exception 'cannot notify on another user checkpoint' using errcode = '42501';
  end if;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_actor_name := public._actor_display_name(v_actor);

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'balance_check:' || p_checkpoint_id::text || ':' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_actor, v_room_id, 'balance_checked', v_dedupe,
      v_actor_name || ' checked balance',
      'The latest balance check is available in activity.',
      'View activity',
      '/dashboard', 'activity', '/dashboard',
      false,
      jsonb_build_object('actor_name', v_actor_name, 'checkpoint_id', p_checkpoint_id),
      'balance_checkpoints', p_checkpoint_id
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_balance_checked(uuid) from public;
grant execute on function public.notify_balance_checked(uuid) to authenticated;

-- ── notify_plan_created ────────────────────────────────────────
create or replace function public.notify_plan_created(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_rev_user   uuid;
  v_plan_id    uuid;
  v_room_id    uuid;
  v_actor_name text;
  v_dedupe     text;
  v_member     record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_revision_id is null then
    raise exception 'revision id required' using errcode = '22023';
  end if;

  select r.user_id, r.plan_id, r.room_id
    into v_rev_user, v_plan_id, v_room_id
  from public.saving_plan_revisions r
  where r.id = p_revision_id;

  if v_rev_user is null then
    raise exception 'revision not found' using errcode = 'P0002';
  end if;
  if v_rev_user <> v_actor then
    raise exception 'cannot notify on another user plan' using errcode = '42501';
  end if;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_actor_name := public._actor_display_name(v_actor);

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'plan_created:' || v_plan_id::text || ':' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_actor, v_room_id, 'plan_created', v_dedupe,
      'Saving plan started',
      v_actor_name || ' set up a saving plan for this project.',
      'View plan',
      '/saving-plan', null, '/saving-plan',
      false,
      jsonb_build_object('plan_id', v_plan_id, 'actor_name', v_actor_name),
      'saving_plans', v_plan_id
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_plan_created(uuid) from public;
grant execute on function public.notify_plan_created(uuid) to authenticated;

-- ── notify_plan_changed ────────────────────────────────────────
create or replace function public.notify_plan_changed(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_rev_user   uuid;
  v_plan_id    uuid;
  v_room_id    uuid;
  v_actor_name text;
  v_dedupe     text;
  v_member     record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_revision_id is null then
    raise exception 'revision id required' using errcode = '22023';
  end if;

  select r.user_id, r.plan_id, r.room_id
    into v_rev_user, v_plan_id, v_room_id
  from public.saving_plan_revisions r
  where r.id = p_revision_id;

  if v_rev_user is null then
    raise exception 'revision not found' using errcode = 'P0002';
  end if;
  if v_rev_user <> v_actor then
    raise exception 'cannot notify on another user plan' using errcode = '42501';
  end if;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_actor_name := public._actor_display_name(v_actor);

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'plan_revision:' || p_revision_id::text || ':' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_actor, v_room_id, 'plan_changed', v_dedupe,
      'Saving plan updated',
      v_actor_name || ' updated their saving plan details.',
      'View plan',
      '/saving-plan', null, '/saving-plan',
      false,
      jsonb_build_object('plan_id', v_plan_id, 'revision_id', p_revision_id, 'actor_name', v_actor_name),
      'saving_plan_revisions', p_revision_id
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_plan_changed(uuid) from public;
grant execute on function public.notify_plan_changed(uuid) to authenticated;

-- ── notify_plan_paused ─────────────────────────────────────────
create or replace function public.notify_plan_paused(p_pause_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_pause_user uuid;
  v_plan_id    uuid;
  v_room_id    uuid;
  v_actor_name text;
  v_dedupe     text;
  v_member     record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_pause_id is null then
    raise exception 'pause id required' using errcode = '22023';
  end if;

  select sp.user_id, sp.plan_id, sp.room_id
    into v_pause_user, v_plan_id, v_room_id
  from public.saving_plan_pauses sp
  where sp.id = p_pause_id;

  if v_pause_user is null then
    raise exception 'pause not found' using errcode = 'P0002';
  end if;
  if v_pause_user <> v_actor then
    raise exception 'cannot notify on another user pause' using errcode = '42501';
  end if;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_actor_name := public._actor_display_name(v_actor);

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'plan_pause:' || p_pause_id::text || ':paused:' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_actor, v_room_id, 'plan_paused', v_dedupe,
      'Saving plan paused',
      v_actor_name || ' paused their saving plan.',
      'View plan',
      '/saving-plan', null, '/saving-plan',
      false,
      jsonb_build_object('plan_id', v_plan_id, 'pause_id', p_pause_id, 'actor_name', v_actor_name),
      'saving_plan_pauses', p_pause_id
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_plan_paused(uuid) from public;
grant execute on function public.notify_plan_paused(uuid) to authenticated;

-- ── notify_plan_resumed ────────────────────────────────────────
create or replace function public.notify_plan_resumed(p_pause_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_pause_user uuid;
  v_plan_id    uuid;
  v_room_id    uuid;
  v_actor_name text;
  v_dedupe     text;
  v_member     record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_pause_id is null then
    raise exception 'pause id required' using errcode = '22023';
  end if;

  select sp.user_id, sp.plan_id, sp.room_id
    into v_pause_user, v_plan_id, v_room_id
  from public.saving_plan_pauses sp
  where sp.id = p_pause_id;

  if v_pause_user is null then
    raise exception 'pause not found' using errcode = 'P0002';
  end if;
  if v_pause_user <> v_actor then
    raise exception 'cannot notify on another user pause' using errcode = '42501';
  end if;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_actor_name := public._actor_display_name(v_actor);

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'plan_pause:' || p_pause_id::text || ':resumed:' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_actor, v_room_id, 'plan_resumed', v_dedupe,
      'Saving plan resumed',
      v_actor_name || ' resumed their saving plan.',
      'View plan',
      '/saving-plan', null, '/saving-plan',
      false,
      jsonb_build_object('plan_id', v_plan_id, 'pause_id', p_pause_id, 'actor_name', v_actor_name),
      'saving_plan_pauses', p_pause_id
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_plan_resumed(uuid) from public;
grant execute on function public.notify_plan_resumed(uuid) to authenticated;

-- ── notify_goal_changed ────────────────────────────────────────
-- Per-Bangkok-minute dedupe bucket so a rapid double-save still
-- collapses to one notification per recipient.
create or replace function public.notify_goal_changed(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_actor_name text;
  v_dedupe     text;
  v_bucket     text;
  v_member     record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_room_id is null then
    raise exception 'room id required' using errcode = '22023';
  end if;
  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_bucket := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI');

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = p_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'goal_changed:' || p_room_id::text || ':' || v_bucket
                || ':' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_actor, p_room_id, 'goal_changed', v_dedupe,
      'Project goal updated',
      v_actor_name || ' changed the target or end date.',
      'Manage project',
      '/manage-project', null, '/manage-project',
      false,
      jsonb_build_object('actor_name', v_actor_name),
      'rooms', p_room_id
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_goal_changed(uuid) from public;
grant execute on function public.notify_goal_changed(uuid) to authenticated;

-- ── notify_room_joined ─────────────────────────────────────────
-- Called by the joiner AFTER their `room_members` row is inserted.
-- Every existing member should receive a notification.
create or replace function public.notify_room_joined(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_actor_name text;
  v_dedupe     text;
  v_room_name  text;
  v_member     record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_room_id is null then
    raise exception 'room id required' using errcode = '22023';
  end if;
  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  select r.name into v_room_name from public.rooms r where r.id = p_room_id;

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = p_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'room_joined:' || p_room_id::text || ':' || v_actor::text
                || ':' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_actor, p_room_id, 'room_joined', v_dedupe,
      'Partner joined',
      v_actor_name || ' joined ' || coalesce(v_room_name, 'the project') || '.',
      'Manage project',
      '/manage-project', null, '/dashboard',
      false,
      jsonb_build_object('actor_name', v_actor_name, 'room_name', v_room_name),
      'rooms', p_room_id
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_room_joined(uuid) from public;
grant execute on function public.notify_room_joined(uuid) to authenticated;

-- ── notify_room_left ───────────────────────────────────────────
-- Called by the leaver BEFORE their `room_members` row is deleted
-- so the loop can still see them as a member (the WHERE clause
-- filters them out via `user_id <> v_actor`).
create or replace function public.notify_room_left(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_actor_name text;
  v_dedupe     text;
  v_room_name  text;
  v_member     record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_room_id is null then
    raise exception 'room id required' using errcode = '22023';
  end if;
  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  select r.name into v_room_name from public.rooms r where r.id = p_room_id;

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = p_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'room_left:' || p_room_id::text || ':' || v_actor::text
                || ':' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_actor, p_room_id, 'room_left', v_dedupe,
      'Partner left',
      v_actor_name || ' left ' || coalesce(v_room_name, 'the project') || '.',
      'Manage project',
      '/manage-project', null, '/dashboard',
      false,
      jsonb_build_object('actor_name', v_actor_name, 'room_name', v_room_name),
      'rooms', p_room_id
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_room_left(uuid) from public;
grant execute on function public.notify_room_left(uuid) to authenticated;

-- ── notify_bucket_added ────────────────────────────────────────
create or replace function public.notify_bucket_added(p_bucket_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor       uuid := auth.uid();
  v_bucket_user uuid;
  v_room_id     uuid;
  v_bucket_name text;
  v_actor_name  text;
  v_dedupe      text;
  v_member      record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_bucket_id is null then
    raise exception 'bucket id required' using errcode = '22023';
  end if;

  select b.user_id, b.room_id, b.name
    into v_bucket_user, v_room_id, v_bucket_name
  from public.buckets b
  where b.id = p_bucket_id;

  if v_bucket_user is null then
    raise exception 'bucket not found' using errcode = 'P0002';
  end if;
  if v_bucket_user <> v_actor then
    raise exception 'cannot notify on another user bucket' using errcode = '42501';
  end if;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_actor_name := public._actor_display_name(v_actor);

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'bucket_added:' || p_bucket_id::text || ':' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_actor, v_room_id, 'bucket_added', v_dedupe,
      'Bucket added',
      v_actor_name || ' added ' || coalesce(nullif(btrim(v_bucket_name), ''), 'a bucket') || '.',
      'View buckets',
      '/dashboard?section=buckets', null, '/dashboard',
      false,
      jsonb_build_object(
        'actor_name', v_actor_name,
        'bucket_id', p_bucket_id,
        'bucket_name', v_bucket_name
      ),
      'buckets', p_bucket_id
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_bucket_added(uuid) from public;
grant execute on function public.notify_bucket_added(uuid) to authenticated;

-- ── notify_bucket_updated ──────────────────────────────────────
create or replace function public.notify_bucket_updated(p_bucket_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor       uuid := auth.uid();
  v_bucket_user uuid;
  v_room_id     uuid;
  v_bucket_name text;
  v_actor_name  text;
  v_minute      text;
  v_dedupe      text;
  v_member      record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_bucket_id is null then
    raise exception 'bucket id required' using errcode = '22023';
  end if;

  select b.user_id, b.room_id, b.name
    into v_bucket_user, v_room_id, v_bucket_name
  from public.buckets b
  where b.id = p_bucket_id;

  if v_bucket_user is null then
    raise exception 'bucket not found' using errcode = 'P0002';
  end if;
  if v_bucket_user <> v_actor then
    raise exception 'cannot notify on another user bucket' using errcode = '42501';
  end if;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_minute := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI');

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'bucket_updated:' || p_bucket_id::text || ':' || v_minute
                || ':' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_actor, v_room_id, 'bucket_updated', v_dedupe,
      'Bucket updated',
      v_actor_name || ' updated ' || coalesce(nullif(btrim(v_bucket_name), ''), 'a bucket') || '.',
      'View buckets',
      '/dashboard?section=buckets', null, '/dashboard',
      false,
      jsonb_build_object(
        'actor_name', v_actor_name,
        'bucket_id', p_bucket_id,
        'bucket_name', v_bucket_name
      ),
      'buckets', p_bucket_id
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_bucket_updated(uuid) from public;
grant execute on function public.notify_bucket_updated(uuid) to authenticated;

-- ── _smart_check_goal_reached: fan out over every member ───────
-- Previous body (0043) inserted one row for the depositor and one for
-- the single resolved partner. Replace with a single loop over every
-- current room member (depositor INCLUDED — they still get their own
-- `goal_reached` exactly as today, since the loop has no
-- `user_id <> actor` filter). Per-recipient dedupe keeps retries
-- idempotent. Strict-crossing logic and the recency gate in the
-- caller (`evaluate_smart_events_after_deposit`) are unchanged.
create or replace function public._smart_check_goal_reached(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_user       uuid;
  v_room_id        uuid;
  v_amount         numeric;
  v_log_created_at timestamptz;
  v_target         numeric;
  v_prev_total     numeric;
  v_new_total      numeric;
  v_dedupe         text;
  v_member         record;
begin
  select s.user_id, s.room_id, s.amount, s.created_at
    into v_log_user, v_room_id, v_amount, v_log_created_at
  from public.savings_logs s
  where s.id = p_log_id;

  if v_amount is null or v_amount <= 0 then
    return;
  end if;

  select g.target_amount into v_target
  from public.goals g
  where g.user_id = v_log_user and g.room_id = v_room_id;

  if v_target is null or v_target <= 0 then
    return;
  end if;

  -- Combined room total just before this log landed.
  select coalesce(sum(amount), 0)::numeric into v_prev_total
  from public.savings_logs
  where room_id = v_room_id
    and id <> p_log_id
    and created_at <= v_log_created_at;

  v_new_total := v_prev_total + v_amount;

  -- Strict crossing only.
  if v_prev_total >= v_target then
    return;
  end if;
  if v_new_total < v_target then
    return;
  end if;

  -- Fan out to every current room member (the depositor included).
  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_room_id
  loop
    v_dedupe := 'goal_reached:' || v_room_id::text || ':' || v_target::text
                || ':' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_log_user, v_room_id, 'goal_reached', v_dedupe,
      'Goal reached',
      'The project hit its savings target.',
      'View dashboard',
      '/dashboard', null, '/dashboard',
      false,
      jsonb_build_object('target_amount', v_target),
      'rooms', v_room_id
    );
  end loop;
end;
$$;

revoke all on function public._smart_check_goal_reached(uuid) from public;
revoke all on function public._smart_check_goal_reached(uuid) from authenticated;

-- ── _smart_check_overtaking: NOT TOUCHED ───────────────────────
-- Intentionally left exactly as migration 0043 left it. Today's
-- 2-user crossing behaviour is preserved by definition. The
-- N-player crossing question (who counts as "overtaken", which
-- recipients are notified, how to dedupe across multiple crossings
-- in one deposit) is a product decision deferred to a follow-up
-- task scheduled alongside the eventual cap raise.

commit;
