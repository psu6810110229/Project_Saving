-- ============================================================
-- 0012_fix_room_members_visibility.sql
-- Let room members see the other membership rows in their room
-- without reintroducing recursive RLS on room_members.
-- ============================================================

begin;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

drop policy if exists "room_members_select" on public.room_members;

create policy "room_members_select"
  on public.room_members for select
  to authenticated
  using (public.is_room_member(room_id));

commit;
