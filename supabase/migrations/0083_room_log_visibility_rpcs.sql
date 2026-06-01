-- ============================================================
-- 0083_room_log_visibility_rpcs.sql
-- Room-safe RPCs for recorded deposit reads when deployed RLS on
-- savings_logs is narrower than the current product expectations.
-- ============================================================

begin;

create or replace function public.room_savings_logs_for_room(p_room_id uuid)
returns table (
  id uuid,
  user_id uuid,
  amount numeric,
  note text,
  created_at timestamptz,
  room_id uuid,
  bucket_id uuid,
  slip_url text,
  display_name text,
  bucket_name text
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_room_id is null then
    raise exception 'room id required' using errcode = '22023';
  end if;

  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  return query
    select
      s.id,
      s.user_id,
      s.amount,
      s.note,
      s.created_at,
      s.room_id,
      s.bucket_id,
      s.slip_url,
      p.display_name,
      b.name as bucket_name
    from public.savings_logs s
    left join public.profiles p
      on p.id = s.user_id
    left join public.buckets b
      on b.id = s.bucket_id
    where s.room_id = p_room_id
    order by s.created_at desc;
end;
$$;

revoke all on function public.room_savings_logs_for_room(uuid) from public;
grant execute on function public.room_savings_logs_for_room(uuid) to authenticated;

create or replace function public.member_recorded_deposits_summary(
  p_room_id uuid,
  p_user_id uuid
)
returns table (
  total numeric,
  last_deposit_at timestamptz,
  deposit_day_keys text[]
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_room_id is null or p_user_id is null then
    raise exception 'room id and user id required' using errcode = '22023';
  end if;

  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = p_user_id
  ) then
    raise exception 'target user is not a member of this room' using errcode = '42501';
  end if;

  return query
    with member_logs as (
      select s.amount, s.created_at
      from public.savings_logs s
      where s.room_id = p_room_id
        and s.user_id = p_user_id
    )
    select
      coalesce((select sum(amount) from member_logs), 0)::numeric,
      (select max(created_at) from member_logs),
      coalesce(
        (
          select array_agg(distinct to_char(created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD'))
          from member_logs
        ),
        '{}'::text[]
      );
end;
$$;

revoke all on function public.member_recorded_deposits_summary(uuid, uuid) from public;
grant execute on function public.member_recorded_deposits_summary(uuid, uuid) to authenticated;

create or replace function public.member_bucket_recorded_deposits(
  p_room_id uuid,
  p_user_id uuid
)
returns table (
  bucket_id uuid,
  total numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_room_id is null or p_user_id is null then
    raise exception 'room id and user id required' using errcode = '22023';
  end if;

  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = p_user_id
  ) then
    raise exception 'target user is not a member of this room' using errcode = '42501';
  end if;

  return query
    select
      s.bucket_id,
      coalesce(sum(s.amount), 0)::numeric as total
    from public.savings_logs s
    where s.room_id = p_room_id
      and s.user_id = p_user_id
      and s.bucket_id is not null
    group by s.bucket_id;
end;
$$;

revoke all on function public.member_bucket_recorded_deposits(uuid, uuid) from public;
grant execute on function public.member_bucket_recorded_deposits(uuid, uuid) to authenticated;

commit;
