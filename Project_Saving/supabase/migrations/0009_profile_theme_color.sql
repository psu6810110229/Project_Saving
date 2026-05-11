-- ============================================================
-- Step 8 - Profile theme swatches
-- Adds the personal color used by Avatar rings and progress accents.
-- ============================================================

begin;

alter table profiles
  add column if not exists theme_color text not null default 'terracotta';

alter table profiles
  drop constraint if exists profiles_theme_color_check;

alter table profiles
  add constraint profiles_theme_color_check
  check (theme_color in ('terracotta', 'slate', 'teal'));

commit;
