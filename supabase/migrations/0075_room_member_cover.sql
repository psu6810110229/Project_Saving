-- ============================================================
-- 0075_room_member_cover.sql
-- Per-user hero card cover image.
--
-- Each member can set their own cover image for a room, visible
-- only to them. Stored on room_members so it is scoped per
-- (room_id, user_id). Falls back to rooms.cover_image_url in the
-- client when a member has not set their own.
-- ============================================================

begin;

-- ─── 1. room_members.cover_image_url ────────────────────────

alter table public.room_members
  add column if not exists cover_image_url text;

-- ─── 2. RLS: members may update only their own membership row ─

drop policy if exists "room_members_update_self" on public.room_members;

create policy "room_members_update_self"
  on public.room_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
