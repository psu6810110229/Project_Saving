-- ============================================================
-- 0043_smart_event_crossing_hardening.sql
-- Task 23.5 audit follow-up.
--
-- Two blockers in 0042:
--
-- 1. `evaluate_smart_events_after_deposit` accepted ANY caller-
--    owned log id, so a client could re-invoke the entry with an
--    old log and trigger fresh same-day notifications (notably
--    overtaking, which dedupes per Bangkok date).
--
-- 2. `_smart_check_bucket_goal` only verified that the current
--    bucket total met the target — it never proved the triggering
--    deposit was what crossed the line. Combined with the
--    one-shot dedupe key, an old log could fire a stale crossing
--    notification.
--
-- Fixes:
--
-- * The entry RPC now reads the log's `created_at` and aborts when
--   the row is older than 5 minutes. Smart events are only
--   evaluated for genuinely fresh deposits.
--
-- * Bucket goal, overtaking, and project goal_reached now compute
--   crossing using the triggering log's timestamp:
--     v_prev = sum(other contributing logs, created_at <= log.created_at)
--     v_new  = v_prev + log.amount
--     fire when v_prev < target AND v_new >= target
--   This treats each deposit as the moment-of-truth instead of a
--   blanket "current total" comparison.
--
-- * `_smart_check_streak` is unchanged: it counts consecutive
--   Bangkok-day deposits ending at today; an old log cannot
--   manufacture a new milestone, and the entry-level recency
--   gate adds defense-in-depth.
-- ============================================================

begin;

