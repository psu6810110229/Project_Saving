-- ============================================================
-- 0069_fix_personal_goal_archived_bucket_floor.sql
-- Hotfix: the personal sub-goal floor used the same archive-blind
-- sum as enforce_bucket_sum_le_goal (fixed in 0068). Lowering a
-- personal sub-goal from e.g. 53k to 50k would fail with
-- "Personal sub-goal cannot be lower than your existing bucket
-- targets" whenever archived buckets pushed the legacy sum above
-- the new target, even though the user's active bucket total fit
-- under it.
--
-- Both call sites need the same fix: the trigger that defends
-- direct goals writes, and the update_member_goal RPC the client
-- normally calls. Function bodies are otherwise identical to
-- migration 0057.
-- ============================================================

begin;

create or replace function public.enforce_personal_goal_target_invariant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_target numeric;
  v_bucket_sum numeric;
begin
  if new.target_amount is null or new.target_amount <= 0 then
    raise exception 'goals.target_amount must be greater than 0'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and old.target_amount is not distinct from new.target_amount
     and old.room_id is not distinct from new.room_id
     and old.user_id is not distinct from new.user_id then
    return new;
  end if;

  select r.target_amount
    into v_room_target
    from public.rooms r
   where r.id = new.room_id;

  if v_room_target is not null and new.target_amount > v_room_target then
    raise exception 'Personal sub-goal (%) cannot exceed room goal (%)', new.target_amount, v_room_target
      using errcode = '23514';
  end if;

  -- Archived buckets must not pin the personal sub-goal floor.
  -- They no longer reserve capacity (see migrations 0058 / 0068).
  select coalesce(sum(b.target_amount), 0)
    into v_bucket_sum
    from public.buckets b
   where b.user_id = new.user_id
     and b.room_id = new.room_id
     and b.archived_at is null;

  if new.target_amount < v_bucket_sum then
    raise exception 'Personal sub-goal (%) cannot be less than your bucket target total (%)', new.target_amount, v_bucket_sum
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.update_member_goal(
  p_room_id uuid,
  p_target_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_room_target numeric;
  v_archived_at timestamptz;
  v_room_end_date date;
  v_bucket_sum numeric;
  v_existing_start date;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'target amount must be greater than 0' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.room_members rm
     where rm.room_id = p_room_id
       and rm.user_id = v_caller
  ) then
    raise exception 'caller is not a room member' using errcode = '42501';
  end if;

  select r.target_amount, r.archived_at, r.end_date
    into v_room_target, v_archived_at, v_room_end_date
    from public.rooms r
   where r.id = p_room_id;

  if v_archived_at is not null then
    raise exception 'room is archived' using errcode = '42501';
  end if;

  if v_room_target is null then
    raise exception 'room goal not set' using errcode = '22023';
  end if;

  if p_target_amount > v_room_target then
    raise exception 'personal sub-goal cannot exceed room goal (%)', v_room_target
      using errcode = '23514';
  end if;

  -- Match the trigger: archived buckets do not float the floor.
  select coalesce(sum(b.target_amount), 0)
    into v_bucket_sum
    from public.buckets b
   where b.user_id = v_caller
     and b.room_id = p_room_id
     and b.archived_at is null;

  if p_target_amount < v_bucket_sum then
    raise exception 'personal sub-goal cannot be less than your bucket target total (%)', v_bucket_sum
      using errcode = '23514';
  end if;

  select g.start_date
    into v_existing_start
    from public.goals g
   where g.user_id = v_caller
     and g.room_id = p_room_id;

  insert into public.goals (
    user_id,
    room_id,
    target_amount,
    start_date,
    end_date,
    updated_at
  )
  values (
    v_caller,
    p_room_id,
    p_target_amount,
    coalesce(v_existing_start, least(current_date, v_room_end_date)),
    v_room_end_date,
    now()
  )
  on conflict (user_id, room_id) do update
    set target_amount = excluded.target_amount,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.update_member_goal(uuid, numeric) from public;
grant execute on function public.update_member_goal(uuid, numeric) to authenticated;

commit;
