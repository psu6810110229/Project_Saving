-- ============================================================
-- 0077_room_preview_by_code.sql
-- Read-only preview for the Join Project flow.
--
-- Before this migration the client showed a faked "preview" card
-- (generic icon + the raw code as a name) because a non-member
-- cannot SELECT the target room directly under RLS. This adds a
-- security-definer RPC that returns just enough public-facing
-- metadata about a room — given its invite code — to render a
-- real preview (name, category, goal, creator, member count)
-- before the user commits to joining.
--
-- Status mirrors join_room_by_code so the preview and the join
-- button agree:
--   found          -> room exists and the caller can join
--   already_member -> caller is already in this room
--   full           -> room already has the 7-member cap
--   not_found      -> no active room for this code
--
-- Read-only: no inserts/updates. Validates auth.uid() is present.
-- Only exposes the creator's display name + avatar (already shared
-- with room members elsewhere) and aggregate counts — no member
-- list, no balances, no private data.
-- ============================================================

begin;

drop function if exists public.room_preview_by_code(text);

create function public.room_preview_by_code(code text)
returns table (
  room_id uuid,
  name text,
  category text,
  target_amount numeric,
  end_date date,
  cover_image_url text,
  member_count integer,
  creator_name text,
  creator_avatar_url text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms%rowtype;
  members integer;
  is_existing_member boolean;
  result_status text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  -- Locate an active room with this invite code.
  select r.* into target_room
  from public.rooms r
  where r.invite_code = upper(trim(code))
    and r.archived_at is null
  limit 1;

  if target_room.id is null then
    return query
      select null::uuid, null::text, null::text, null::numeric, null::date,
             null::text, null::integer, null::text, null::text, 'not_found'::text;
    return;
  end if;

  select count(*) into members
  from public.room_members rm
  where rm.room_id = target_room.id;

  select exists (
    select 1 from public.room_members rm
    where rm.room_id = target_room.id
      and rm.user_id = auth.uid()
  ) into is_existing_member;

  if is_existing_member then
    result_status := 'already_member';
  elsif members >= 7 then
    result_status := 'full';
  else
    result_status := 'found';
  end if;

  return query
  select
    target_room.id,
    target_room.name,
    target_room.category::text,
    target_room.target_amount,
    target_room.end_date,
    target_room.cover_image_url,
    members,
    p.display_name,
    p.avatar_url,
    result_status
  from (select target_room.created_by as creator_id) src
  left join public.profiles p on p.id = src.creator_id;
end;
$$;

grant execute on function public.room_preview_by_code(text) to authenticated;

commit;
