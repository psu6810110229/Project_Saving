-- 0049_goal_change_request_notification.sql
--
-- P1-002: Project-goal management now lives on the Dashboard. Only the
-- room creator can edit the goal directly; the partner can send a
-- goal-change request. This migration adds the partner-side helper
-- that emits an in-app notification to the room creator so the
-- request lands in their Notification Center.
--
-- The companion read-side is the `goal_change_request` event_key
-- handled by `src/i18n/notificationCopy.ts`. There is no separate
-- table or push delivery for this event; it reuses the existing
-- `notifications` table and the `_insert_partner_notification`
-- helper introduced in 0040.

create or replace function public.notify_goal_change_request(
  p_room_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_creator    uuid;
  v_actor_name text;
  v_dedupe     text;
  v_bucket     text;
  v_message    text;
  v_body       text;
  v_payload    jsonb;
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

  select r.created_by into v_creator from public.rooms r where r.id = p_room_id;
  if v_creator is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  -- Only a non-creator partner is allowed to send the request. The
  -- creator already has direct edit access, so a self-request would
  -- be a no-op.
  if v_creator = v_actor then
    raise exception 'creator cannot request goal change' using errcode = '42501';
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_message := nullif(btrim(coalesce(p_message, '')), '');
  v_body := case
    when v_message is null then v_actor_name || ' is asking to change the project goal.'
    else v_actor_name || ' is asking to change the project goal: "' || v_message || '"'
  end;
  -- Dedupe per-minute so a rapid double-send collapses to one row but
  -- a later, distinct request still creates a new notification.
  v_bucket := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI');
  v_dedupe := 'goal_change_request:' || p_room_id::text || ':' || v_actor::text || ':' || v_bucket;
  v_payload := jsonb_build_object(
    'actor_name', v_actor_name,
    'message', v_message
  );

  return public._insert_partner_notification(
    v_creator, v_actor, p_room_id, 'goal_change_request', v_dedupe,
    'Goal change requested',
    v_body,
    'Open dashboard',
    '/dashboard', null, '/dashboard',
    false,
    v_payload,
    'rooms', p_room_id
  );
end;
$$;

revoke all on function public.notify_goal_change_request(uuid, text) from public;
grant execute on function public.notify_goal_change_request(uuid, text) to authenticated;
