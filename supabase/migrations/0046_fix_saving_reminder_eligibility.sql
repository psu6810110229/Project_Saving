-- ============================================================
-- 0046_fix_saving_reminder_eligibility.sql
-- Bugfix P0-001 (0.9.6 → 0.9.7).
--
-- Symptom: users on `daily` / `daily_increasing` (and capped
-- variants) saving plans never received the deposit-reminder push.
--
-- Root cause: `notification_preferences.saving_reminders_enabled`
-- defaulted to `false` (migration 0037). `get_notification_preferences`
-- auto-creates the row with all defaults the first time a user
-- opens the app, so every user ends up opted-OUT of saving
-- reminders even when they have already enabled push for their
-- device. The eligibility coalesce in
-- `enqueue_saving_plan_reminders()` mirrored this default
-- (`coalesce(prefs.saving_reminders_enabled, false)`), so the
-- batch never produced rows for those users.
--
-- This migration:
--   1. Flips the column default to `true`, so any new auto-created
--      prefs row opts the user IN by default. Users can still
--      toggle reminders off via the settings page.
--   2. Backfills existing prefs rows that were never touched by the
--      user (heuristic: updated_at = created_at, i.e. still in the
--      shape `get_notification_preferences` originally inserted)
--      to `true`. Rows where the user has interacted with prefs
--      are left untouched so explicit opt-outs survive.
--   3. Recreates `enqueue_saving_plan_reminders()` with:
--        - explicit `rule_type` whitelist so any future rule type
--          must be added intentionally,
--        - `coalesce(prefs.saving_reminders_enabled, true)` so a
--          truly missing prefs row no longer excludes the user.
--      All other eligibility guards (active plan, latest revision,
--      end_date, open pauses, deposit-in-cadence, 18:00 Bangkok
--      gate, dedupe via unique constraint) are preserved.
-- ============================================================

begin;

-- 1. Column default → true.
alter table public.notification_preferences
  alter column saving_reminders_enabled set default true;

-- 2. Backfill untouched rows. updated_at = created_at means the
--    row is still in the shape `get_notification_preferences`
--    originally inserted (no UPDATE has happened against it), so
--    the false value is the legacy default and not an explicit
--    user opt-out.
update public.notification_preferences
   set saving_reminders_enabled = true,
       updated_at = now()
 where saving_reminders_enabled = false
   and updated_at = created_at;

-- 3. Recreate the eligibility RPC with the updated coalesce default
--    and an explicit rule_type whitelist.
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
        -- Explicit whitelist. Any new rule_type must be added
        -- intentionally rather than silently inheriting the
        -- 'daily' cadence fallback.
        and r.rule_type in (
          'fixed_daily',
          'fixed_weekly',
          'fixed_monthly',
          'increasing_daily',
          'increasing_daily_capped'
        )
      order by r.plan_id, r.effective_from_date desc
    ),
    in_window_plans as (
      select lr.*
      from latest_revisions lr
      where lr.end_date is null or lr.end_date >= v_today
    ),
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
    -- Missing prefs row now defaults to opted-IN for saving
    -- reminders (was opted-out in migration 0039). The column
    -- default flipped above keeps this consistent for any row
    -- created after this migration.
    eligible_recipients as (
      select np.*
      from not_paused_plans np
      left join public.notification_preferences prefs
        on prefs.user_id = np.user_id
      where coalesce(prefs.master_enabled, true)
        and coalesce(prefs.saving_reminders_enabled, true)
    ),
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

revoke all on function public.enqueue_saving_plan_reminders() from public;
revoke all on function public.enqueue_saving_plan_reminders() from authenticated;
grant execute on function public.enqueue_saving_plan_reminders() to service_role;

commit;
