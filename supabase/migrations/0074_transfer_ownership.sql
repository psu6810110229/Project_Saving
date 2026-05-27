-- ============================================================
-- 0074_transfer_ownership.sql
-- Slice 2.8: Room ownership transfer + rejoin detection
--
-- 1. RPC transfer_room_ownership(p_room_id, p_new_owner_id)
--    - Validates caller is current created_by
--    - Validates new owner is room member
--    - Updates rooms.created_by
--    - Creates notification for all room members
--
-- 2. Extend join_room_by_code to detect rejoining users
--    (users who have existing savings_logs/buckets for a room
--     they are not currently a member of)
--    Returns status 'rejoined' instead of 'joined'.
-- ============================================================

begin;

-- ─── 1. transfer_room_ownership ─────────────────────────────

create or replace function public.transfer_room_ownership(
  p_room_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_room_name text;
  v_is_member boolean;
begin
  -- Caller must be current owner
  if not exists (
    select 1 from public.rooms
    where id = p_room_id
      and created_by = v_caller_id
      and archived_at is null
  ) then
    raise exception 'only the current room creator can transfer ownership'
      using errcode = 'P0001';
  end if;

  -- Cannot transfer to self
  if p_new_owner_id = v_caller_id then
    raise exception 'cannot transfer ownership to yourself'
      using errcode = 'P0001';
  end if;

  -- New owner must be a room member
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and user_id = p_new_owner_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'new owner must be a member of this room'
      using errcode = 'P0001';
  end if;

  -- Get room name for notification
  select name into v_room_name
  from public.rooms
  where id = p_room_id;

  -- Transfer ownership
  update public.rooms
  set created_by = p_new_owner_id
  where id = p_room_id;

  -- Create notifications for all room members
  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    room_id,
    event_key,
    category,
    channel_policy,
    title,
    body,
    target_route,
    fallback_route,
    push_safe,
    payload
  )
  select
    rm.user_id,
    v_caller_id,
    p_room_id,
    'ownership_transferred',
    'partner_activity',
    'in_app',
    'Ownership transferred',
    'Room ownership has been transferred',
    '/manage-project',
    '/dashboard',
    false,
    jsonb_build_object(
      'room_id', p_room_id,
      'room_name', v_room_name,
      'old_owner_id', v_caller_id,
      'new_owner_id', p_new_owner_id
    )
  from public.room_members rm
  where rm.room_id = p_room_id;
end;
$$;

grant execute on function public.transfer_room_ownership(uuid, uuid) to authenticated;

-- ─── 2. Replace join_room_by_code with rejoin detection ─────

drop function if exists public.join_room_by_code(text);

create function public.join_room_by_code(code text)
returns table (room_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
  member_count integer;
  is_existing_member boolean;
  has_prior_data boolean;
begin
  -- Locate an active room with this invite code.
  select r.id into target_room_id
  from public.rooms r
  where r.invite_code = upper(trim(code))
    and r.archived_at is null
  limit 1;

  if target_room_id is null then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;

  -- Serialize concurrent joins against the same room.
  perform 1
  from public.rooms r
  where r.id = target_room_id
  for update;

  -- Already a member?
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = target_room_id
      and rm.user_id = auth.uid()
  ) into is_existing_member;

  if is_existing_member then
    return query select target_room_id, 'already_member'::text;
    return;
  end if;

  -- Enforce the 7-member cap.
  select count(*) into member_count
  from public.room_members rm
  where rm.room_id = target_room_id;

  if member_count >= 7 then
    return query select target_room_id, 'full'::text;
    return;
  end if;

  -- Check for prior data (rejoin detection)
  select exists (
    select 1 from public.savings_logs sl
    where sl.room_id = target_room_id
      and sl.user_id = auth.uid()
    union all
    select 1 from public.buckets b
    where b.room_id = target_room_id
      and b.user_id = auth.uid()
    limit 1
  ) into has_prior_data;

  insert into public.room_members (room_id, user_id)
  values (target_room_id, auth.uid());

  if has_prior_data then
    return query select target_room_id, 'rejoined'::text;
  else
    return query select target_room_id, 'joined'::text;
  end if;
end;
$$;

grant execute on function public.join_room_by_code(text) to authenticated;

commit;
