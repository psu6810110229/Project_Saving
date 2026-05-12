-- ============================================================
-- 0015_profile_quick_amounts.sql
-- Store per-user quick-add deposit presets.
-- ============================================================

begin;

alter table public.profiles
  add column if not exists quick_add_amounts integer[] not null default array[100, 500, 1000, 2000];

alter table public.profiles
  drop constraint if exists profiles_quick_add_amounts_check;

alter table public.profiles
  add constraint profiles_quick_add_amounts_check
  check (
    array_length(quick_add_amounts, 1) between 1 and 6
    and 0 < all(quick_add_amounts)
  );

commit;
