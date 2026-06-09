-- ============================================================
-- 0090_pause_reminder_notification_hardening.sql
-- Sprint 9: notifications and reminders hardening.
--
-- Adds:
--   * pause-aware bucket-rule reminder candidates to the existing
--     scheduled reminder RPC, without removing the legacy saving-plan
--     candidate path.
--   * partner-visible bucket pause/resume notification RPCs whose
--     payloads expose status only: bucket id, bucket name, status,
--     and actor name. Raw pause/resume dates stay owner-only.
-- ============================================================

begin;

create or replace function public.enqueue_saving_plan_reminders()
returns table (
  notification_id  uuid,
  recipient_user_id uuid,
  plan_id          uuid,
  room_id          uuid,
  cadence          text,
  period_key       text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_bkk timestamp := (now() at time zone 'Asia/Bangkok');
  v_today   date       := v_now_bkk::date;
  v_hour    int        := extract(hour from v_now_bkk)::int;
  v_day     int        := extract(day from v_today)::int;
  v_week    text       := to_char(v_today, 'IYYY-"W"IW');
  v_month   text       := to_char(v_today, 'YYYY-MM');
begin
  -- Conservative time gate. Scheduler is expected to run hourly;
  -- nothing fires until 18:00 Bangkok local time.
  if v_hour < 18 then
    return;
  end if;

  return query
  with
    latest_revisions as (
      select distinct on (r.plan_id)
        r.plan_id,
        p.user_id,
        p.room_id,
        r.rule_type,
        r.end_date
      from public.saving_plan_revisions r
      join public.saving_plans p on p.id = r.plan_id
      where p.archived_at is null
        and r.effective_from_date <= v_today
        and r.rule_type in (
          'fixed_daily',
          'fixed_weekly',
          'fixed_monthly',
          'increasing_daily',
          'increasing_daily_capped'
        )
      order by r.plan_id, r.effective_from_date desc
    ),
    legacy_in_window_plans as (
      select lr.*
      from latest_revisions lr
      where lr.end_date is null or lr.end_date >= v_today
    ),
    legacy_not_paused_plans as (
      select iwp.*
      from legacy_in_window_plans iwp
      where not exists (
        select 1
        from public.saving_plan_pauses sp
        where sp.plan_id = iwp.plan_id
          and sp.paused_from <= v_today
          and (sp.resumed_from is null or sp.resumed_from > v_today)
      )
    ),
    legacy_eligible_recipients as (
      select np.*
      from legacy_not_paused_plans np
      left join public.notification_preferences prefs
        on prefs.user_id = np.user_id
      where coalesce(prefs.master_enabled, true)
        and coalesce(prefs.saving_reminders_enabled, true)
    ),
    legacy_candidates as (
      select
        er.plan_id,
        er.user_id,
        er.room_id,
        er.rule_type,
        case er.rule_type
          when 'fixed_weekly'  then 'weekly'
          when 'fixed_monthly' then 'monthly'
          else 'daily'
        end as cadence,
        case er.rule_type
          when 'fixed_weekly'  then v_week
          when 'fixed_monthly' then v_month
          else to_char(v_today, 'YYYY-MM-DD')
        end as period_key
      from legacy_eligible_recipients er
    ),
    legacy_no_recent_deposit as (
      select c.*
      from legacy_candidates c
      where not exists (
        select 1
        from public.savings_logs s
        where s.user_id = c.user_id
          and s.room_id = c.room_id
          and case c.cadence
                when 'weekly'  then to_char((s.created_at at time zone 'Asia/Bangkok')::date, 'IYYY-"W"IW') = c.period_key
                when 'monthly' then to_char((s.created_at at time zone 'Asia/Bangkok')::date, 'YYYY-MM') = c.period_key
                else (s.created_at at time zone 'Asia/Bangkok')::date = v_today
              end
      )
    ),
    inserted_legacy as (
      insert into public.notifications (
        recipient_user_id, actor_user_id, room_id, event_key, category,
        channel_policy, title, body, cta_label,
        target_route, target_section, fallback_route, push_safe,
        payload, source_table, source_id, dedupe_key
      )
      select
        nrd.user_id,
        null,
        nrd.room_id,
        'saving_reminder_due',
        'saving_reminder',
        'push_candidate',
        'Saving reminder',
        'Your plan is ready when you want to record today''s savings.',
        'View plan',
        '/saving-plan',
        null,
        '/saving-plan',
        true,
        jsonb_build_object(
          'plan_id',   nrd.plan_id,
          'rule_type', nrd.rule_type,
          'cadence',   nrd.cadence,
          'period',    nrd.period_key
        ),
        'saving_plans',
        nrd.plan_id,
        'saving_reminder:' || nrd.plan_id::text || ':' || nrd.cadence || ':' || nrd.period_key || ':' || nrd.user_id::text
      from legacy_no_recent_deposit nrd
      on conflict (recipient_user_id, dedupe_key) do nothing
      returning
        notifications.id,
        notifications.recipient_user_id,
        (notifications.payload ->> 'plan_id')::uuid,
        notifications.room_id,
        notifications.payload ->> 'cadence',
        notifications.payload ->> 'period'
    ),
    bucket_candidates as (
      select
        b.id as bucket_id,
        b.user_id,
        b.room_id,
        b.name as bucket_name,
        b.saving_rule_type as rule_type,
        case b.saving_rule_type
          when 'fixed_weekly'  then 'weekly'
          when 'fixed_monthly' then 'monthly'
          else 'daily'
        end as cadence,
        case b.saving_rule_type
          when 'fixed_weekly'  then v_week
          when 'fixed_monthly' then v_month
          else to_char(v_today, 'YYYY-MM-DD')
        end as period_key
      from public.buckets b
      left join public.notification_preferences prefs
        on prefs.user_id = b.user_id
      where b.archived_at is null
        and b.saving_rule_type in (
          'fixed_daily',
          'fixed_weekly',
          'fixed_monthly',
          'increasing_daily',
          'increasing_daily_capped'
        )
        and (b.deadline is null or b.deadline >= v_today)
        and (b.saving_rule_start_date is null or b.saving_rule_start_date <= v_today)
        and (
          b.saving_rule_type <> 'fixed_monthly'
          or b.reminder_day is null
          or b.reminder_day <= v_day
        )
        and coalesce(prefs.master_enabled, true)
        and coalesce(prefs.saving_reminders_enabled, true)
        and not exists (
          select 1
          from public.bucket_plan_pauses bp
          where bp.bucket_id = b.id
            and bp.paused_from <= v_today
            and (bp.resumed_from is null or bp.resumed_from > v_today)
        )
    ),
    bucket_no_recent_deposit as (
      select c.*
      from bucket_candidates c
      where not exists (
        select 1
        from public.savings_logs s
        where s.user_id = c.user_id
          and s.room_id = c.room_id
          and s.bucket_id = c.bucket_id
          and case c.cadence
                when 'weekly'  then to_char((s.created_at at time zone 'Asia/Bangkok')::date, 'IYYY-"W"IW') = c.period_key
                when 'monthly' then to_char((s.created_at at time zone 'Asia/Bangkok')::date, 'YYYY-MM') = c.period_key
                else (s.created_at at time zone 'Asia/Bangkok')::date = v_today
              end
      )
    ),
    inserted_bucket as (
      insert into public.notifications (
        recipient_user_id, actor_user_id, room_id, event_key, category,
        channel_policy, title, body, cta_label,
        target_route, target_section, fallback_route, push_safe,
        payload, source_table, source_id, dedupe_key
      )
      select
        nrd.user_id,
        null,
        nrd.room_id,
        'saving_reminder_due',
        'saving_reminder',
        'push_candidate',
        'Saving reminder',
        'Your plan is ready when you want to record today''s savings.',
        'View plan',
        '/dashboard?section=buckets',
        null,
        '/dashboard',
        true,
        jsonb_build_object(
          'bucket_id',   nrd.bucket_id,
          'bucket_name', nrd.bucket_name,
          'rule_type',   nrd.rule_type,
          'cadence',     nrd.cadence,
          'period',      nrd.period_key
        ),
        'buckets',
        nrd.bucket_id,
        'bucket_saving_reminder:' || nrd.bucket_id::text || ':' || nrd.cadence || ':' || nrd.period_key || ':' || nrd.user_id::text
      from bucket_no_recent_deposit nrd
      on conflict (recipient_user_id, dedupe_key) do nothing
      returning
        notifications.id,
        notifications.recipient_user_id,
        (notifications.payload ->> 'bucket_id')::uuid,
        notifications.room_id,
        notifications.payload ->> 'cadence',
        notifications.payload ->> 'period'
    )
  select * from inserted_legacy
  union all
  select * from inserted_bucket;
end;
$$;

revoke all on function public.enqueue_saving_plan_reminders() from public;
revoke all on function public.enqueue_saving_plan_reminders() from authenticated;
grant execute on function public.enqueue_saving_plan_reminders() to service_role;

create or replace function public.notify_bucket_plan_paused(p_pause_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor       uuid := auth.uid();
  v_pause_user  uuid;
  v_bucket_id   uuid;
  v_room_id     uuid;
  v_bucket_name text;
  v_recipient   uuid;
  v_actor_name  text;
  v_dedupe      text;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_pause_id is null then
    raise exception 'pause id required' using errcode = '22023';
  end if;

  select bp.user_id, bp.bucket_id, bp.room_id, b.name
    into v_pause_user, v_bucket_id, v_room_id, v_bucket_name
  from public.bucket_plan_pauses bp
  join public.buckets b on b.id = bp.bucket_id
  where bp.id = p_pause_id;

  if v_pause_user is null then
    raise exception 'pause not found' using errcode = 'P0002';
  end if;
  if v_pause_user <> v_actor then
    raise exception 'cannot notify on another user bucket pause' using errcode = '42501';
  end if;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_recipient := public._other_room_member(v_room_id, v_actor);
  if v_recipient is null then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_dedupe := 'bucket_plan_pause:' || p_pause_id::text || ':paused:' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, v_room_id, 'bucket_plan_paused', v_dedupe,
    'Bucket plan paused',
    v_actor_name || ' paused ' || coalesce(nullif(btrim(v_bucket_name), ''), 'a bucket') || '.',
    'View buckets',
    '/dashboard?section=buckets', null, '/dashboard',
    false,
    jsonb_build_object(
      'actor_name', v_actor_name,
      'bucket_id', v_bucket_id,
      'bucket_name', v_bucket_name,
      'status', 'paused'
    ),
    'bucket_plan_pauses', p_pause_id
  );
end;
$$;

revoke all on function public.notify_bucket_plan_paused(uuid) from public;
grant execute on function public.notify_bucket_plan_paused(uuid) to authenticated;

create or replace function public.notify_bucket_plan_resumed(p_pause_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor       uuid := auth.uid();
  v_pause_user  uuid;
  v_bucket_id   uuid;
  v_room_id     uuid;
  v_bucket_name text;
  v_recipient   uuid;
  v_actor_name  text;
  v_dedupe      text;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_pause_id is null then
    raise exception 'pause id required' using errcode = '22023';
  end if;

  select bp.user_id, bp.bucket_id, bp.room_id, b.name
    into v_pause_user, v_bucket_id, v_room_id, v_bucket_name
  from public.bucket_plan_pauses bp
  join public.buckets b on b.id = bp.bucket_id
  where bp.id = p_pause_id;

  if v_pause_user is null then
    raise exception 'pause not found' using errcode = 'P0002';
  end if;
  if v_pause_user <> v_actor then
    raise exception 'cannot notify on another user bucket pause' using errcode = '42501';
  end if;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_recipient := public._other_room_member(v_room_id, v_actor);
  if v_recipient is null then
    return null;
  end if;

  v_actor_name := public._actor_display_name(v_actor);
  v_dedupe := 'bucket_plan_pause:' || p_pause_id::text || ':resumed:' || v_recipient::text;

  return public._insert_partner_notification(
    v_recipient, v_actor, v_room_id, 'bucket_plan_resumed', v_dedupe,
    'Bucket plan resumed',
    v_actor_name || ' resumed ' || coalesce(nullif(btrim(v_bucket_name), ''), 'a bucket') || '.',
    'View buckets',
    '/dashboard?section=buckets', null, '/dashboard',
    false,
    jsonb_build_object(
      'actor_name', v_actor_name,
      'bucket_id', v_bucket_id,
      'bucket_name', v_bucket_name,
      'status', 'resumed'
    ),
    'bucket_plan_pauses', p_pause_id
  );
end;
$$;

revoke all on function public.notify_bucket_plan_resumed(uuid) from public;
grant execute on function public.notify_bucket_plan_resumed(uuid) to authenticated;

commit;
