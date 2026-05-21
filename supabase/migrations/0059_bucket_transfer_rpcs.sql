-- ============================================================
-- 0059_bucket_transfer_rpcs.sql
-- Task 40 / Sprint 40.3 — Secure server-side RPCs for the
-- bucket transfer + archive flow.
--
-- Adds:
--   * bucket_balance(p_bucket_id)             — deposits + in - out
--   * transfer_bucket_money(...)              — atomic same-user transfer
--   * archive_bucket(p_bucket_id)             — zero-balance archive
--   * transfer_and_archive_bucket(...)        — combined move + archive
--
-- Hard rules (plan §2, §8, §9):
--   * Same user only. Source.user_id and destination.user_id must
--     equal auth.uid().
--   * Same room. Source.room_id must equal destination.room_id.
--   * Caller must be a member of that room.
--   * Both buckets must be active (archived_at IS NULL).
--   * source_bucket_id <> destination_bucket_id.
--   * Amount > 0, rounded to 2 decimals.
--   * Source balance (deposits + incoming transfers − outgoing
--     transfers) must be ≥ requested amount.
--   * client_request_id required for transfers — duplicates
--     resolve to the original row instead of double-moving money.
--   * archive_bucket refuses non-zero balance and the user's last
--     active bucket in the room. Already-archived buckets resolve
--     idempotently.
--   * Notes (plan §10) stay owner-only — activity payload carries
--     `has_note`, never the raw text. Owners read the text from
--     bucket_transfers (RLS scoped to user_id = auth.uid()).
--
-- All four functions are SECURITY DEFINER with `search_path = public`
-- and grant EXECUTE only to authenticated. Direct client writes to
-- bucket_transfers / activity_events / buckets remain governed by
-- the policies set in 0058 / 0004 — these RPCs are the only normal
-- write path for transfer + archive.
--
-- Error hints (plan §16): every raised exception carries a stable
-- HINT token (e.g. `transfer_same_bucket`, `archive_nonzero_balance`).
-- PostgREST surfaces it as the `hint` field, which the frontend
-- maps to user-facing copy in the next slice.
-- ============================================================

begin;

-- 1. bucket_balance helper ------------------------------------------------
-- Deposit-based balance is augmented with incoming/outgoing transfers
-- so the saving plan and dashboard can read one canonical number.
-- security definer to bypass the bucket-row RLS join for the inner
-- subqueries; visibility is still constrained because callers only
-- know bucket ids they can see through RLS (own + co-member).
create or replace function public.bucket_balance(p_bucket_id uuid)
returns numeric
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
      select sum(l.amount)
        from public.savings_logs l
       where l.bucket_id = p_bucket_id
    ), 0)
    + coalesce((
      select sum(t.amount)
        from public.bucket_transfers t
       where t.destination_bucket_id = p_bucket_id
    ), 0)
    - coalesce((
      select sum(t.amount)
        from public.bucket_transfers t
       where t.source_bucket_id = p_bucket_id
    ), 0);
$$;

revoke all on function public.bucket_balance(uuid) from public;
grant execute on function public.bucket_balance(uuid) to authenticated;

