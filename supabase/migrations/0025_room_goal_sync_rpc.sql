-- ============================================================
-- 0025_room_goal_sync_rpc.sql
-- Keep the room-level project goal synchronized for both members.
--
-- Manage Project treats the trip target and end date as shared room
-- settings. Previously the client updated rooms.end_date and then only
-- the caller's goals row, leaving the partner on a stale target. This
-- RPC updates the room and upserts matching goals rows for every current
-- room member in one server-side operation.
-- ============================================================

begin;

create or replace function public.update_room_goal(
  p_room_id uuid,
  p_target_amount numeric,
  p_end_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_creator uuid;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'target amount must be greater than 0' using errcode = '22023';
  end if;

  if p_end_date is null then
    raise exception 'end date is required' using errcode = '22023';
  end if;

  select r.created_by
    into v_creator
  from public.rooms r
  where r.id = p_room_id
    and r.archived_at is null;

  if v_creator is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = v_caller
  ) then
    raise exception 'caller is not a room member' using errcode = '42501';
  end if;

  if v_creator <> v_caller then
    raise exception 'only the room creator can update the shared project goal'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.goals g
    where g.room_id = p_room_id
      and g.start_date > p_end_date
  ) then
    raise exception 'end date cannot be before an existing goal start date'
      using errcode = '22023';
  end if;

  update public.rooms
    set end_date = p_end_date
    where id = p_room_id;

  insert into public.goals (
    user_id,
    room_id,
    target_amount,
    start_date,
    end_date,
    updated_at
  )
  select
    rm.user_id,
    p_room_id,
    p_target_amount,
    coalesce(g.start_date, least(current_date, p_end_date)),
    p_end_date,
    now()
  from public.room_members rm
  left join public.goals g
    on g.room_id = rm.room_id
   and g.user_id = rm.user_id
  where rm.room_id = p_room_id
  on conflict (user_id, room_id) do update
    set target_amount = excluded.target_amount,
        end_date = excluded.end_date,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.update_room_goal(uuid, numeric, date) from public;
grant execute on function public.update_room_goal(uuid, numeric, date) to authenticated;

commit;
