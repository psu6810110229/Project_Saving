-- ============================================================
-- 0067_fix_transfer_archive_zero_balance_idempotency.sql
-- Hotfix: transfer_and_archive_bucket previously used bucket_transfers
-- as its only idempotency record. When the source balance was zero,
-- no transfer row was created, so a retry could see the archived
-- source and fail instead of returning reused = true.
--
-- The archive activity now stores client_request_id, and the RPC can
-- replay a zero-balance archive from that activity row.
-- ============================================================

begin;

create index if not exists idx_activity_events_transfer_archive_request
  on public.activity_events (
    actor_user_id,
    source_id,
    ((payload ->> 'client_request_id'))
  )
  where event_key = 'bucket_removed'
    and source_table = 'buckets';

create or replace function public.transfer_and_archive_bucket(
  p_source_bucket_id uuid,
  p_destination_bucket_id uuid,
  p_note text default null,
  p_client_request_id uuid default null
)
returns table (
  transfer_id uuid,
  bucket_id uuid,
  archived_at timestamptz,
  archived_by uuid,
  amount numeric,
  source_balance_after numeric,
  destination_balance_after numeric,
  transfer_activity_id uuid,
  archive_activity_id uuid,
  reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_note        text;
  v_existing    public.bucket_transfers%rowtype;
  v_existing_archive record;
  v_existing_transfer_id uuid;
  v_existing_transfer_activity uuid;
  v_existing_archive_activity uuid;
  v_existing_archive_amount numeric(12,2);
  v_lock_first  uuid;
  v_lock_second uuid;
  v_source      record;
  v_destination record;
  v_room_id     uuid;
  v_balance     numeric(12,2);
  v_transfer_id uuid;
  v_transfer_activity_id uuid;
  v_archive_activity_id  uuid;
  v_now         timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501', hint = 'archive_unauthenticated';
  end if;
  if p_source_bucket_id is null or p_destination_bucket_id is null then
    raise exception 'source and destination bucket ids required'
      using errcode = '22023', hint = 'archive_invalid_request';
  end if;
  if p_client_request_id is null then
    raise exception 'client_request_id required'
      using errcode = '22023', hint = 'archive_invalid_request';
  end if;
  if p_source_bucket_id = p_destination_bucket_id then
    raise exception 'source and destination buckets must differ'
      using errcode = '22023', hint = 'archive_same_bucket';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and length(v_note) > 280 then
    raise exception 'note is too long'
      using errcode = '22023', hint = 'archive_invalid_request';
  end if;

  -- Idempotency for requests that moved a positive amount. This also
  -- preserves compatibility with rows created before this hotfix.
  select * into v_existing
    from public.bucket_transfers
   where user_id = v_user_id
     and client_request_id = p_client_request_id
   limit 1;

  if found then
    if v_existing.source_bucket_id <> p_source_bucket_id
       or v_existing.destination_bucket_id <> p_destination_bucket_id then
      raise exception 'client_request_id already used with different parameters'
        using errcode = '22023', hint = 'archive_invalid_request';
    end if;

    select ae.id into v_existing_transfer_activity
      from public.activity_events ae
     where ae.event_key = 'bucket_transfer_created'
       and ae.source_table = 'bucket_transfers'
       and ae.source_id = v_existing.id
     limit 1;

    select ae.id into v_existing_archive_activity
      from public.activity_events ae
     where ae.event_key = 'bucket_removed'
       and ae.source_table = 'buckets'
       and ae.source_id = p_source_bucket_id
     order by ae.created_at desc
     limit 1;

    select b.id, b.user_id, b.room_id, b.name, b.archived_at, b.archived_by
      into v_source
      from public.buckets b
     where b.id = p_source_bucket_id;

    return query
      select v_existing.id,
             v_source.id, v_source.archived_at, v_source.archived_by,
             v_existing.amount,
             public.bucket_balance(p_source_bucket_id),
             public.bucket_balance(p_destination_bucket_id),
             v_existing_transfer_activity,
             v_existing_archive_activity,
             true;
    return;
  end if;

  if p_source_bucket_id < p_destination_bucket_id then
    v_lock_first  := p_source_bucket_id;
    v_lock_second := p_destination_bucket_id;
  else
    v_lock_first  := p_destination_bucket_id;
    v_lock_second := p_source_bucket_id;
  end if;
  perform 1 from public.buckets where id = v_lock_first  for update;
  perform 1 from public.buckets where id = v_lock_second for update;

  select b.id, b.user_id, b.room_id, b.name, b.archived_at, b.archived_by
    into v_source
    from public.buckets b
   where b.id = p_source_bucket_id;
  if not found then
    raise exception 'source bucket not found'
      using errcode = 'P0002', hint = 'archive_source_missing';
  end if;
  if v_source.user_id <> v_user_id then
    raise exception 'source bucket is not owned by caller'
      using errcode = '42501', hint = 'archive_partner_source';
  end if;
  if v_source.archived_at is not null then
    -- Idempotency for zero-balance transfer-and-archive calls, where
    -- no bucket_transfers row exists. Re-check after the row lock so a
    -- concurrent duplicate request sees the activity committed by the
    -- winner before deciding whether to fail.
    select ae.id, ae.payload, ae.created_at
      into v_existing_archive
      from public.activity_events ae
     where ae.event_key = 'bucket_removed'
       and ae.source_table = 'buckets'
       and ae.source_id = p_source_bucket_id
       and ae.actor_user_id = v_user_id
       and ae.payload ->> 'client_request_id' = p_client_request_id::text
     order by ae.created_at desc
     limit 1;

    if found then
      if coalesce(v_existing_archive.payload ->> 'destination_bucket_id', '') <> p_destination_bucket_id::text then
        raise exception 'client_request_id already used with different parameters'
          using errcode = '22023', hint = 'archive_invalid_request';
      end if;

      v_existing_transfer_id := nullif(v_existing_archive.payload ->> 'transfer_id', '')::uuid;
      v_existing_archive_amount := coalesce(
        nullif(v_existing_archive.payload ->> 'transferred_amount', '')::numeric,
        0
      );

      if v_existing_transfer_id is not null then
        select ae.id into v_existing_transfer_activity
          from public.activity_events ae
         where ae.event_key = 'bucket_transfer_created'
           and ae.source_table = 'bucket_transfers'
           and ae.source_id = v_existing_transfer_id
         limit 1;
      end if;

      return query
        select v_existing_transfer_id,
               v_source.id, v_source.archived_at, v_source.archived_by,
               v_existing_archive_amount,
               public.bucket_balance(p_source_bucket_id),
               public.bucket_balance(p_destination_bucket_id),
               v_existing_transfer_activity,
               v_existing_archive.id,
               true;
      return;
    end if;

    raise exception 'source bucket is archived'
      using errcode = '22023', hint = 'archive_source_archived';
  end if;

  select b.id, b.user_id, b.room_id, b.name, b.archived_at
    into v_destination
    from public.buckets b
   where b.id = p_destination_bucket_id;
  if not found then
    raise exception 'destination bucket not found'
      using errcode = 'P0002', hint = 'archive_destination_missing';
  end if;
  if v_destination.user_id <> v_user_id then
    raise exception 'destination bucket is not owned by caller'
      using errcode = '42501', hint = 'archive_partner_destination';
  end if;
  if v_destination.archived_at is not null then
    raise exception 'destination bucket is archived'
      using errcode = '22023', hint = 'archive_destination_archived';
  end if;
  if v_source.room_id <> v_destination.room_id then
    raise exception 'buckets must be in the same room'
      using errcode = '22023', hint = 'archive_cross_room';
  end if;

  v_room_id := v_source.room_id;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room'
      using errcode = '42501', hint = 'archive_not_room_member';
  end if;

  v_balance := public.bucket_balance(p_source_bucket_id);
  if v_balance > 0 then
    insert into public.bucket_transfers (
      room_id, user_id, source_bucket_id, destination_bucket_id,
      amount, note, client_request_id, created_at
    ) values (
      v_room_id, v_user_id, p_source_bucket_id, p_destination_bucket_id,
      v_balance, v_note, p_client_request_id, v_now
    )
    returning id into v_transfer_id;

    insert into public.activity_events (
      room_id, actor_user_id, event_key,
      source_table, source_id,
      bucket_id, target_bucket_id, amount, payload, created_at
    ) values (
      v_room_id, v_user_id, 'bucket_transfer_created',
      'bucket_transfers', v_transfer_id,
      p_source_bucket_id, p_destination_bucket_id, v_balance,
      jsonb_build_object(
        'transfer_id', v_transfer_id,
        'source_bucket_id', p_source_bucket_id,
        'source_bucket_name', v_source.name,
        'destination_bucket_id', p_destination_bucket_id,
        'destination_bucket_name', v_destination.name,
        'amount', v_balance,
        'has_note', v_note is not null,
        'origin', 'transfer_and_archive'
      ),
      v_now
    )
    returning id into v_transfer_activity_id;
  end if;

  update public.buckets
     set archived_at = v_now,
         archived_by = v_user_id
   where public.buckets.id = p_source_bucket_id
     and public.buckets.archived_at is null;

  insert into public.activity_events (
    room_id, actor_user_id, event_key,
    source_table, source_id,
    bucket_id, target_bucket_id, payload, created_at
  ) values (
    v_room_id, v_user_id, 'bucket_removed',
    'buckets', p_source_bucket_id,
    p_source_bucket_id, p_destination_bucket_id,
    jsonb_build_object(
      'bucket_id', p_source_bucket_id,
      'bucket_name', v_source.name,
      'destination_bucket_id', p_destination_bucket_id,
      'destination_bucket_name', v_destination.name,
      'transferred_amount', coalesce(v_balance, 0),
      'transfer_id', v_transfer_id,
      'client_request_id', p_client_request_id,
      'reason', 'transfer_and_archive'
    ),
    v_now
  )
  returning id into v_archive_activity_id;

  return query
    select v_transfer_id,
           p_source_bucket_id, v_now, v_user_id,
           coalesce(v_balance, 0),
           public.bucket_balance(p_source_bucket_id),
           public.bucket_balance(p_destination_bucket_id),
           v_transfer_activity_id,
           v_archive_activity_id,
           false;
end;
$$;

revoke all on function public.transfer_and_archive_bucket(uuid, uuid, text, uuid) from public;
grant execute on function public.transfer_and_archive_bucket(uuid, uuid, text, uuid) to authenticated;

commit;
