-- ============================================================
-- 0085_room_visible_momentum_flows.sql
-- Room-visible daily momentum inputs for Team / compare charts.
-- Exposes only aggregate per-day per-bucket movements, never raw
-- notes or other owner-only ledger details.
-- ============================================================

begin;

create or replace function public.room_visible_momentum_flows(
  p_room_id uuid,
  p_days integer default 7
)
returns table (
  user_id uuid,
  bucket_id uuid,
  date_key text,
  amount numeric,
  event_kind text
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_start_date date := ((now() at time zone 'Asia/Bangkok')::date - (greatest(coalesce(p_days, 7), 1) - 1));
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
    with deposits as (
      select
        s.user_id,
        s.bucket_id,
        to_char(s.created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD') as date_key,
        s.amount::numeric as amount,
        'deposit'::text as event_kind
      from public.savings_logs s
      where s.room_id = p_room_id
        and (s.created_at at time zone 'Asia/Bangkok')::date >= v_start_date
    ),
    transfer_in as (
      select
        t.user_id,
        t.destination_bucket_id as bucket_id,
        to_char(t.created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD') as date_key,
        t.amount::numeric as amount,
        'transfer_in'::text as event_kind
      from public.bucket_transfers t
      where t.room_id = p_room_id
        and (t.created_at at time zone 'Asia/Bangkok')::date >= v_start_date
    ),
    transfer_out as (
      select
        t.user_id,
        t.source_bucket_id as bucket_id,
        to_char(t.created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD') as date_key,
        (-t.amount)::numeric as amount,
        'transfer_out'::text as event_kind
      from public.bucket_transfers t
      where t.room_id = p_room_id
        and (t.created_at at time zone 'Asia/Bangkok')::date >= v_start_date
    ),
    allocations as (
      select
        a.user_id,
        a.destination_bucket_id as bucket_id,
        to_char(a.created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD') as date_key,
        a.amount::numeric as amount,
        'allocation'::text as event_kind
      from public.balance_allocations a
      where a.room_id = p_room_id
        and (a.created_at at time zone 'Asia/Bangkok')::date >= v_start_date
    )
    select *
    from (
      select * from deposits
      union all
      select * from transfer_in
      union all
      select * from transfer_out
      union all
      select * from allocations
    ) flows
    order by flows.date_key asc, flows.user_id asc, flows.bucket_id asc nulls last, flows.event_kind asc;
end;
$$;

revoke all on function public.room_visible_momentum_flows(uuid, integer) from public;
grant execute on function public.room_visible_momentum_flows(uuid, integer) to authenticated;

commit;
