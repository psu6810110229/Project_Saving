-- ============================================================
-- 0030_saving_plans.sql
-- Task 22.1 Saving Plan + Progress Insights MVP.
--
-- Adds saving_plans (one active plan per user per room) and
-- append-only saving_plan_revisions. Pause support is deferred.
--
-- Adds an authoritative recorded_deposits_summary RPC the client
-- can call instead of summing a capped useLogs list, plus
-- security-definer write RPCs for plan create/change. All writes
-- are routed through the RPCs; tables are owner-select only.
-- ============================================================

begin;

-- ── saving_plans ───────────────────────────────────────────────
create table if not exists public.saving_plans (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  timezone    text not null default 'Asia/Bangkok',
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists uq_saving_plans_active_per_user_room
  on public.saving_plans (room_id, user_id)
  where archived_at is null;

create index if not exists idx_saving_plans_room_user
  on public.saving_plans (room_id, user_id);

-- ── saving_plan_revisions (append-only) ────────────────────────
create table if not exists public.saving_plan_revisions (
  id                   uuid primary key default gen_random_uuid(),
  plan_id              uuid not null references public.saving_plans(id) on delete cascade,
  room_id              uuid not null references public.rooms(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  effective_from_date  date not null,
  rule_type            text not null check (rule_type in (
    'fixed_daily',
    'fixed_weekly',
    'fixed_monthly',
    'increasing_daily'
  )),
  amount               numeric(12,2),
  start_amount         numeric(12,2),
  increment_amount     numeric(12,2),
  cap_amount           numeric(12,2),
  target_amount        numeric(12,2) not null check (target_amount > 0),
  end_date             date,
  day_count            int check (day_count is null or day_count > 0),
  created_at           timestamptz not null default now(),
  created_by           uuid not null references auth.users(id),
  constraint saving_plan_revisions_rule_fields_check check (
    case rule_type
      when 'fixed_daily'      then amount is not null and amount > 0
      when 'fixed_weekly'     then amount is not null and amount > 0
      when 'fixed_monthly'    then amount is not null and amount > 0
      when 'increasing_daily' then start_amount is not null and start_amount > 0
                                and increment_amount is not null and increment_amount >= 0
      else false
    end
  )
);

create index if not exists idx_saving_plan_revisions_plan_effective
  on public.saving_plan_revisions (plan_id, effective_from_date desc);

create index if not exists idx_saving_plan_revisions_user_room
  on public.saving_plan_revisions (user_id, room_id, effective_from_date desc);

-- ── RLS ────────────────────────────────────────────────────────
alter table public.saving_plans          enable row level security;
alter table public.saving_plan_revisions enable row level security;

drop policy if exists "saving_plans_select_own"          on public.saving_plans;
drop policy if exists "saving_plan_revisions_select_own" on public.saving_plan_revisions;

-- Owner-only read. All writes go through the security-definer RPCs
-- below; no direct insert/update/delete is granted to clients.
create policy "saving_plans_select_own"
  on public.saving_plans for select
  to authenticated
  using (user_id = auth.uid());

create policy "saving_plan_revisions_select_own"
  on public.saving_plan_revisions for select
  to authenticated
  using (user_id = auth.uid());

-- ── recorded_deposits_summary RPC ─────────────────────────────
-- Authoritative server-side summary for the caller in `p_room_id`.
-- The capped useLogs list must not be the source of truth for plan
-- math; this RPC fixes that and is the only thing the Saving Plan
-- card consumes for Recorded Deposits.
create or replace function public.recorded_deposits_summary(p_room_id uuid)
returns table (
  total            numeric,
  last_deposit_at  timestamptz,
  deposit_day_keys text[]
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
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

  return query
    with my_logs as (
      select s.amount, s.created_at
      from public.savings_logs s
      where s.room_id = p_room_id
        and s.user_id = v_user_id
    )
    select
      coalesce((select sum(amount) from my_logs), 0)::numeric,
      (select max(created_at) from my_logs),
      coalesce(
        (select array_agg(distinct to_char(created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD'))
         from my_logs),
        '{}'::text[]
      );
end;
$$;

revoke all on function public.recorded_deposits_summary(uuid) from public;
grant execute on function public.recorded_deposits_summary(uuid) to authenticated;

-- ── create_saving_plan RPC ─────────────────────────────────────
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

-- ── change_saving_plan RPC ─────────────────────────────────────
-- Appends a new revision effective today (or a future date).
-- Cannot backdate before the latest existing revision and cannot
-- modify another user's plan.
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
