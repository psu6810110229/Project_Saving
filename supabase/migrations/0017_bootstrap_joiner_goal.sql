-- ============================================================
-- 0017_bootstrap_joiner_goal.sql
-- When a second user joins a room via the 6-digit invite code,
-- they must also have a goals row so the Dashboard's TotalVault /
-- HeadToHead can render their own target. Without this, the
-- joiner sees "saved / 0" because useGoal() only reads the
-- caller's own goal row.
--
-- This RPC mirrors the room creator's goal (target_amount,
-- start_date, end_date) into a new goals row for the caller.
-- It is idempotent — calling it again is a no-op once the
-- joiner has their own row, even if they later edit their target.
-- ============================================================

begin;

create or replace function public.bootstrap_joiner_goal(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_creator uuid;
  v_creator_target numeric(12,2);
  v_creator_start date;
  v_creator_end date;
begin
  if v_caller is null then
    raise exception 'must be authenticated';
  end if;

  -- Caller must already be a member (the join_room_by_code RPC inserts the
  -- membership row before calling this, so this is a defensive check).
  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = v_caller
  ) then
    raise exception 'caller is not a member of room %', p_room_id;
  end if;

  -- Find the room creator's seed goal.
  select r.created_by
    into v_creator
  from public.rooms r
  where r.id = p_room_id;

  if v_creator is null then
    raise exception 'room % does not exist', p_room_id;
  end if;

  select g.target_amount, g.start_date, g.end_date
    into v_creator_target, v_creator_start, v_creator_end
  from public.goals g
  where g.room_id = p_room_id and g.user_id = v_creator;

  if v_creator_target is null then
    -- Creator never set a goal; fall back to the room's end_date and a
    -- conservative target of 0 so the row exists. The user can edit it
    -- from Manage Project later.
    select r.end_date
      into v_creator_end
    from public.rooms r
    where r.id = p_room_id;
    v_creator_target := 0;
    v_creator_start := current_date;
  end if;

  -- Insert only when the joiner doesn't already have a goal for this room.
  insert into public.goals (user_id, room_id, target_amount, start_date, end_date, updated_at)
  values (v_caller, p_room_id, v_creator_target, v_creator_start, v_creator_end, now())
  on conflict (user_id, room_id) do nothing;
end;
$$;

revoke all on function public.bootstrap_joiner_goal(uuid) from public;
grant execute on function public.bootstrap_joiner_goal(uuid) to authenticated;

commit;
