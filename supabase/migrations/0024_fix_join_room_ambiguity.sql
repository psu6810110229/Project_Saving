-- ============================================================
-- 0024_fix_join_room_ambiguity.sql
-- Fixes 42702 "column reference 'room_id' is ambiguous" raised
-- when the client calls join_room_by_code.
--
-- Root cause: migration 0023 declared the function as
--     returns table (room_id uuid, status text)
-- which makes 'room_id' a name in the function's output-row scope.
-- Inside the body, queries like
--     where room_id = target_room_id
-- against public.room_members are then ambiguous between the OUT
-- column and the table column.
--
-- This migration keeps the same returned shape (so the client
-- contract is unchanged — useRooms.ts still reads
--     first.room_id, first.status
-- correctly) but qualifies every reference inside the body with
-- an explicit table alias so Postgres can disambiguate.
-- ============================================================

begin;

drop function if exists public.join_room_by_code(text);

create function public.join_room_by_code(code text)
returns table (room_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
  member_count integer;
  is_existing_member boolean;
begin
  -- Locate an active room with this invite code.
  select r.id into target_room_id
  from public.rooms r
  where r.invite_code = upper(trim(code))
    and r.archived_at is null
  limit 1;

  if target_room_id is null then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;

  -- Already a member?
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = target_room_id
      and rm.user_id = auth.uid()
  ) into is_existing_member;

  if is_existing_member then
    return query select target_room_id, 'already_member'::text;
    return;
  end if;

  -- Enforce the 2-player cap.
  select count(*) into member_count
  from public.room_members rm
  where rm.room_id = target_room_id;

  if member_count >= 2 then
    return query select target_room_id, 'full'::text;
    return;
  end if;

  insert into public.room_members (room_id, user_id)
  values (target_room_id, auth.uid());

  return query select target_room_id, 'joined'::text;
end;
$$;

grant execute on function public.join_room_by_code(text) to authenticated;

commit;
