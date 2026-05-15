-- ============================================================
-- 0039_saving_reminder_notifications.sql
-- Task 23.3 — Saving plan reminders.
--
-- Adds `public.enqueue_saving_plan_reminders()`, a service-role
-- RPC that finds active, non-paused saving plans whose owner has
-- opted into reminders and has not recorded a deposit in the
-- current cadence window, then inserts one `saving_reminder_due`
-- notification per eligible plan.
--
-- Eligibility (all must hold; checks happen in SQL to keep the
-- whole batch atomic):
--   * saving_plans.archived_at is null
--   * a saving_plan_revisions row with effective_from_date <= today
--     (Bangkok); the latest such revision is used for cadence
--   * revision.end_date is null OR >= today (Bangkok)
--   * no open pause covering today (paused_from <= today AND
--     (resumed_from is null OR resumed_from > today))
--   * notification_preferences.master_enabled = true (defaults true
--     when row missing)
--   * notification_preferences.saving_reminders_enabled = true
--     (defaults false when row missing → user is NOT eligible
--     until they opt in, matching the UX spec)
--   * no savings_logs row for the owner in the cadence window:
--       - daily / increasing / increasing_capped: same Bangkok date
--       - weekly: same Bangkok ISO week (IYYY-IW)
--       - monthly: same Bangkok month (YYYY-MM)
--   * dedupe key not yet present (the unique constraint
--     (recipient_user_id, dedupe_key) on notifications enforces
--     this on insert via ON CONFLICT DO NOTHING)
--
-- A conservative 18:00 Asia/Bangkok gate is applied: callers that
-- run before 18:00 local time get an empty result. This avoids
-- morning-pressure reminders while still letting the scheduler
-- run hourly.
--
-- All target/fallback routes are filled in, satisfying the
-- non-empty CHECK constraints from migration 0037. Copy is calm
-- and non-shaming per the UX spec.
--
-- The function returns one row per newly created notification so
-- the calling edge function can drive push delivery for just the
-- fresh inserts.
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
    -- Latest revision per active plan that has taken effect.
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
      order by r.plan_id, r.effective_from_date desc
    ),
    -- Drop plans that have hit their end_date.
    in_window_plans as (
      select lr.*
      from latest_revisions lr
      where lr.end_date is null or lr.end_date >= v_today
    ),
    -- Drop plans whose pause interval [paused_from, resumed_from)
    -- covers today. Same-day pause+resume leaves resumed_from =
    -- paused_from (empty interval) → that day is NOT considered
    -- paused, matching saving_plan_pauses semantics.
    not_paused_plans as (
      select iwp.*
      from in_window_plans iwp
      where not exists (
        select 1
        from public.saving_plan_pauses sp
        where sp.plan_id = iwp.plan_id
          and sp.paused_from <= v_today
          and (sp.resumed_from is null or sp.resumed_from > v_today)
      )
    ),
    -- Gate by recipient preferences. Missing preferences row defaults
    -- to master=true / reminders=false (matching get_notification_preferences()
    -- defaults), which means a user who has never opened settings is
    -- NOT eligible until they opt in.
    eligible_recipients as (
      select np.*
      from not_paused_plans np
      left join public.notification_preferences prefs
        on prefs.user_id = np.user_id
      where coalesce(prefs.master_enabled, true)
        and coalesce(prefs.saving_reminders_enabled, false)
    ),
    -- Compute cadence + Bangkok period key.
    candidates as (
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
      from eligible_recipients er
    ),
    -- Drop candidates that already have a deposit in the cadence
    -- window. Bangkok-local boundary is computed per-row.
    no_recent_deposit as (
      select c.*
      from candidates c
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
    inserted as (
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
      from no_recent_deposit nrd
      on conflict (recipient_user_id, dedupe_key) do nothing
      returning
        notifications.id,
        notifications.recipient_user_id,
        (notifications.payload ->> 'plan_id')::uuid,
        notifications.room_id,
        notifications.payload ->> 'cadence',
        notifications.payload ->> 'period'
    )
  select * from inserted;
end;
$$;

-- Service-role only. The function bypasses RLS implicitly via the
-- service role caller; we still revoke from public/authenticated to
-- prevent clients from triggering reminder generation on demand.
revoke all on function public.enqueue_saving_plan_reminders() from public;
revoke all on function public.enqueue_saving_plan_reminders() from authenticated;
grant execute on function public.enqueue_saving_plan_reminders() to service_role;

commit;