-- 2. transfer_bucket_money ------------------------------------------------
create or replace function public.transfer_bucket_money(
  p_source_bucket_id uuid,
  p_destination_bucket_id uuid,
  p_amount numeric,
  p_note text default null,
  p_client_request_id uuid default null
)
returns table (
  transfer_id uuid,
  source_bucket_id uuid,
  destination_bucket_id uuid,
  amount numeric,
  source_balance_after numeric,
  destination_balance_after numeric,
  activity_id uuid,
  reused boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_amount      numeric(12,2);
  v_note        text;
  v_existing    public.bucket_transfers%rowtype;
  v_existing_activity uuid;
  v_lock_first  uuid;
  v_lock_second uuid;
  v_source      record;
  v_destination record;
  v_room_id     uuid;
  v_source_balance numeric(12,2);
  v_transfer_id uuid;
  v_activity_id uuid;
  v_now         timestamptz := now();
begin
  -- ── Argument validation ──
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501', hint = 'transfer_unauthenticated';
  end if;
  if p_source_bucket_id is null or p_destination_bucket_id is null then
    raise exception 'source and destination bucket ids required'
      using errcode = '22023', hint = 'transfer_invalid_request';
  end if;
  if p_client_request_id is null then
    raise exception 'client_request_id required'
      using errcode = '22023', hint = 'transfer_invalid_request';
  end if;
  if p_source_bucket_id = p_destination_bucket_id then
    raise exception 'source and destination buckets must differ'
      using errcode = '22023', hint = 'transfer_same_bucket';
  end if;
  if p_amount is null then
    raise exception 'amount required'
      using errcode = '22023', hint = 'transfer_invalid_amount';
  end if;

  v_amount := round(p_amount::numeric, 2);
  if v_amount <= 0 then
    raise exception 'amount must be greater than zero'
      using errcode = '22023', hint = 'transfer_invalid_amount';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and length(v_note) > 280 then
    raise exception 'note is too long'
      using errcode = '22023', hint = 'transfer_invalid_request';
  end if;

  -- ── Idempotency short-circuit ──
  -- A retried double-submit (same client_request_id) returns the
  -- original transfer instead of creating a second money movement.
  -- The (user_id, room_id, client_request_id) unique constraint on
  -- bucket_transfers also defends in depth; this lookup is the
  -- cooperative path.
  select * into v_existing
    from public.bucket_transfers
   where user_id = v_user_id
     and client_request_id = p_client_request_id
   limit 1;

  if found then
    -- Defence in depth: same request id with a different payload is
    -- a client bug, not a retry. Surface it loudly rather than
    -- silently returning the prior row.
    if v_existing.source_bucket_id <> p_source_bucket_id
       or v_existing.destination_bucket_id <> p_destination_bucket_id
       or v_existing.amount <> v_amount then
      raise exception 'client_request_id already used with different transfer'
        using errcode = '22023', hint = 'transfer_invalid_request';
    end if;

    select id into v_existing_activity
      from public.activity_events
     where event_key = 'bucket_transfer_created'
       and source_table = 'bucket_transfers'
       and source_id = v_existing.id
     limit 1;

    return query
      select v_existing.id,
             v_existing.source_bucket_id,
             v_existing.destination_bucket_id,
             v_existing.amount,
             public.bucket_balance(v_existing.source_bucket_id),
             public.bucket_balance(v_existing.destination_bucket_id),
             v_existing_activity,
             true,
             v_existing.created_at;
    return;
  end if;

  -- ── Row locks ──
  -- Lock both bucket rows in id-order to keep concurrent transfers
  -- with the source/destination swapped from deadlocking each other.
  if p_source_bucket_id < p_destination_bucket_id then
    v_lock_first  := p_source_bucket_id;
    v_lock_second := p_destination_bucket_id;
  else
    v_lock_first  := p_destination_bucket_id;
    v_lock_second := p_source_bucket_id;
  end if;
  perform 1 from public.buckets where id = v_lock_first  for update;
  perform 1 from public.buckets where id = v_lock_second for update;

  -- ── Load and validate source ──
  select b.id, b.user_id, b.room_id, b.name, b.archived_at
    into v_source
    from public.buckets b
   where b.id = p_source_bucket_id;
  if not found then
    raise exception 'source bucket not found'
      using errcode = 'P0002', hint = 'transfer_source_missing';
  end if;
  if v_source.user_id <> v_user_id then
    raise exception 'source bucket is not owned by caller'
      using errcode = '42501', hint = 'transfer_partner_source';
  end if;
  if v_source.archived_at is not null then
    raise exception 'source bucket is archived'
      using errcode = '22023', hint = 'transfer_source_archived';
  end if;

  -- ── Load and validate destination ──
  select b.id, b.user_id, b.room_id, b.name, b.archived_at
    into v_destination
    from public.buckets b
   where b.id = p_destination_bucket_id;
  if not found then
    raise exception 'destination bucket not found'
      using errcode = 'P0002', hint = 'transfer_destination_missing';
  end if;
  if v_destination.user_id <> v_user_id then
    raise exception 'destination bucket is not owned by caller'
      using errcode = '42501', hint = 'transfer_partner_destination';
  end if;
  if v_destination.archived_at is not null then
    raise exception 'destination bucket is archived'
      using errcode = '22023', hint = 'transfer_destination_archived';
  end if;
  if v_source.room_id <> v_destination.room_id then
    raise exception 'buckets must be in the same room'
      using errcode = '22023', hint = 'transfer_cross_room';
  end if;

  v_room_id := v_source.room_id;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room'
      using errcode = '42501', hint = 'transfer_not_room_member';
  end if;

  -- ── Balance check ──
  v_source_balance := public.bucket_balance(p_source_bucket_id);
  if v_source_balance < v_amount then
    raise exception 'source bucket has insufficient balance'
      using errcode = '22023',
            hint = 'transfer_insufficient_balance',
            detail = format('available=%s, requested=%s', v_source_balance, v_amount);
  end if;

  -- ── Append-only transfer + activity ──
  insert into public.bucket_transfers (
    room_id, user_id, source_bucket_id, destination_bucket_id,
    amount, note, client_request_id, created_at
  ) values (
    v_room_id, v_user_id, p_source_bucket_id, p_destination_bucket_id,
    v_amount, v_note, p_client_request_id, v_now
  )
  returning id into v_transfer_id;

  insert into public.activity_events (
    room_id, actor_user_id, event_key,
    source_table, source_id,
    bucket_id, target_bucket_id, amount,
    payload, created_at
  ) values (
    v_room_id, v_user_id, 'bucket_transfer_created',
    'bucket_transfers', v_transfer_id,
    p_source_bucket_id, p_destination_bucket_id, v_amount,
    jsonb_build_object(
      'transfer_id', v_transfer_id,
      'source_bucket_id', p_source_bucket_id,
      'source_bucket_name', v_source.name,
      'destination_bucket_id', p_destination_bucket_id,
      'destination_bucket_name', v_destination.name,
      'amount', v_amount,
      'has_note', v_note is not null
    ),
    v_now
  )
  returning id into v_activity_id;

  return query
    select v_transfer_id,
           p_source_bucket_id,
           p_destination_bucket_id,
           v_amount,
           public.bucket_balance(p_source_bucket_id),
           public.bucket_balance(p_destination_bucket_id),
           v_activity_id,
           false,
           v_now;
end;
$$;

revoke all on function public.transfer_bucket_money(uuid, uuid, numeric, text, uuid) from public;
grant execute on function public.transfer_bucket_money(uuid, uuid, numeric, text, uuid) to authenticated;

-- 3. archive_bucket -------------------------------------------------------
create or replace function public.archive_bucket(
  p_bucket_id uuid
)
returns table (
  bucket_id uuid,
  archived_at timestamptz,
  archived_by uuid,
  activity_id uuid,
  reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_bucket      record;
  v_balance     numeric(12,2);
  v_active_left int;
  v_activity_id uuid;
  v_existing_activity uuid;
  v_now         timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501', hint = 'archive_unauthenticated';
  end if;
  if p_bucket_id is null then
    raise exception 'bucket id required'
      using errcode = '22023', hint = 'archive_invalid_request';
  end if;

  perform 1 from public.buckets where id = p_bucket_id for update;

  select b.id, b.user_id, b.room_id, b.name, b.archived_at, b.archived_by
    into v_bucket
    from public.buckets b
   where b.id = p_bucket_id;
  if not found then
    raise exception 'bucket not found'
      using errcode = 'P0002', hint = 'archive_bucket_missing';
  end if;
  if v_bucket.user_id <> v_user_id then
    raise exception 'bucket is not owned by caller'
      using errcode = '42501', hint = 'archive_partner_bucket';
  end if;

  -- ── Idempotent already-archived path ──
  -- Double-click protection. Returns the original archive record.
  if v_bucket.archived_at is not null then
    select id into v_existing_activity
      from public.activity_events
     where event_key = 'bucket_removed'
       and source_table = 'buckets'
       and source_id = p_bucket_id
     order by created_at desc
     limit 1;

    return query
      select v_bucket.id, v_bucket.archived_at, v_bucket.archived_by,
             v_existing_activity, true;
    return;
  end if;

  if not public.is_room_member(v_bucket.room_id) then
    raise exception 'not a member of this room'
      using errcode = '42501', hint = 'archive_not_room_member';
  end if;

  v_balance := public.bucket_balance(p_bucket_id);
  if v_balance > 0 then
    raise exception 'bucket has a positive balance'
      using errcode = '22023',
            hint = 'archive_nonzero_balance',
            detail = format('balance=%s', v_balance);
  end if;

  -- ── Block archiving the user's last active bucket in the room ──
  select count(*) into v_active_left
    from public.buckets
   where user_id = v_user_id
     and room_id = v_bucket.room_id
     and archived_at is null
     and id <> p_bucket_id;

  if v_active_left = 0 then
    raise exception 'cannot archive the last active bucket'
      using errcode = '22023', hint = 'archive_last_active';
  end if;

  update public.buckets
     set archived_at = v_now,
         archived_by = v_user_id
   where id = p_bucket_id
     and archived_at is null;

  insert into public.activity_events (
    room_id, actor_user_id, event_key,
    source_table, source_id,
    bucket_id, payload, created_at
  ) values (
    v_bucket.room_id, v_user_id, 'bucket_removed',
    'buckets', p_bucket_id,
    p_bucket_id,
    jsonb_build_object(
      'bucket_id', p_bucket_id,
      'bucket_name', v_bucket.name,
      'reason', 'empty_archive'
    ),
    v_now
  )
  returning id into v_activity_id;

  return query
    select p_bucket_id, v_now, v_user_id, v_activity_id, false;
end;
$$;

revoke all on function public.archive_bucket(uuid) from public;
grant execute on function public.archive_bucket(uuid) to authenticated;

-- 4. transfer_and_archive_bucket ------------------------------------------
-- Combined polished-remove path. Moves the source's remaining balance
-- (if any) into the destination and then archives the source — all
-- inside one transaction so there is no race window where balance is
-- moved but the bucket stays active or vice versa.
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
  v_existing_transfer_activity uuid;
  v_existing_archive_activity uuid;
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

  -- ── Idempotency short-circuit ──
  -- The transfer + archive commit together, so a prior transfer row
  -- for this client_request_id implies the archive landed too.
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

    select id into v_existing_transfer_activity
      from public.activity_events
     where event_key = 'bucket_transfer_created'
       and source_table = 'bucket_transfers'
       and source_id = v_existing.id
     limit 1;

    select id into v_existing_archive_activity
      from public.activity_events
     where event_key = 'bucket_removed'
       and source_table = 'buckets'
       and source_id = p_source_bucket_id
     order by created_at desc
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

  -- ── Lock both bucket rows in id-order ──
  if p_source_bucket_id < p_destination_bucket_id then
    v_lock_first  := p_source_bucket_id;
    v_lock_second := p_destination_bucket_id;
  else
    v_lock_first  := p_destination_bucket_id;
    v_lock_second := p_source_bucket_id;
  end if;
  perform 1 from public.buckets where id = v_lock_first  for update;
  perform 1 from public.buckets where id = v_lock_second for update;

  -- ── Source ──
  select b.id, b.user_id, b.room_id, b.name, b.archived_at
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
    raise exception 'source bucket is archived'
      using errcode = '22023', hint = 'archive_source_archived';
  end if;

  -- ── Destination ──
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

  -- ── Transfer step (only when there is balance to move) ──
  -- Source and destination are both active and distinct, so the
  -- destination always survives the archive. No "last active" check
  -- is needed here.
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

  -- ── Archive step ──
  update public.buckets
     set archived_at = v_now,
         archived_by = v_user_id
   where id = p_source_bucket_id
     and archived_at is null;

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
