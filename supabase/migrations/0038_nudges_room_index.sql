-- ============================================================
-- 0038_nudges_room_index.sql
-- Task 23.2 — Nudge hardening.
--
-- The hardened send-nudge edge function throttles by
-- (from_user, to_user, room_id) so a future multi-room user can't
-- be globally throttled by an unrelated nudge. Adds the matching
-- composite index. The old (from_user, to_user, created_at desc)
-- index from 0022 is kept for backwards compatibility — existing
-- rows with room_id = null still benefit from it.
-- ============================================================

begin;

create index if not exists idx_nudges_from_to_room_time
  on public.nudges (from_user, to_user, room_id, created_at desc);

commit;
