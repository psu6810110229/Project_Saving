-- ============================================================
-- 0052_change_plan_supersede_unborn_revisions.sql
-- Bugfix follow-up to 0048.
--
-- Problem: when an existing plan has a future-dated revision
-- (e.g. effective_from_date = 2026-06-01) and the user changes
-- the plan to a *later* future start (e.g. 2026-07-01), the old
-- future revision survives the supersede step because the
-- condition `effective_from_date > v_effective` (2026-07-01)
-- skips the earlier-future row (2026-06-01).
--
-- After save the plan ends up with two future revisions. The
-- SavingPlan form re-seeds from `nextUpcomingRevision`, which
-- picks the *earliest* future revision (the OLD one), so the
-- screen appears unchanged even though the RPC returned a new
-- revision id.
--
-- Fix: supersede *all* unborn future revisions
--   (`effective_from_date > v_today`) before inserting the new
-- one. Unborn revisions are never active history, so removing
-- them matches the original 0048 intent and the user's model
-- that a "change" replaces the pending revision.
--
-- This still keeps any active or past revisions intact (those
-- have `effective_from_date <= v_today`).
--
-- Same signature as 0048 (replaces the function body only). No
-- schema, RLS, or grant changes.
-- ============================================================

begin;

create or replace function public.change_saving_plan(
  p_plan_id             uuid,
  p_rule_type           text,
  p_target_amount       numeric,
  p_amount              numeric default null,
  p_start_amount        numeric default null,
  p_increment_amount    numeric default null,
  p_effective_from_date date    default null,
  p_end_date            date    default null,
  p_day_count           int     default null,
  p_cap_amount          numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_today       date := (now() at time zone 'Asia/Bangkok')::date;
  v_plan        public.saving_plans%rowtype;
  v_effective   date;
  v_revision_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_plan_id is null then
    raise exception 'plan id required' using errcode = '22023';
  end if;

  select * into v_plan
  from public.saving_plans
  where id = p_plan_id;
  if not found then
    raise exception 'plan not found' using errcode = 'P0002';
  end if;
  if v_plan.user_id <> v_user_id then
    raise exception 'cannot modify another user plan' using errcode = '42501';
  end if;
  if v_plan.archived_at is not null then
    raise exception 'plan is archived' using errcode = '22023';
  end if;
  if not public.is_room_member(v_plan.room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  if p_rule_type not in (
    'fixed_daily','fixed_weekly','fixed_monthly',
    'increasing_daily','increasing_daily_capped'
  ) then
    raise exception 'unknown rule type: %', p_rule_type using errcode = '22023';
  end if;
  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'target amount must be positive' using errcode = '22023';
  end if;
  if p_rule_type in ('fixed_daily','fixed_weekly','fixed_monthly') then
    if p_amount is null or p_amount <= 0 then
      raise exception 'amount must be positive for %', p_rule_type using errcode = '22023';
    end if;
  elsif p_rule_type in ('increasing_daily','increasing_daily_capped') then
    if p_start_amount is null or p_start_amount <= 0 then
      raise exception 'start_amount must be positive for %', p_rule_type using errcode = '22023';
    end if;
    if p_increment_amount is null or p_increment_amount < 0 then
      raise exception 'increment_amount must be zero or positive for %', p_rule_type using errcode = '22023';
    end if;
    if p_rule_type = 'increasing_daily_capped' then
      if p_cap_amount is null or p_cap_amount <= 0 then
        raise exception 'cap_amount must be positive for increasing_daily_capped' using errcode = '22023';
      end if;
      if p_cap_amount < p_start_amount then
        raise exception 'cap_amount must be greater than or equal to start_amount' using errcode = '22023';
      end if;
    end if;
  end if;
  if p_day_count is not null and p_day_count <= 0 then
    raise exception 'day_count must be positive when provided' using errcode = '22023';
  end if;

  v_effective := coalesce(p_effective_from_date, v_today);
  if p_end_date is not null and p_end_date < v_effective then
    raise exception 'end_date must be on or after effective_from_date' using errcode = '22023';
  end if;

  -- Reject true backdates (before today, Asia/Bangkok). Same-day or
  -- future-dated revisions are allowed even if a later-dated
  -- revision already exists; the supersede step below keeps the
  -- revision history coherent.
  if v_effective < v_today then
    raise exception 'cannot backdate revision before today (%)', v_today
      using errcode = '22023';
  end if;

  -- Supersede every revision that has not yet become active
  -- (`effective_from_date > v_today`). These rows are unborn
  -- future revisions — never active history — and a user-driven
  -- "change" is meant to replace the pending one. Without this
  -- broader sweep, picking a later future start (e.g. 2026-07-01
  -- when an earlier-future 2026-06-01 revision already exists)
  -- would leave both rows in the table; the form's
  -- `nextUpcomingRevision` then reseeds from the older one and
  -- the UI silently shows the pre-change plan.
  delete from public.saving_plan_revisions
  where plan_id = p_plan_id
    and effective_from_date > v_today;

  insert into public.saving_plan_revisions (
    plan_id, room_id, user_id, effective_from_date, rule_type,
    amount, start_amount, increment_amount, cap_amount,
    target_amount, end_date, day_count, created_by
  ) values (
    p_plan_id, v_plan.room_id, v_user_id, v_effective, p_rule_type,
    p_amount, p_start_amount, p_increment_amount,
    case when p_rule_type = 'increasing_daily_capped' then p_cap_amount else null end,
    p_target_amount, p_end_date, p_day_count, v_user_id
  )
  returning id into v_revision_id;

  return v_revision_id;
end;
$$;

commit;
