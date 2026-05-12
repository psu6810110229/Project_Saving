-- ============================================================
-- 0020_room_admin_rpcs.sql
-- RPCs for the Manage Project page: atomic archive + restore that
-- can be called from the client without leaking RLS gaps.
--
-- Both functions check that the caller is the room *creator*
-- (rooms.created_by = auth.uid()). Members other than the creator
-- get a `permission denied` so neither cosmetic nor accidental
-- archives can be triggered by a joiner.
-- ============================================================

begin;

create or replace function public.archive_room(p_room_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_creator uuid;
  v_archived timestamptz := now();
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select created_by into v_creator from public.rooms where id = p_room_id;
  if v_creator is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  if v_creator <> v_caller then
    raise exception 'only the room creator can archive this project'
      using errcode = '42501';
  end if;

  update public.rooms
    set archived_at = v_archived
    where id = p_room_id;

  return v_archived;
end;
$$;

revoke all on function public.archive_room(uuid) from public;
grant execute on function public.archive_room(uuid) to authenticated;

create or replace function public.restore_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_creator uuid;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select created_by into v_creator from public.rooms where id = p_room_id;
  if v_creator is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  if v_creator <> v_caller then
    raise exception 'only the room creator can restore this project'
      using errcode = '42501';
  end if;

  update public.rooms set archived_at = null where id = p_room_id;
end;
$$;

revoke all on function public.restore_room(uuid) from public;
grant execute on function public.restore_room(uuid) to authenticated;

commit;
