-- ============================================================
-- 0031_harden_saving_plan_end_date.sql
-- Task 22.2 hardening: enforce end_date >= effective_from_date
-- for create/change saving plan RPCs.
-- ============================================================

begin;

create or replace function public.create_saving_plan(
  p_room_id            uuid,
  p_rule_type          text,
  p_target_amount      numeric,
  p_amount             numeric default null,
  p_start_amount       numeric default null,
  p_increment_amount   numeric default null,
  p_effective_from_date date   default null,
  p_end_date           date    default null,
  p_day_count          int     default null
)
returns table (plan_id uuid, revision_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_today       date := (now() at time zone 'Asia/Bangkok')::date;
  v_effective   date;
  v_plan_id     uuid;
  v_revision_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_room_id is null then
    raise exception 'room id required' using errcode = '22023';
  end if;
  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;
  if p_rule_type not in (
    'fixed_daily','fixed_weekly','fixed_monthly','increasing_daily'
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
  elsif p_rule_type = 'increasing_daily' then
    if p_start_amount is null or p_start_amount <= 0 then
      raise exception 'start_amount must be positive for increasing_daily' using errcode = '22023';
    end if;
    if p_increment_amount is null or p_increment_amount < 0 then
      raise exception 'increment_amount must be zero or positive for increasing_daily' using errcode = '22023';
    end if;
  end if;

  v_effective := coalesce(p_effective_from_date, v_today);
  if p_end_date is not null and p_end_date < v_effective then
    raise exception 'end_date must be on or after effective_from_date' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.saving_plans
    where room_id = p_room_id
      and user_id = v_user_id
      and archived_at is null
  ) then
    raise exception 'an active plan already exists for this user in this room' using errcode = '23505';
  end if;

  insert into public.saving_plans (room_id, user_id)
  values (p_room_id, v_user_id)
  returning id into v_plan_id;

  insert into public.saving_plan_revisions (
    plan_id, room_id, user_id, effective_from_date, rule_type,
    amount, start_amount, increment_amount, target_amount,
    end_date, day_count, created_by
  ) values (
    v_plan_id, p_room_id, v_user_id, v_effective, p_rule_type,
    p_amount, p_start_amount, p_increment_amount, p_target_amount,
    p_end_date, p_day_count, v_user_id
  )
  returning id into v_revision_id;

  return query select v_plan_id, v_revision_id;
end;
$$;

revoke all on function public.create_saving_plan(uuid, text, numeric, numeric, numeric, numeric, date, date, int) from public;
grant execute on function public.create_saving_plan(uuid, text, numeric, numeric, numeric, numeric, date, date, int) to authenticated;

create or replace function public.change_saving_plan(
  p_plan_id             uuid,
  p_rule_type           text,
  p_target_amount       numeric,
  p_amount              numeric default null,
  p_start_amount        numeric default null,
  p_increment_amount    numeric default null,
  p_effective_from_date date    default null,
  p_end_date            date    default null,
  p_day_count           int     default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id              uuid := auth.uid();
  v_today                date := (now() at time zone 'Asia/Bangkok')::date;
  v_plan                 public.saving_plans%rowtype;
  v_effective            date;
  v_latest_revision_date date;
  v_revision_id          uuid;
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
    'fixed_daily','fixed_weekly','fixed_monthly','increasing_daily'
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
  elsif p_rule_type = 'increasing_daily' then
    if p_start_amount is null or p_start_amount <= 0 then
      raise exception 'start_amount must be positive for increasing_daily' using errcode = '22023';
    end if;
    if p_increment_amount is null or p_increment_amount < 0 then
      raise exception 'increment_amount must be zero or positive for increasing_daily' using errcode = '22023';
    end if;
  end if;

  v_effective := coalesce(p_effective_from_date, v_today);
  if p_end_date is not null and p_end_date < v_effective then
    raise exception 'end_date must be on or after effective_from_date' using errcode = '22023';
  end if;

  select max(effective_from_date) into v_latest_revision_date
  from public.saving_plan_revisions
  where plan_id = p_plan_id;

  if v_latest_revision_date is not null and v_effective < v_latest_revision_date then
    raise exception 'cannot backdate revision before existing revision (%)', v_latest_revision_date
      using errcode = '22023';
  end if;

  insert into public.saving_plan_revisions (
    plan_id, room_id, user_id, effective_from_date, rule_type,
    amount, start_amount, increment_amount, target_amount,
    end_date, day_count, created_by
  ) values (
    p_plan_id, v_plan.room_id, v_user_id, v_effective, p_rule_type,
    p_amount, p_start_amount, p_increment_amount, p_target_amount,
    p_end_date, p_day_count, v_user_id
  )
  returning id into v_revision_id;

  return v_revision_id;
end;
$$;

revoke all on function public.change_saving_plan(uuid, text, numeric, numeric, numeric, numeric, date, date, int) from public;
grant execute on function public.change_saving_plan(uuid, text, numeric, numeric, numeric, numeric, date, date, int) to authenticated;

commit;
