-- ============================================================
-- 0026_harden_active_room_for_creator.sql
-- Bind active-room lookup to the authenticated caller.
--
-- The original active_room_for_creator(p_user_id) function was a
-- SECURITY DEFINER helper granted to authenticated users. Because it
-- accepted an arbitrary user id, callers could ask for another creator's
-- active room metadata. Prefer the no-argument RPC below for new clients.
-- The old signature is kept only as a guarded compatibility wrapper.
-- ============================================================

begin;

create or replace function public.active_room_for_creator()
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
  where r.created_by = auth.uid()
    and r.archived_at is null
  order by r.created_at desc
  limit 1;
$$;

revoke all on function public.active_room_for_creator() from public;
grant execute on function public.active_room_for_creator() to authenticated;

create or replace function public.active_room_for_creator(p_user_id uuid)
returns table (
  id uuid,
  name text,
  invite_code text,
  category text,
  end_date date,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_user_id is distinct from auth.uid() then
    raise exception 'cannot query another creator active room'
      using errcode = '42501';
  end if;

  return query
    select r.id, r.name, r.invite_code, r.category, r.end_date, r.created_at
    from public.rooms r
    where r.created_by = auth.uid()
      and r.archived_at is null
    order by r.created_at desc
    limit 1;
end;
$$;

revoke all on function public.active_room_for_creator(uuid) from public;
grant execute on function public.active_room_for_creator(uuid) to authenticated;

commit;
