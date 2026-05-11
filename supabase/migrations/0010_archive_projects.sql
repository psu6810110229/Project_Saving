-- ============================================================
-- Step 8 - Archive projects
-- Adds a soft-archive timestamp for the red Archive Project setting.
-- ============================================================

begin;

alter table public.rooms
  add column if not exists archived_at timestamptz;

create index if not exists idx_rooms_archived_at
  on public.rooms (archived_at);

commit;
