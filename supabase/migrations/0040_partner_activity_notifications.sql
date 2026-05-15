-- ============================================================
-- 0040_partner_activity_notifications.sql
-- Task 23.4 — Partner activity notifications.
--
-- Adds security-definer RPCs for partner-facing notifications that
-- existing flows can call AFTER their core action succeeds:
--
--   notify_partner_deposit(p_log_id uuid)
--   notify_balance_checked(p_checkpoint_id uuid)
--   notify_plan_created(p_revision_id uuid)
--   notify_plan_changed(p_revision_id uuid)
--   notify_plan_paused(p_pause_id uuid)
--   notify_plan_resumed(p_pause_id uuid)
--   notify_goal_changed(p_room_id uuid)
--   notify_room_joined(p_room_id uuid)
--   notify_room_left(p_room_id uuid)
--
-- Each RPC:
--   * validates auth.uid() is the legitimate actor (owner of the
--     source row, or a current room member for room events),
--   * validates source row exists and belongs to a room that the
--     caller is a member of,
--   * resolves the partner (the other current room member); if
--     none exists, returns null silently so a one-person room
--     never produces broken notifications,
--   * derives all copy / payload server-side from the source row
--     (the client never supplies title/body),
--   * inserts via ON CONFLICT (recipient_user_id, dedupe_key) DO
--     NOTHING so retries from the client are idempotent.
--
-- Privacy:
--   * balance_checked NEVER includes balance_checkpoints.note,
--     storage item labels, or ledger amounts — only the actor's
--     display name and the bare event.
--   * partner_deposited can include amount + bucket name because
--     that information already appears on the Dashboard activity
--     feed (matches the existing visibility contract).
--   * room/goal/plan events use generic copy and do not leak
--     private fields.
--
-- All targets and fallback routes are filled in, satisfying the
-- non-empty CHECK constraints from migration 0037.
--
-- This migration is the partner-activity counterpart to the
-- `send-nudge` (Task 23.2) and `enqueue_saving_plan_reminders`
-- (Task 23.3) event sources.
-- ============================================================

begin;

-- ── private helper: resolve "the other current room member" ─────
-- Returns the single partner user id for a 2-person room, or
-- NULL if there is no other member yet. Restricting to one row
-- via LIMIT 1 keeps the helper safe even if a future migration
-- relaxes the 2-player cap.
create or replace function public._other_room_member(
  p_room_id uuid,
  p_actor_user_id uuid
)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select rm.user_id
    from public.room_members rm
   where rm.room_id = p_room_id
     and rm.user_id <> p_actor_user_id
   order by rm.joined_at asc
   limit 1;
$$;

revoke all on function public._other_room_member(uuid, uuid) from public;
revoke all on function public._other_room_member(uuid, uuid) from authenticated;

