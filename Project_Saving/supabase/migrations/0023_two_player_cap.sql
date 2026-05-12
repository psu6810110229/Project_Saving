-- ============================================================
-- 0023_two_player_cap.sql
-- Enforce a 2-player maximum per room. The audit found one
-- "Japan 2027" room with 5 members; the product only supports 1:1
-- competition, so this migration:
--   1. Rewrites join_room_by_code so it returns a structured result
--      with a 'full' status when the room already has 2 members.
--   2. Adds a BEFORE INSERT trigger on room_members as a server-side
--      safety net for any other write path (direct INSERT, future
--      RPCs, REST API). Two paths means the cap holds even if a
--      future bug skips the RPC.
-- The creator counts as one of the two members because they are
-- inserted into room_members at room creation time.
-- ============================================================

begin;

create or replace function public.join_room_by_code(code text)
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
  select id into target_room_id
  from public.rooms
  where invite_code = upper(trim(code))
    and archived_at is null
  limit 1;

  if target_room_id is null then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;

  select exists (
    select 1 from public.room_members
    where room_id = target_room_id and user_id = auth.uid()
  ) into is_existing_member;

  if is_existing_member then
    return query select target_room_id, 'already_member'::text;
    return;
  end if;

  select count(*) into member_count
  from public.room_members
  where room_id = target_room_id;

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

-- Belt-and-braces: also enforce the cap directly on room_members so
-- a direct INSERT (e.g. via the REST API) cannot bypass the RPC.
create or replace function public.enforce_two_player_cap()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
begin
  select count(*) into current_count
  from public.room_members
  where room_id = new.room_id;
  if current_count >= 2 then
    raise exception 'room is full (2-player cap)' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_two_player_cap on public.room_members;
create trigger trg_two_player_cap
  before insert on public.room_members
  for each row execute function public.enforce_two_player_cap();

commit;
