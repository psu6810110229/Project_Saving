-- ============================================================
-- 0041_partner_activity_prefs_and_buckets.sql
-- Task 23.4 audit follow-up.
--
-- Two fixes:
--
-- 1. Partner-activity notification creation now respects the
--    recipient's notification_preferences. The shared
--    `_insert_partner_notification` helper short-circuits to NULL
--    when the recipient has either master_enabled = false or
--    partner_activity_enabled = false. Missing preference rows
--    follow the defaults from 0037 (master=true,
--    partner_activity=true) so a user who has not opened the
--    settings page still receives partner-activity items.
--
--    The nudge path (`send-nudge` edge function) and the saving
--    reminder path (`enqueue_saving_plan_reminders`) use their
--    own preference gates and are NOT affected by this change.
--
-- 2. Adds bucket event coverage:
--      notify_bucket_added(p_bucket_id uuid)
--      notify_bucket_updated(p_bucket_id uuid)
--    Both validate the caller owns the bucket, find the partner,
--    derive safe copy, and dedupe.
-- ============================================================

begin;

-- ── update shared helper to gate by recipient preferences ──────
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
  v_id        uuid;
  v_master    boolean;
  v_partner   boolean;
begin
  -- Gate by the recipient's preferences. When the preferences row
  -- is missing we fall through to the 0037 defaults — both flags
  -- default to true, so the partner-activity notification proceeds.
  select prefs.master_enabled, prefs.partner_activity_enabled
    into v_master, v_partner
  from public.notification_preferences prefs
  where prefs.user_id = p_recipient_user_id;

  if v_master is not null and v_master = false then
    return null;
  end if;
  if v_partner is not null and v_partner = false then
    return null;
  end if;

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

-- ── notify_bucket_added ─────────────────────────────────────────
-- Called after a new bucket row is inserted. Copy is the bucket
-- name only — no amount, no goal target, matching the plan's
-- privacy notes for partner-facing bucket events.
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
  v_recipient   uuid;
  v_actor_name  text;
  v_dedupe      text;
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

  v_recipient := public._other_room_member(v_room_id, v_actor);
  if v_recipient is null then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_dedupe := 'bucket_added:' || p_bucket_id::text || ':' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, v_room_id, 'bucket_added', v_dedupe,
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
end;
$$;

revoke all on function public.notify_bucket_added(uuid) from public;
grant execute on function public.notify_bucket_added(uuid) to authenticated;

-- ── notify_bucket_updated ───────────────────────────────────────
-- Called after a bucket's name / target / category changes.
-- Dedupes per Bangkok minute so a rapid double-save collapses to
-- one notification while a genuine later edit still creates a new
-- row. Aligns with the goal_changed dedupe strategy from 0040.
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
  v_recipient   uuid;
  v_actor_name  text;
  v_minute      text;
  v_dedupe      text;
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

  v_recipient := public._other_room_member(v_room_id, v_actor);
  if v_recipient is null then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_minute := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI');
  v_dedupe := 'bucket_updated:' || p_bucket_id::text || ':' || v_minute || ':' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, v_room_id, 'bucket_updated', v_dedupe,
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
end;
$$;

revoke all on function public.notify_bucket_updated(uuid) from public;
grant execute on function public.notify_bucket_updated(uuid) to authenticated;

commit;
