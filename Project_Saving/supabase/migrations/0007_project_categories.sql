-- ============================================================
-- Step 8 - Project categories for the warm UI rewrite
-- Adds the category picked in CreateProjectForm.
-- ============================================================

begin;

alter table public.rooms
  add column if not exists category text not null default 'travel';

alter table public.rooms
  drop constraint if exists rooms_category_check;

alter table public.rooms
  add constraint rooms_category_check
  check (category in ('travel', 'gadget', 'wedding', 'home', 'other'));

commit;
