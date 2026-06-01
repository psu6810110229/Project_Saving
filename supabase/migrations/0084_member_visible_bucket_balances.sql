-- ============================================================
-- 0084_member_visible_bucket_balances.sql
-- Member-visible aggregate balance RPCs for leaderboard / member
-- detail surfaces. These expose only room-safe totals, never raw
-- allocation or transfer rows.
-- ============================================================

begin;

create or replace function public.room_member_visible_balances(p_room_id uuid)
returns table (
  user_id uuid,
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

  if p_room_id is null then
    raise exception 'room id required' using errcode = '22023';
  end if;

  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  return query
    with members as (
      select rm.user_id
      from public.room_members rm
      where rm.room_id = p_room_id
    ),
    logs as (
      select s.user_id, coalesce(sum(s.amount), 0)::numeric as total
      from public.savings_logs s
      where s.room_id = p_room_id
      group by s.user_id
    ),
    allocations as (
      select a.user_id, coalesce(sum(a.amount), 0)::numeric as total
      from public.balance_allocations a
      where a.room_id = p_room_id
      group by a.user_id
    ),
    transfer_in as (
      select t.user_id, coalesce(sum(t.amount), 0)::numeric as total
      from public.bucket_transfers t
      where t.room_id = p_room_id
      group by t.user_id
    ),
    transfer_out as (
      select t.user_id, coalesce(sum(t.amount), 0)::numeric as total
      from public.bucket_transfers t
      where t.room_id = p_room_id
      group by t.user_id
    )
    select
      m.user_id,
      coalesce(l.total, 0)
        + coalesce(a.total, 0)
        + coalesce(ti.total, 0)
        - coalesce(to2.total, 0) as total
    from members m
    left join logs l
      on l.user_id = m.user_id
    left join allocations a
      on a.user_id = m.user_id
    left join transfer_in ti
      on ti.user_id = m.user_id
    left join transfer_out to2
      on to2.user_id = m.user_id;
end;
$$;

revoke all on function public.room_member_visible_balances(uuid) from public;
grant execute on function public.room_member_visible_balances(uuid) to authenticated;

create or replace function public.member_visible_balance_summary(
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
    ),
    log_total as (
      select coalesce(sum(amount), 0)::numeric as value
      from member_logs
    ),
    allocation_total as (
      select coalesce(sum(a.amount), 0)::numeric as value
      from public.balance_allocations a
      where a.room_id = p_room_id
        and a.user_id = p_user_id
    ),
    transfer_in_total as (
      select coalesce(sum(t.amount), 0)::numeric as value
      from public.bucket_transfers t
      where t.room_id = p_room_id
        and t.user_id = p_user_id
    ),
    transfer_out_total as (
      select coalesce(sum(t.amount), 0)::numeric as value
      from public.bucket_transfers t
      where t.room_id = p_room_id
        and t.user_id = p_user_id
    )
    select
      (select value from log_total)
      + (select value from allocation_total)
      + (select value from transfer_in_total)
      - (select value from transfer_out_total) as total,
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

revoke all on function public.member_visible_balance_summary(uuid, uuid) from public;
grant execute on function public.member_visible_balance_summary(uuid, uuid) to authenticated;

create or replace function public.member_bucket_visible_balances(
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
    with member_buckets as (
      select b.id
      from public.buckets b
      where b.room_id = p_room_id
        and b.user_id = p_user_id
    ),
    logs as (
      select s.bucket_id, coalesce(sum(s.amount), 0)::numeric as total
      from public.savings_logs s
      where s.room_id = p_room_id
        and s.user_id = p_user_id
        and s.bucket_id is not null
      group by s.bucket_id
    ),
    allocations as (
      select a.destination_bucket_id as bucket_id, coalesce(sum(a.amount), 0)::numeric as total
      from public.balance_allocations a
      where a.room_id = p_room_id
        and a.user_id = p_user_id
      group by a.destination_bucket_id
    ),
    transfer_in as (
      select t.destination_bucket_id as bucket_id, coalesce(sum(t.amount), 0)::numeric as total
      from public.bucket_transfers t
      where t.room_id = p_room_id
        and t.user_id = p_user_id
      group by t.destination_bucket_id
    ),
    transfer_out as (
      select t.source_bucket_id as bucket_id, coalesce(sum(t.amount), 0)::numeric as total
      from public.bucket_transfers t
      where t.room_id = p_room_id
        and t.user_id = p_user_id
      group by t.source_bucket_id
    )
    select
      mb.id as bucket_id,
      coalesce(l.total, 0)
        + coalesce(a.total, 0)
        + coalesce(ti.total, 0)
        - coalesce(to2.total, 0) as total
    from member_buckets mb
    left join logs l
      on l.bucket_id = mb.id
    left join allocations a
      on a.bucket_id = mb.id
    left join transfer_in ti
      on ti.bucket_id = mb.id
    left join transfer_out to2
      on to2.bucket_id = mb.id;
end;
$$;

revoke all on function public.member_bucket_visible_balances(uuid, uuid) from public;
grant execute on function public.member_bucket_visible_balances(uuid, uuid) to authenticated;

commit;