-- ── private helper: actor display name ──────────────────────────
create or replace function public._actor_display_name(p_user_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(nullif(btrim(p.display_name), ''), 'Your partner')
    from public.profiles p
   where p.id = p_user_id;
$$;

revoke all on function public._actor_display_name(uuid) from public;
revoke all on function public._actor_display_name(uuid) from authenticated;

-- ── private helper: insert notification row ─────────────────────
-- Wraps the ON CONFLICT DO NOTHING insert so each notify_* RPC
-- stays small. Returns the inserted id, or NULL when the dedupe
-- key already exists.
create or replace function public._insert_partner_notification(
  p_recipient_user_id uuid,
  p_actor_user_id uuid,
  p_room_id uuid,
  p_event_key text,
  p_dedupe_key text,
  p_title text,
  p_body text,
  p_cta_label text,
  p_target_route text,
  p_target_section text,
  p_fallback_route text,
  p_push_safe boolean,
  p_payload jsonb,
  p_source_table text,
  p_source_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (
    recipient_user_id, actor_user_id, room_id, event_key,
    category, channel_policy,
    title, body, cta_label,
    target_route, target_section, fallback_route, push_safe,
    payload, source_table, source_id, dedupe_key
  )
  values (
    p_recipient_user_id, p_actor_user_id, p_room_id, p_event_key,
    'partner_activity', 'in_app',
    p_title, p_body, p_cta_label,
    p_target_route, p_target_section, p_fallback_route, p_push_safe,
    coalesce(p_payload, '{}'::jsonb), p_source_table, p_source_id, p_dedupe_key
  )
  on conflict (recipient_user_id, dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public._insert_partner_notification(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, boolean, jsonb, text, uuid
) from public;
revoke all on function public._insert_partner_notification(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, boolean, jsonb, text, uuid
) from authenticated;

-- ── notify_partner_deposit ──────────────────────────────────────
-- Called by the deposit flow after `savings_logs` insert succeeds.
-- The caller must own the log row. Recipient sees amount + bucket
-- name, matching the existing Dashboard activity feed visibility.
create or replace function public.notify_partner_deposit(p_log_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_log_user   uuid;
  v_room_id    uuid;
  v_amount     numeric;
  v_bucket_id  uuid;
  v_bucket_name text;
  v_recipient  uuid;
  v_actor_name text;
  v_title      text;
  v_body       text;
  v_payload    jsonb;
  v_dedupe     text;
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

  v_recipient := public._other_room_member(v_room_id, v_actor);
  if v_recipient is null then
    return null;
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
  v_dedupe := 'deposit:' || p_log_id::text || ':' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, v_room_id, 'partner_deposited', v_dedupe,
    v_title, v_body, 'View activity',
    '/dashboard', 'activity', '/dashboard',
    false,
    v_payload, 'savings_logs', p_log_id
  );
end;
$$;

revoke all on function public.notify_partner_deposit(uuid) from public;
grant execute on function public.notify_partner_deposit(uuid) to authenticated;

-- ── notify_balance_checked ──────────────────────────────────────
-- Called after `create_balance_checkpoint` succeeds. Copy is
-- intentionally sanitized: no note, no storage items, no ledger
-- amounts — only the actor name and the fact that a check
-- happened.
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
  v_recipient   uuid;
  v_actor_name  text;
  v_dedupe      text;
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

  v_recipient := public._other_room_member(v_room_id, v_actor);
  if v_recipient is null then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_dedupe := 'balance_check:' || p_checkpoint_id::text || ':' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, v_room_id, 'balance_checked', v_dedupe,
    v_actor_name || ' checked balance',
    'The latest balance check is available in activity.',
    'View activity',
    '/dashboard', 'activity', '/dashboard',
    false,
    jsonb_build_object('actor_name', v_actor_name, 'checkpoint_id', p_checkpoint_id),
    'balance_checkpoints', p_checkpoint_id
  );
end;
$$;

revoke all on function public.notify_balance_checked(uuid) from public;
grant execute on function public.notify_balance_checked(uuid) to authenticated;

-- ── notify_plan_created ─────────────────────────────────────────
-- Called after `create_saving_plan` succeeds. Receives the FIRST
-- revision id because that is what the client gets back.
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
  v_recipient  uuid;
  v_actor_name text;
  v_dedupe     text;
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

  v_recipient := public._other_room_member(v_room_id, v_actor);
  if v_recipient is null then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_dedupe := 'plan_created:' || v_plan_id::text || ':' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, v_room_id, 'plan_created', v_dedupe,
    'Saving plan started',
    v_actor_name || ' set up a saving plan for this project.',
    'View plan',
    '/saving-plan', null, '/saving-plan',
    false,
    jsonb_build_object('plan_id', v_plan_id, 'actor_name', v_actor_name),
    'saving_plans', v_plan_id
  );
end;
$$;

revoke all on function public.notify_plan_created(uuid) from public;
grant execute on function public.notify_plan_created(uuid) to authenticated;

-- ── notify_plan_changed ─────────────────────────────────────────
-- Called after `change_saving_plan` returns the new revision id.
-- Copy stays generic ("plan details were updated") so partner
-- doesn't see amounts they don't already see elsewhere.
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
  v_recipient  uuid;
  v_actor_name text;
  v_dedupe     text;
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

  v_recipient := public._other_room_member(v_room_id, v_actor);
  if v_recipient is null then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_dedupe := 'plan_revision:' || p_revision_id::text || ':' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, v_room_id, 'plan_changed', v_dedupe,
    'Saving plan updated',
    v_actor_name || ' updated their saving plan details.',
    'View plan',
    '/saving-plan', null, '/saving-plan',
    false,
    jsonb_build_object('plan_id', v_plan_id, 'revision_id', p_revision_id, 'actor_name', v_actor_name),
    'saving_plan_revisions', p_revision_id
  );
end;
$$;

revoke all on function public.notify_plan_changed(uuid) from public;
grant execute on function public.notify_plan_changed(uuid) to authenticated;

-- ── notify_plan_paused ──────────────────────────────────────────
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
  v_recipient  uuid;
  v_actor_name text;
  v_dedupe     text;
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

  v_recipient := public._other_room_member(v_room_id, v_actor);
  if v_recipient is null then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_dedupe := 'plan_pause:' || p_pause_id::text || ':paused:' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, v_room_id, 'plan_paused', v_dedupe,
    'Saving plan paused',
    v_actor_name || ' paused their saving plan.',
    'View plan',
    '/saving-plan', null, '/saving-plan',
    false,
    jsonb_build_object('plan_id', v_plan_id, 'pause_id', p_pause_id, 'actor_name', v_actor_name),
    'saving_plan_pauses', p_pause_id
  );
