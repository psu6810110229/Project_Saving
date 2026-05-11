-- ============================================================
-- Step 8 - Profile theme swatches
-- Adds the personal color used by Avatar rings and progress accents.
-- ============================================================

begin;

alter table public.profiles
  add column if not exists theme_color text not null default 'terracotta';

alter table public.profiles
  drop constraint if exists profiles_theme_color_check;

alter table public.profiles
  add constraint profiles_theme_color_check
  check (theme_color in ('terracotta', 'slate', 'teal'));

commit;
