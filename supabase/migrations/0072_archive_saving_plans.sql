-- ============================================================
-- 0072_archive_saving_plans.sql
-- Phase 1 / Slice 1.6 - archive legacy Saving Plans without
-- deleting their revisions, pauses, or deposit history.
-- ============================================================

begin;

create or replace function public.archive_saving_plan(
  p_room_id uuid default null,
  p_plan_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.saving_plans%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_plan_id is null and p_room_id is null then
    raise exception 'plan id or room id is required' using errcode = '22023';
  end if;

  select *
    into v_plan
    from public.saving_plans sp
   where sp.user_id = v_user_id
     and sp.archived_at is null
     and (p_plan_id is null or sp.id = p_plan_id)
     and (p_room_id is null or sp.room_id = p_room_id)
   order by sp.created_at desc
   limit 1;

  if not found then
    return null;
  end if;

  if not public.is_room_member(v_plan.room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  update public.saving_plans
     set archived_at = now()
   where id = v_plan.id
     and user_id = v_user_id
     and archived_at is null;

  return v_plan.id;
end;
$$;

revoke all on function public.archive_saving_plan(uuid, uuid) from public;
grant execute on function public.archive_saving_plan(uuid, uuid) to authenticated;

commit;
