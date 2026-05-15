-- ============================================================
-- 0045_profile_ui_language.sql
-- Persist the user's chosen UI language on the profile so the
-- preference follows them across devices. Allowed values: 'en' | 'th'.
-- Task 24.1 (Native Thai UI and i18n - foundation).
-- ============================================================

begin;

alter table public.profiles
  add column if not exists ui_language text not null default 'en';

alter table public.profiles
  drop constraint if exists profiles_ui_language_check;

alter table public.profiles
  add constraint profiles_ui_language_check
  check (ui_language in ('en', 'th'));

commit;
