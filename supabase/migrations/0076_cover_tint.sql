-- ============================================================
-- 0076_cover_tint.sql
-- Adaptive readability tint for the hero cover image.
--
-- When a member uploads a personal hero cover, the client samples
-- the image and stores a derived tint { rgb:[r,g,b], strength }
-- here. The hero card uses it to darken text zones with a shade of
-- the image's own palette instead of a fixed color. Computed once
-- at upload, applied instantly on every load. Null for legacy
-- covers (they fall back to a neutral scrim).
-- ============================================================

begin;

alter table public.room_members
  add column if not exists cover_tint jsonb;

commit;
