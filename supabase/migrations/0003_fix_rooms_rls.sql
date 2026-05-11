-- ============================================================
-- 0003_fix_rooms_rls.sql
-- Applies missing RLS policies for rooms & room_members.
-- Run this because 0002 partially ran (tables exist) but the
-- policy block may not have been committed.
-- Safe to re-run: all drops are IF EXISTS.
-- ============================================================

begin;

-- ── Ensure RLS is ON ──────────────────────────────────────────
alter table rooms        enable row level security;
alter table room_members enable row level security;

-- ── rooms policies ────────────────────────────────────────────
drop policy if exists "rooms_select_member"  on rooms;
drop policy if exists "rooms_select_creator" on rooms;
drop policy if exists "rooms_insert_authed"  on rooms;
drop policy if exists "rooms_update_creator" on rooms;
drop policy if exists "rooms_delete_creator" on rooms;

-- Members can see rooms they joined
create policy "rooms_select_member"
  on rooms for select
  using (
    exists (
      select 1 from room_members rm
      where rm.room_id = rooms.id and rm.user_id = auth.uid()
    )
  );

-- Creator can ALSO see their room immediately after INSERT
-- (before they are added to room_members, .insert().select() would
--  otherwise get a 403 because the member policy hasn't been satisfied yet)
create policy "rooms_select_creator"
  on rooms for select
  using (created_by = auth.uid());

create policy "rooms_insert_authed"
  on rooms for insert
  with check (auth.uid() is not null);

create policy "rooms_update_creator"
  on rooms for update
  using (created_by = auth.uid());

create policy "rooms_delete_creator"
  on rooms for delete
  using (created_by = auth.uid());

-- ── room_members policies ─────────────────────────────────────
drop policy if exists "room_members_select"      on room_members;
drop policy if exists "room_members_insert_self" on room_members;
drop policy if exists "room_members_delete_self" on room_members;

-- Simple check: users can only see their OWN membership rows.
-- DO NOT use a subquery on room_members here — it causes infinite
-- RLS recursion (500 Internal Server Error).
create policy "room_members_select"
  on room_members for select
  using (user_id = auth.uid());

create policy "room_members_insert_self"
  on room_members for insert
  with check (user_id = auth.uid());

create policy "room_members_delete_self"
  on room_members for delete
  using (user_id = auth.uid());

-- ── goals policies ────────────────────────────────────────────
drop policy if exists "Users can insert their own goal"    on goals;
drop policy if exists "Users can select their own goal"    on goals;
drop policy if exists "Users can update their own goal"    on goals;
drop policy if exists "Users can upsert their own goal"    on goals;
drop policy if exists "Users can read all goals"           on goals;
drop policy if exists "Members can read goals in their rooms" on goals;
drop policy if exists "goals_member_select"                on goals;
drop policy if exists "goals_own_upsert"                   on goals;
drop policy if exists "goals_own_update"                   on goals;

create policy "goals_member_select"
  on goals for select
  using (
    exists (
      select 1 from room_members rm
      where rm.room_id = goals.room_id and rm.user_id = auth.uid()
    )
  );

create policy "goals_own_upsert"
  on goals for insert
  with check (user_id = auth.uid());

create policy "goals_own_update"
  on goals for update
  using (user_id = auth.uid());

-- ── savings_logs policies ─────────────────────────────────────
drop policy if exists "Users can insert their own logs"        on savings_logs;
drop policy if exists "Users can select all logs"              on savings_logs;
drop policy if exists "Members can read logs in their rooms"   on savings_logs;
drop policy if exists "logs_member_select"                     on savings_logs;
drop policy if exists "logs_own_insert"                        on savings_logs;

create policy "logs_member_select"
  on savings_logs for select
  using (
    exists (
      select 1 from room_members rm
      where rm.room_id = savings_logs.room_id and rm.user_id = auth.uid()
    )
  );

create policy "logs_own_insert"
  on savings_logs for insert
  with check (user_id = auth.uid());

commit;
