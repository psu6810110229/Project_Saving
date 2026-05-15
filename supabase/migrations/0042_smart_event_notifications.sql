-- ============================================================
-- 0042_smart_event_notifications.sql
-- Task 23.5 — Smart event notifications.
--
-- Adds a single public entry RPC the deposit flow calls after each
-- successful `savings_logs` insert:
--
--   evaluate_smart_events_after_deposit(p_log_id uuid)
--
-- The entry validates auth.uid() owns the log + room membership,
-- then runs four independent threshold checks inside a savepoint
-- each so a single check failure cannot block the others or the
-- caller. Each check inserts at most one notification via the
-- shared `_insert_partner_notification` helper, so all four
-- categories inherit the recipient-preference gate added in
-- migration 0041 (master_enabled + partner_activity_enabled).
--
-- Checks:
--   * bucket_goal_reached — bucket's logs sum >= bucket target.
--                           Recipient = bucket owner (the actor).
--                           Dedupe `bucket_goal:{bucket_id}:{recipient}`
--                           (once per bucket target crossing).
--   * overtaking          — actor was behind/tied before this
--                           deposit and ahead after.
--                           Recipient = the partner (the one being
--                           overtaken). The actor is NOT notified.
--                           Dedupe `overtaking:{room_id}:{leader}:{bkk_date}:{recipient}`
--                           (once per leader per Bangkok day).
--   * streak_milestone    — consecutive Bangkok-day deposit streak
--                           for the actor in this room hits one of
--                           7 / 14 / 30 / 60 / 90 / 180 / 365.
--                           Recipient = the actor. Dedupe
--                           `streak:{user}:{room}:{count}` so each
--                           milestone count fires at most once.
--   * goal_reached        — total room deposits (both members)
--                           crossed the shared room target with
--                           this log. Both members are notified.
--                           Dedupe `goal_reached:{room_id}:{target}:{recipient}`
--                           so a later upward target change can
--                           fire again.
--
-- All notifications carry non-empty target/fallback routes per the
-- 23.1 CHECK constraints, use safe positive copy, and never expose
-- private reconcile/storage details.
-- ============================================================

begin;

