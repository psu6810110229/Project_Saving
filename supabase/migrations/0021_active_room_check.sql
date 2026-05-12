-- ============================================================
-- 0021_active_room_check.sql
-- Enforce the single-active-project-per-creator rule introduced
-- in Phase 6.4 (plan §5):
--   "If a creator already owns one active room, creating another
--    must offer to archive the current one first."
--
-- Server-side helper RPC `active_room_for_creator(uuid)` returns
-- the active room (if any) so the client can render the confirm
-- dialog before posting an INSERT to `rooms`.
--
-- Additionally, we add a soft trigger on `rooms` that auto-archives
-- the caller's previous active room when they INSERT a new one.
-- This is the safety net: even if the client skips the confirm
-- step (third-party clients, tests), the invariant still holds.
-- ============================================================

begin;

create or replace function public.active_room_for_creator(p_user_id uuid)
returns table (
  id uuid,
  name text,
  invite_code text,
  category text,
  end_date date,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.name, r.invite_code, r.category, r.end_date, r.created_at
  from public.rooms r
  where r.created_by = p_user_id
    and r.archived_at is null
  order by r.created_at desc
  limit 1;
$$;

revoke all on function public.active_room_for_creator(uuid) from public;
grant execute on function public.active_room_for_creator(uuid) to authenticated;

create or replace function public._auto_archive_previous_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only act when a brand-new active room is inserted.
  if new.archived_at is not null then
    return new;
  end if;

  update public.rooms
    set archived_at = now()
    where created_by = new.created_by
      and id <> new.id
      and archived_at is null;
  return new;
end;
$$;

drop trigger if exists trg_auto_archive_previous_active on public.rooms;
create trigger trg_auto_archive_previous_active
  after insert on public.rooms
  for each row
  execute function public._auto_archive_previous_active();

commit;
