-- ============================================================
-- 0048_relax_change_plan_backdate_guard.sql
-- Bugfix P0-009 (0.9.6 → 0.9.7).
--
-- Problem: change_saving_plan rejected any revision whose
-- effective_from_date was earlier than the latest existing
-- revision. A daily-increasing plan can legally have a
-- future-dated latest revision (e.g. the user picked a future
-- planStartDate via the date-range stop mode), so attempting to
-- switch to another plan type today was rejected with
--   "cannot backdate revision before existing revision (<future>)"
-- even though `today` is not a backdate in product terms.
--
-- Fix:
--   * Reject only when v_effective is strictly before today
--     (Asia/Bangkok). This preserves the "no real backdating"
--     rule while allowing today-or-later revisions to land
--     when a future-dated revision already exists.
--   * When the new revision supersedes any future-dated
--     revisions (effective_from_date > v_effective), delete
--     those rows for this plan. Future revisions were never
--     active history, so removing them keeps activeRevisionAt
--     from silently flipping the plan back when their date
--     arrives.
--
-- Same signature as 0034 (replaces the function body only). No
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

  -- Supersede revisions scheduled for after v_effective. They are
  -- not yet active history (their effective date has not arrived),
  -- so removing them prevents activeRevisionAt from flipping the
  -- plan back to the old rule on the future date.
  delete from public.saving_plan_revisions
  where plan_id = p_plan_id
    and effective_from_date > v_effective;

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
