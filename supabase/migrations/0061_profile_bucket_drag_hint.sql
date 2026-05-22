-- ============================================================
-- 0061_profile_bucket_drag_hint.sql
-- Task 40 / Sprint 40.9 — Persist the one-time bucket drag hint
-- at the account level so the hint never re-appears across
-- devices once the user has seen it.
--
-- Plan §13: "Prefer account-level persistence on `profiles`, e.g.
-- `bucket_drag_hint_seen_at`. Do not rely only on localStorage for
-- 'once in their life'."
-- ============================================================

begin;

alter table public.profiles
  add column if not exists bucket_drag_hint_seen_at timestamptz;

commit;
