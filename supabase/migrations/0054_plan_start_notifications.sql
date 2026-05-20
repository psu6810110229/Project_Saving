-- ============================================================
-- 0054_plan_start_notifications.sql
-- Task 30 — Plan-start push notification.
--
-- Adds one new service-role-only RPC:
--
--   enqueue_plan_start_notifications()
--
-- The RPC enqueues a one-shot in-app + push notification (event_key
-- 'plan_started', category 'saving_reminder') to the plan owner on
-- the Bangkok-local morning of the earliest revision's
-- effective_from_date. The edge function `scheduled-saving-reminders`
-- invokes this RPC alongside the existing saving-reminder RPC.
--
-- Schema audit (per task 30 plan §2a):
--   * The plan's "start date" is the effective_from_date of the
--     earliest non-deleted revision belonging to a non-archived
--     saving_plan. Migration 0052 hard-deletes every unborn future
--     revision on each change_saving_plan call, so the earliest
--     surviving revision is always the current/active root — there
--     is no superseded_at column on saving_plan_revisions.
--   * saving_plans.archived_at IS NULL is the only archive filter
--     needed; there is no per-revision archive flag.
--   * The rule_type whitelist below must stay in lockstep with
--     migration 0046's whitelist. Any new rule_type added to one RPC
--     must be added to the other in the same migration.
--   * distinct on (r.plan_id) with order by effective_from_date asc,
--     created_at asc makes the earliest revision deterministic when
--     two revisions share the same date.
--
-- Decisions (per task 30 plan §15):
--   * Reuses notification_preferences.saving_reminders_enabled — no
--     new toggle, no new category.
--   * Time gate: Bangkok-local [07:00, 10:00) (inclusive 07:00,
--     exclusive 10:00).
--   * Same-day plan creation does not trigger plan_started; the
--     partner-facing plan_created flow already covers that case.
--   * Dedupe key: 'plan_started:<plan_id>:<YYYY-MM-DD>'. The
--     existing notifications.notifications_recipient_dedupe_unique
--     constraint (recipient_user_id, dedupe_key) provides per-(plan,
--     start_date) dedupe; the recipient is implicit.
-- ============================================================

begin;

create or replace function public.enqueue_plan_start_notifications()
returns table (
  notification_id   uuid,
  recipient_user_id uuid,
  plan_id           uuid,
  room_id           uuid,
  start_date        date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_bkk timestamp := (now() at time zone 'Asia/Bangkok');
  v_today   date       := v_now_bkk::date;
  v_hour    int        := extract(hour from v_now_bkk)::int;
begin
  -- Bangkok-local [07:00, 10:00) time gate. Inclusive lower bound,
  -- exclusive upper bound, matching the feature plan window. The
  -- production scheduler runs hourly so 07:00, 08:00, and 09:00
  -- ticks all fall inside the window; dedupe (below) guarantees a
  -- single in-app row even with three eligible ticks.
  if v_hour < 7 or v_hour >= 10 then
    return;
  end if;

  return query
  with
    first_revisions as (
      select distinct on (r.plan_id)
        r.plan_id,
        p.user_id,
        p.room_id,
        r.effective_from_date,
        r.rule_type,
        p.created_at as plan_created_at
      from public.saving_plan_revisions r
      join public.saving_plans p on p.id = r.plan_id
      where p.archived_at is null
        -- Canonical rule_type whitelist; must match
        -- 0046_fix_saving_reminder_eligibility.sql verbatim. Any
        -- future rule type has to be added intentionally in both
        -- RPCs in lockstep.
        and r.rule_type in (
          'fixed_daily',
          'fixed_weekly',
          'fixed_monthly',
          'increasing_daily',
          'increasing_daily_capped'
        )
      order by r.plan_id, r.effective_from_date asc, r.created_at asc
    ),
    due_today as (
      select fr.*
      from first_revisions fr
      where fr.effective_from_date = v_today
        and (fr.plan_created_at at time zone 'Asia/Bangkok')::date < v_today
    ),
    -- Missing prefs row defaults to opted-IN, matching the post-0046
    -- saving-reminder eligibility behaviour.
    eligible_recipients as (
      select dt.*
      from due_today dt
      left join public.notification_preferences prefs
        on prefs.user_id = dt.user_id
      where coalesce(prefs.master_enabled, true)
        and coalesce(prefs.saving_reminders_enabled, true)
    ),
    inserted as (
      insert into public.notifications (
        recipient_user_id, actor_user_id, room_id, event_key, category,
        channel_policy, title, body, cta_label,
        target_route, target_section, fallback_route, push_safe,
        payload, source_table, source_id, dedupe_key
      )
      select
        er.user_id,
        null,
        er.room_id,
        'plan_started',
        'saving_reminder',
        'push_candidate',
        'Your saving plan starts today',
        'Your saving plan starts today. Record your first deposit when you''re ready.',
        'Open plan',
        '/saving-plan',
        null,
        '/saving-plan',
        true,
        jsonb_build_object(
          'plan_id',    er.plan_id,
          'rule_type',  er.rule_type,
          'start_date', to_char(er.effective_from_date, 'YYYY-MM-DD')
        ),
        'saving_plans',
        er.plan_id,
        'plan_started:' || er.plan_id::text || ':' || to_char(er.effective_from_date, 'YYYY-MM-DD')
      from eligible_recipients er
      on conflict (recipient_user_id, dedupe_key) do nothing
      returning
        notifications.id,
        notifications.recipient_user_id,
        (notifications.payload ->> 'plan_id')::uuid,
        notifications.room_id,
        (notifications.payload ->> 'start_date')::date
    )
  select * from inserted;
end;
$$;

revoke all on function public.enqueue_plan_start_notifications() from public;
revoke all on function public.enqueue_plan_start_notifications() from authenticated;
grant execute on function public.enqueue_plan_start_notifications() to service_role;

commit;
