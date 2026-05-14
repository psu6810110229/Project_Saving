-- ============================================================
-- 0036_saving_plan_pauses_same_day_resume.sql
-- Task 22.4 hotfix: allow same-day pause + resume.
--
-- The original constraint required resumed_from > paused_from,
-- which prevented a user from resuming a plan on the same Bangkok
-- day they paused it.  With resumed_from = paused_from the pause
-- interval [paused_from, resumed_from) is empty — the day is never
-- treated as paused by any client calculation — so the audit row is
-- preserved while having no functional effect.
--
-- Relaxes the check to resumed_from >= paused_from and removes the
-- same-day guard from the resume_saving_plan RPC.
-- ============================================================

begin;

-- ── relax date constraint ──────────────────────────────────────
alter table public.saving_plan_pauses
  drop constraint if exists saving_plan_pauses_dates_check;

alter table public.saving_plan_pauses
  add constraint saving_plan_pauses_dates_check
  check (resumed_from is null or resumed_from >= paused_from);

-- ── recreate resume_saving_plan without same-day guard ─────────
create or replace function public.resume_saving_plan(p_plan_id uuid)
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

  select id into v_pause_id
  from public.saving_plan_pauses
  where plan_id = p_plan_id and resumed_from is null;

  if not found then
    raise exception 'no open pause to resume' using errcode = 'P0002';
  end if;

  -- resumed_from = today is allowed (same-day resume is a no-op pause
  -- that preserves history without affecting calculations).
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
