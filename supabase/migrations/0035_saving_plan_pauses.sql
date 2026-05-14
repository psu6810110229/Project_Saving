-- ============================================================
-- 0035_saving_plan_pauses.sql
-- Task 22.4 Saving Plan Pause / Resume.
--
-- Adds saving_plan_pauses (append-only pause history per plan).
-- A pause covers Bangkok dates [paused_from, resumed_from).
-- Only one open pause (resumed_from IS NULL) is allowed per plan.
--
-- Adds pause_saving_plan and resume_saving_plan security-definer
-- RPCs; table writes go through these RPCs only.
-- ============================================================

begin;

-- ── saving_plan_pauses ─────────────────────────────────────────
create table if not exists public.saving_plan_pauses (
  id            uuid        primary key default gen_random_uuid(),
  plan_id       uuid        not null references public.saving_plans(id)  on delete cascade,
  room_id       uuid        not null references public.rooms(id)          on delete cascade,
  user_id       uuid        not null references auth.users(id)            on delete cascade,
  paused_from   date        not null,
  resumed_from  date,
  created_at    timestamptz not null default now(),
  resumed_at    timestamptz,
  constraint saving_plan_pauses_dates_check
    check (resumed_from is null or resumed_from > paused_from)
);

-- Prevent overlapping pauses: at most one open pause per plan.
create unique index if not exists uq_saving_plan_pauses_open
  on public.saving_plan_pauses (plan_id)
  where resumed_from is null;

create index if not exists idx_saving_plan_pauses_plan
  on public.saving_plan_pauses (plan_id, paused_from);

-- ── RLS ────────────────────────────────────────────────────────
alter table public.saving_plan_pauses enable row level security;

drop policy if exists "saving_plan_pauses_select_own" on public.saving_plan_pauses;

create policy "saving_plan_pauses_select_own"
  on public.saving_plan_pauses for select
  to authenticated
  using (user_id = auth.uid());

-- ── pause_saving_plan RPC ──────────────────────────────────────
-- Creates an open pause starting from today (Bangkok).
-- Fails if the plan already has an open pause.
create or replace function public.pause_saving_plan(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_today    date := (now() at time zone 'Asia/Bangkok')::date;
  v_plan     public.saving_plans%rowtype;
  v_pause_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_plan_id is null then
    raise exception 'plan id required' using errcode = '22023';
  end if;

  select * into v_plan from public.saving_plans where id = p_plan_id;
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

  if exists (
    select 1 from public.saving_plan_pauses
    where plan_id = p_plan_id and resumed_from is null
  ) then
    raise exception 'plan already has an open pause' using errcode = '23505';
  end if;

  insert into public.saving_plan_pauses (plan_id, room_id, user_id, paused_from)
  values (p_plan_id, v_plan.room_id, v_user_id, v_today)
  returning id into v_pause_id;

  return v_pause_id;
end;
$$;

revoke all on function public.pause_saving_plan(uuid) from public;
grant execute on function public.pause_saving_plan(uuid) to authenticated;

-- ── resume_saving_plan RPC ─────────────────────────────────────
-- Closes the open pause by setting resumed_from = today (Bangkok).
-- Today becomes the first active day again.
-- Fails if the plan has no open pause or if today = paused_from
-- (pause must span at least one full day).
create or replace function public.resume_saving_plan(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_today      date := (now() at time zone 'Asia/Bangkok')::date;
  v_plan       public.saving_plans%rowtype;
  v_pause_id   uuid;
  v_paused_from date;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_plan_id is null then
    raise exception 'plan id required' using errcode = '22023';
  end if;

  select * into v_plan from public.saving_plans where id = p_plan_id;
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

  select id, paused_from into v_pause_id, v_paused_from
  from public.saving_plan_pauses
  where plan_id = p_plan_id and resumed_from is null;

  if not found then
    raise exception 'no open pause to resume' using errcode = 'P0002';
  end if;
  if v_today <= v_paused_from then
    raise exception 'cannot resume on the same day the pause started' using errcode = '22023';
  end if;

  update public.saving_plan_pauses
  set resumed_from = v_today,
      resumed_at   = now()
  where id = v_pause_id;

  return v_pause_id;
end;
$$;

revoke all on function public.resume_saving_plan(uuid) from public;
grant execute on function public.resume_saving_plan(uuid) to authenticated;

commit;
