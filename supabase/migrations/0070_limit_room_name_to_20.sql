-- ============================================================
-- 0070_limit_room_name_to_20.sql
--
-- Enforce project/room names at 20 characters after trimming.
-- The NOT VALID check still applies to new inserts/updates while
-- avoiding a deploy failure if old data already has longer names.
-- ============================================================

begin;

alter table public.rooms
  drop constraint if exists rooms_name_length_check;

alter table public.rooms
  add constraint rooms_name_length_check
  check (
    char_length(btrim(name)) between 1 and 20
    and name !~ '[[:cntrl:]]'
  ) not valid;

create or replace function public.rename_room(
  p_room_id uuid,
  p_name text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor       uuid := auth.uid();
  v_old_name    text;
  v_new_name    text;
  v_created_by  uuid;
  v_archived_at timestamptz;
  v_actor_name  text;
  v_bucket      text;
  v_dedupe      text;
  v_title       text;
  v_body        text;
  v_payload     jsonb;
  v_member      record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_room_id is null then
    raise exception 'room id required' using errcode = '22023';
  end if;
  if p_name is null then
    raise exception 'name required' using errcode = '22023';
  end if;

  if p_name ~ '[[:cntrl:]]' then
    raise exception 'name contains control characters' using errcode = '22023';
  end if;

  v_new_name := btrim(p_name);

  if v_new_name = '' then
    raise exception 'name required' using errcode = '22023';
  end if;

  if char_length(v_new_name) > 20 then
    raise exception 'name too long' using errcode = '22023';
  end if;

  select r.name, r.created_by, r.archived_at
    into v_old_name, v_created_by, v_archived_at
    from public.rooms r
   where r.id = p_room_id
   for update;

  if v_created_by is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;

  if v_created_by <> v_actor then
    raise exception 'only the creator can rename this room' using errcode = '42501';
  end if;

  if v_archived_at is not null then
    raise exception 'room is archived' using errcode = '42501';
  end if;

  if btrim(coalesce(v_old_name, '')) = v_new_name then
    return v_new_name;
  end if;

  update public.rooms
     set name = v_new_name
   where id = p_room_id;

  v_actor_name := public._actor_display_name(v_actor);
  v_bucket := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI');
  v_payload := jsonb_build_object(
    'actor_name', v_actor_name,
    'old_name', v_old_name,
    'new_name', v_new_name,
    'room_id', p_room_id
  );

  v_title := 'Project renamed';
  v_body  := v_actor_name || ' renamed "' || coalesce(v_old_name, 'the project')
             || '" to "' || v_new_name || '".';

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = p_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'room_renamed:' || p_room_id::text || ':' || v_bucket;

    perform public._insert_partner_notification(
      v_member.user_id,
      v_actor,
      p_room_id,
      'room_renamed',
      v_dedupe,
      v_title,
      v_body,
      'Open project',
      '/dashboard',
      null,
      '/dashboard',
      false,
      v_payload,
      'rooms',
      p_room_id
    );
  end loop;

  return v_new_name;
end;
$$;

revoke all on function public.rename_room(uuid, text) from public;
grant execute on function public.rename_room(uuid, text) to authenticated;

commit;
