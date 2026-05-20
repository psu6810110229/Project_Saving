-- ============================================================
-- 0056_raise_room_capacity_to_7.sql
-- Task 35: raise the per-room member cap from 2 to a constant 7.
--
-- Replaces the cap-enforcement objects from migrations 0023 / 0024:
--   1. Drops trg_two_player_cap + enforce_two_player_cap() and
--      replaces them with trg_room_capacity + enforce_room_capacity()
--      with the new >= 7 constant. The trigger still acts as the
--      direct-write safety net.
--   2. Replaces join_room_by_code(text) with the same return shape
--      and same statuses, but:
--        - Locks the target rooms row FOR UPDATE before counting /
--          inserting so two concurrent RPC joins at 6/7 cannot both
--          insert a 7th member.
--        - Returns 'full' once member_count >= 7.
--
-- The client contract (room_id uuid, status text in
-- {not_found, already_member, full, joined}) is preserved
-- byte-for-byte. No data backfill: existing rooms already have
-- <= 2 members and satisfy the looser cap by construction.
-- ============================================================

begin;

-- 1. Swap the BEFORE INSERT trigger + its function.
drop trigger if exists trg_two_player_cap on public.room_members;
drop function if exists public.enforce_two_player_cap();

create function public.enforce_room_capacity()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
begin
  select count(*) into current_count
  from public.room_members
  where room_id = new.room_id;
  if current_count >= 7 then
    raise exception 'room is full (7-member cap)' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_room_capacity
  before insert on public.room_members
  for each row execute function public.enforce_room_capacity();

-- 2. Replace join_room_by_code so the RPC path is strictly safe at
--    the 7/8 boundary under concurrent calls and so the 'full'
--    branch triggers at >= 7.
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

  -- Serialize concurrent joins against the same room: take a row
  -- lock on the parent rooms row before counting + inserting so two
  -- callers at 6/7 cannot both pass the cap check.
  perform 1
  from public.rooms r
  where r.id = target_room_id
  for update;

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

  -- Enforce the 7-member cap.
  select count(*) into member_count
  from public.room_members rm
  where rm.room_id = target_room_id;

  if member_count >= 7 then
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