-- ── private check: bucket_goal_reached ──────────────────────────
create or replace function public._smart_check_bucket_goal(p_log_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_user    uuid;
  v_room_id     uuid;
  v_bucket_id   uuid;
  v_bucket_name text;
  v_target      numeric;
  v_total       numeric;
  v_dedupe      text;
begin
  select s.user_id, s.room_id, s.bucket_id
    into v_log_user, v_room_id, v_bucket_id
  from public.savings_logs s
  where s.id = p_log_id;

  if v_bucket_id is null then
    return null;
  end if;

  select b.name, b.target_amount
    into v_bucket_name, v_target
  from public.buckets b
  where b.id = v_bucket_id;

  if v_target is null or v_target <= 0 then
    return null;
  end if;

  select coalesce(sum(amount), 0)::numeric into v_total
  from public.savings_logs
  where bucket_id = v_bucket_id
    and user_id = v_log_user;

  if v_total < v_target then
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

-- ── private check: overtaking ───────────────────────────────────
create or replace function public._smart_check_overtaking(p_log_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_user      uuid;
  v_room_id       uuid;
  v_amount        numeric;
  v_partner       uuid;
  v_actor_total   numeric;
  v_partner_total numeric;
  v_actor_name    text;
  v_today         text;
  v_dedupe        text;
begin
  select s.user_id, s.room_id, s.amount
    into v_log_user, v_room_id, v_amount
  from public.savings_logs s
  where s.id = p_log_id;

  if v_amount is null or v_amount <= 0 then
    return null;
  end if;

  v_partner := public._other_room_member(v_room_id, v_log_user);
  if v_partner is null then
    return null;
  end if;

  select coalesce(sum(amount), 0)::numeric into v_actor_total
  from public.savings_logs
  where user_id = v_log_user and room_id = v_room_id;

  select coalesce(sum(amount), 0)::numeric into v_partner_total
  from public.savings_logs
  where user_id = v_partner and room_id = v_room_id;

  -- Was the actor behind/tied before this deposit and ahead after?
  if (v_actor_total - v_amount) > v_partner_total then
    return null;
  end if;
  if v_actor_total <= v_partner_total then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_log_user);
  v_today := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD');
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

-- ── private check: streak_milestone ─────────────────────────────
-- Counts consecutive Bangkok-day deposits ending at today. If the
-- run length is one of the allow-listed milestones, fires once
-- (via dedupe).
create or replace function public._smart_check_streak(p_log_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_user uuid;
  v_room_id  uuid;
  v_today    date := (now() at time zone 'Asia/Bangkok')::date;
  v_days     date[];
  v_cursor   date;
  v_streak   int;
  v_dedupe   text;
  c_milestones constant int[] := array[7, 14, 30, 60, 90, 180, 365];
begin
  select s.user_id, s.room_id into v_log_user, v_room_id
  from public.savings_logs s
  where s.id = p_log_id;

  select array_agg(d order by d desc) into v_days
  from (
    select distinct (s.created_at at time zone 'Asia/Bangkok')::date as d
    from public.savings_logs s
    where s.user_id = v_log_user
      and s.room_id = v_room_id
      and (s.created_at at time zone 'Asia/Bangkok')::date <= v_today
  ) sub;

  if v_days is null or array_length(v_days, 1) = 0 then
    return null;
  end if;

  -- Start cursor at today; if no deposit today, try yesterday.
  v_cursor := v_today;
  if not (v_cursor = any(v_days)) then
    v_cursor := v_today - 1;
    if not (v_cursor = any(v_days)) then
      return null;
    end if;
  end if;

  v_streak := 0;
  while v_cursor = any(v_days) loop
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  if not (v_streak = any(c_milestones)) then
    return null;
  end if;

  v_dedupe := 'streak:' || v_log_user::text || ':' || v_room_id::text || ':' || v_streak::text;

  return public._insert_partner_notification(
    v_log_user, v_log_user, v_room_id, 'streak_milestone', v_dedupe,
    'Savings streak',
    v_streak::text || ' saving days have been recorded.',
    'View progress',
    '/dashboard', 'progress', '/dashboard',
    false,
    jsonb_build_object('streak', v_streak),
    'savings_logs', p_log_id
  );
end;
$$;

revoke all on function public._smart_check_streak(uuid) from public;
revoke all on function public._smart_check_streak(uuid) from authenticated;

-- ── private check: goal_reached ─────────────────────────────────
-- Project-level shared goal. Both members are notified once when
-- the combined room total crosses the actor's goal target. The
-- shared goal RPC `update_room_goal` keeps both members' goal rows
-- in sync, so the actor's target reads as the room's shared target.
create or replace function public._smart_check_goal_reached(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_user    uuid;
  v_room_id     uuid;
  v_amount      numeric;
  v_target      numeric;
  v_total_after numeric;
  v_partner     uuid;
  v_dedupe      text;
begin
  select s.user_id, s.room_id, s.amount
    into v_log_user, v_room_id, v_amount
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

  select coalesce(sum(s.amount), 0)::numeric into v_total_after
  from public.savings_logs s
  where s.room_id = v_room_id;

  -- Must have crossed: now >= target AND was below target before
  -- this deposit landed.
  if v_total_after < v_target then
    return;
  end if;
  if (v_total_after - v_amount) >= v_target then
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

-- ── public entry RPC ────────────────────────────────────────────
-- Each check runs inside its own BEGIN/EXCEPTION block so a single
-- check raising does not break the others or the deposit flow.
create or replace function public.evaluate_smart_events_after_deposit(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    uuid := auth.uid();
  v_log_user uuid;
  v_room_id  uuid;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_log_id is null then
    return;
  end if;

  select s.user_id, s.room_id into v_log_user, v_room_id
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
