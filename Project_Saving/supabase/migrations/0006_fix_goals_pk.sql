-- ============================================================
-- 0006_fix_goals_pk.sql
-- Change primary key of goals table to (user_id, room_id)
-- to allow one goal per user per room.
-- ============================================================

begin;

-- 1. Drop existing primary key
alter table public.goals drop constraint goals_pkey;

-- 2. Add new composite primary key
alter table public.goals add primary key (user_id, room_id);

commit;