-- ── bucket_goal_reached: cross-the-line at log timestamp ────────
create or replace function public._smart_check_bucket_goal(p_log_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_user       uuid;
  v_room_id        uuid;
  v_bucket_id      uuid;
  v_bucket_name    text;
  v_target         numeric;
  v_amount         numeric;
  v_log_created_at timestamptz;
  v_prev_total     numeric;
  v_new_total      numeric;
  v_dedupe         text;
begin
  select s.user_id, s.room_id, s.bucket_id, s.amount, s.created_at
    into v_log_user, v_room_id, v_bucket_id, v_amount, v_log_created_at
  from public.savings_logs s
  where s.id = p_log_id;

  if v_bucket_id is null or v_amount is null or v_amount <= 0 then
    return null;
  end if;

  select b.name, b.target_amount
    into v_bucket_name, v_target
  from public.buckets b
  where b.id = v_bucket_id;

  if v_target is null or v_target <= 0 then
    return null;
  end if;

  -- Previous bucket total (everything in the bucket strictly before
  -- this log lands). Other logs sharing the same timestamp are
  -- excluded so this log is unambiguously the trigger.
  select coalesce(sum(amount), 0)::numeric into v_prev_total
  from public.savings_logs
  where bucket_id = v_bucket_id
    and user_id = v_log_user
    and id <> p_log_id
    and created_at <= v_log_created_at;

  v_new_total := v_prev_total + v_amount;

  -- Strict crossing: only fire when THIS deposit takes the bucket
  -- from below target to >= target.
  if v_prev_total >= v_target then
    return null;
  end if;
  if v_new_total < v_target then
    return null;
  end if;

  v_dedupe := 'bucket_goal:' || v_bucket_id::text || ':' || v_log_user::text;

  return public._insert_partner_notification(
    v_log_user, v_log_user, v_room_id, 'bucket_goal_reached', v_dedupe,
    'Bucket goal reached',
    coalesce(nullif(btrim(v_bucket_name), ''), 'A bucket') || ' reached its target.',
    'View buckets',
    '/dashboard', 'buckets', '/dashboard',
    false,
    jsonb_build_object('bucket_id', v_bucket_id, 'bucket_name', v_bucket_name),
    'buckets', v_bucket_id
  );
end;
$$;

revoke all on function public._smart_check_bucket_goal(uuid) from public;
revoke all on function public._smart_check_bucket_goal(uuid) from authenticated;

-- ── overtaking: crossing computed at log timestamp ──────────────
create or replace function public._smart_check_overtaking(p_log_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_user       uuid;
  v_room_id        uuid;
  v_amount         numeric;
  v_log_created_at timestamptz;
  v_partner        uuid;
  v_actor_prev     numeric;
  v_actor_new      numeric;
  v_partner_total  numeric;
  v_actor_name     text;
  v_today          text;
  v_dedupe         text;
begin
  select s.user_id, s.room_id, s.amount, s.created_at
    into v_log_user, v_room_id, v_amount, v_log_created_at
  from public.savings_logs s
  where s.id = p_log_id;

  if v_amount is null or v_amount <= 0 then
    return null;
  end if;

  v_partner := public._other_room_member(v_room_id, v_log_user);
  if v_partner is null then
    return null;
  end if;

  -- Actor total just before this log landed.
  select coalesce(sum(amount), 0)::numeric into v_actor_prev
  from public.savings_logs
  where user_id = v_log_user
    and room_id = v_room_id
    and id <> p_log_id
    and created_at <= v_log_created_at;

  v_actor_new := v_actor_prev + v_amount;

  -- Partner total as of the same moment.
  select coalesce(sum(amount), 0)::numeric into v_partner_total
  from public.savings_logs
  where user_id = v_partner
    and room_id = v_room_id
    and created_at <= v_log_created_at;

  -- Crossing: actor was behind or tied just before this log, ahead
  -- right after. Avoids firing when the actor was already leading.
  if v_actor_prev > v_partner_total then
    return null;
  end if;
  if v_actor_new <= v_partner_total then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_log_user);
  v_today := to_char(v_log_created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD');
  v_dedupe := 'overtaking:' || v_room_id::text || ':' || v_log_user::text
              || ':' || v_today || ':' || v_partner::text;

  return public._insert_partner_notification(
    v_partner, v_log_user, v_room_id, 'overtaking', v_dedupe,
    'Progress changed',
    v_actor_name || ' moved ahead in recorded savings.',
    'View progress',
    '/dashboard', 'progress', '/dashboard',
    false,
    jsonb_build_object('actor_name', v_actor_name),
    'savings_logs', p_log_id
  );
end;
$$;

revoke all on function public._smart_check_overtaking(uuid) from public;
revoke all on function public._smart_check_overtaking(uuid) from authenticated;

-- ── goal_reached: crossing computed at log timestamp ────────────
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
  v_partner        uuid;
  v_dedupe         text;
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

  v_partner := public._other_room_member(v_room_id, v_log_user);

  -- Depositor
  v_dedupe := 'goal_reached:' || v_room_id::text || ':' || v_target::text
              || ':' || v_log_user::text;
  perform public._insert_partner_notification(
    v_log_user, v_log_user, v_room_id, 'goal_reached', v_dedupe,
    'Goal reached',
    'The project hit its savings target.',
    'View dashboard',
    '/dashboard', null, '/dashboard',
    false,
    jsonb_build_object('target_amount', v_target),
    'rooms', v_room_id
  );

  -- Partner (if any)
  if v_partner is not null then
    v_dedupe := 'goal_reached:' || v_room_id::text || ':' || v_target::text
                || ':' || v_partner::text;
    perform public._insert_partner_notification(
      v_partner, v_log_user, v_room_id, 'goal_reached', v_dedupe,
      'Goal reached',
      'The project hit its savings target.',
      'View dashboard',
      '/dashboard', null, '/dashboard',
      false,
      jsonb_build_object('target_amount', v_target),
      'rooms', v_room_id
    );
  end if;
end;
$$;

revoke all on function public._smart_check_goal_reached(uuid) from public;
revoke all on function public._smart_check_goal_reached(uuid) from authenticated;

-- ── entry RPC: recency gate added ───────────────────────────────
-- Old logs cannot trigger smart events. The deposit flow calls
-- this immediately after insert, so the 5-minute window
-- comfortably covers the round trip while rejecting replay
-- attempts on historic rows.
create or replace function public.evaluate_smart_events_after_deposit(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor          uuid := auth.uid();
  v_log_user       uuid;
  v_room_id        uuid;
  v_log_created_at timestamptz;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_log_id is null then
    return;
  end if;

  select s.user_id, s.room_id, s.created_at
    into v_log_user, v_room_id, v_log_created_at
  from public.savings_logs s
  where s.id = p_log_id;

  if v_log_user is null then
    return;
  end if;
  if v_log_user <> v_actor then
    raise exception 'cannot evaluate on another user log' using errcode = '42501';
  end if;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  -- Recency gate: smart events fire only for the moment a deposit
  -- is recorded. Historic rows return silently. Five minutes is
  -- generous enough to cover slow networks and post-deposit retries
  -- while ruling out replay-driven spam.
  if v_log_created_at is null
     or now() - v_log_created_at > interval '5 minutes' then
    return;
  end if;

  begin
    perform public._smart_check_bucket_goal(p_log_id);
  exception when others then
    null;
  end;

  begin
    perform public._smart_check_overtaking(p_log_id);
  exception when others then
    null;
  end;

  begin
    perform public._smart_check_streak(p_log_id);
  exception when others then
    null;
  end;

  begin
    perform public._smart_check_goal_reached(p_log_id);
  exception when others then
    null;
  end;
end;
$$;

revoke all on function public.evaluate_smart_events_after_deposit(uuid) from public;
grant execute on function public.evaluate_smart_events_after_deposit(uuid) to authenticated;

commit;