end;
$$;

revoke all on function public.notify_plan_paused(uuid) from public;
grant execute on function public.notify_plan_paused(uuid) to authenticated;

-- ── notify_plan_resumed ─────────────────────────────────────────
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
  v_recipient  uuid;
  v_actor_name text;
  v_dedupe     text;
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

  v_recipient := public._other_room_member(v_room_id, v_actor);
  if v_recipient is null then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_dedupe := 'plan_pause:' || p_pause_id::text || ':resumed:' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, v_room_id, 'plan_resumed', v_dedupe,
    'Saving plan resumed',
    v_actor_name || ' resumed their saving plan.',
    'View plan',
    '/saving-plan', null, '/saving-plan',
    false,
    jsonb_build_object('plan_id', v_plan_id, 'pause_id', p_pause_id, 'actor_name', v_actor_name),
    'saving_plan_pauses', p_pause_id
  );
end;
$$;

revoke all on function public.notify_plan_resumed(uuid) from public;
grant execute on function public.notify_plan_resumed(uuid) to authenticated;

-- ── notify_goal_changed ─────────────────────────────────────────
-- Called after `update_room_goal` succeeds. Dedupes per-minute so
-- a rapid double-save collapses to one notification while genuine
-- later edits still create new rows.
create or replace function public.notify_goal_changed(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_recipient  uuid;
  v_actor_name text;
  v_dedupe     text;
  v_bucket     text;
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

  v_recipient := public._other_room_member(p_room_id, v_actor);
  if v_recipient is null then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_bucket := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI');
  v_dedupe := 'goal_changed:' || p_room_id::text || ':' || v_bucket || ':' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, p_room_id, 'goal_changed', v_dedupe,
    'Project goal updated',
    v_actor_name || ' changed the target or end date.',
    'Manage project',
    '/manage-project', null, '/manage-project',
    false,
    jsonb_build_object('actor_name', v_actor_name),
    'rooms', p_room_id
  );
end;
$$;

revoke all on function public.notify_goal_changed(uuid) from public;
grant execute on function public.notify_goal_changed(uuid) to authenticated;

-- ── notify_room_joined ──────────────────────────────────────────
-- Called by the joiner AFTER `join_room_by_code` succeeds. Actor =
-- the joiner; recipient = the existing member (room creator). The
-- joiner must already be a member by the time this is called.
create or replace function public.notify_room_joined(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_recipient  uuid;
  v_actor_name text;
  v_dedupe     text;
  v_room_name  text;
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

  v_recipient := public._other_room_member(p_room_id, v_actor);
  if v_recipient is null then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  select r.name into v_room_name from public.rooms r where r.id = p_room_id;
  v_dedupe := 'room_joined:' || p_room_id::text || ':' || v_actor::text || ':' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, p_room_id, 'room_joined', v_dedupe,
    'Partner joined',
    v_actor_name || ' joined ' || coalesce(v_room_name, 'the project') || '.',
    'Manage project',
    '/manage-project', null, '/dashboard',
    false,
    jsonb_build_object('actor_name', v_actor_name, 'room_name', v_room_name),
    'rooms', p_room_id
  );
end;
$$;

revoke all on function public.notify_room_joined(uuid) from public;
grant execute on function public.notify_room_joined(uuid) to authenticated;

-- ── notify_room_left ────────────────────────────────────────────
-- Called by the leaver BEFORE the `room_members` row is deleted.
-- The leaver must still be a member at the time of the call, so
-- _other_room_member() can resolve the recipient.
create or replace function public.notify_room_left(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_recipient  uuid;
  v_actor_name text;
  v_dedupe     text;
  v_room_name  text;
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

  v_recipient := public._other_room_member(p_room_id, v_actor);
  if v_recipient is null then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  select r.name into v_room_name from public.rooms r where r.id = p_room_id;
  v_dedupe := 'room_left:' || p_room_id::text || ':' || v_actor::text || ':' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, p_room_id, 'room_left', v_dedupe,
    'Partner left',
    v_actor_name || ' left ' || coalesce(v_room_name, 'the project') || '.',
    'Manage project',
    '/manage-project', null, '/dashboard',
    false,
    jsonb_build_object('actor_name', v_actor_name, 'room_name', v_room_name),
    'rooms', p_room_id
  );
end;
$$;

revoke all on function public.notify_room_left(uuid) from public;
grant execute on function public.notify_room_left(uuid) to authenticated;

commit;
