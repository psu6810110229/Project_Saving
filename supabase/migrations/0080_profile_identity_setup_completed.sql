-- 0080_profile_identity_setup_completed.sql
--
-- Persist whether the caller has completed the first-run identity wizard
-- (name + optional avatar confirmation) before entering the welcome screen.
-- Existing accounts are backfilled as complete so only genuinely new users
-- see the onboarding gate after this migration lands.

alter table public.profiles
  add column if not exists identity_setup_completed_at timestamptz;

update public.profiles
set identity_setup_completed_at = now()
where identity_setup_completed_at is null;
