-- ============================================================
-- 0016_rpc_room_members_for_room.sql
-- Defensive RPC that lists every member of a room as seen from
-- inside a security-definer context. Used by useLeaderboard as a
-- fallback whenever the direct room_members select returns fewer
-- rows than expected (e.g. an environment where 0012 was not yet
-- applied). Strictly read-only — emits only display data.
-- ============================================================

begin;

create or replace function public.room_members_for_room(p_room_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  theme_color text,
  joined_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select rm.user_id,
         p.display_name,
         p.avatar_url,
         p.theme_color,
         rm.joined_at
  from public.room_members rm
  join public.profiles p on p.id = rm.user_id
  where rm.room_id = p_room_id
    and exists (
      select 1 from public.room_members me
      where me.room_id = p_room_id
        and me.user_id = auth.uid()
    )
  order by rm.joined_at asc;
$$;

revoke all on function public.room_members_for_room(uuid) from public;
grant execute on function public.room_members_for_room(uuid) to authenticated;

commit;
