-- ============================================================
-- 0079_balance_deallocations.sql
-- Plan 56 / Slice 4b — Shortfall write-down (bucket correction).
--
-- When a Check Balance run finds the actual money is LESS than the
-- buckets claim (spent / miscounted), the user trims a bucket down to
-- match reality via a SIGNED (negative) balance_allocations row. Framed
-- as "ปรับเป้าให้ตรงกับเงินจริง", never as loss/blame.
--
-- Model (plan §14):
--   ALLOC = Σ balance_allocations            (NOW SIGNED: + in, − write-down)
--   overAllocated = ALLOC − ADJ  (> 0 ⇒ buckets exceed Verified Balance)
--   De-allocating X = one append-only balance_allocations(−X → bucket).
--     • savings_logs UNCHANGED — past saving / streak / Saving Plan stay
--       real (this is the CLAUDE.md-gated bucket-correction path, append
--       only, never mutating financial history).
--     • Verified Balance (current_reconciled_balance) UNCHANGED — a
--       de-allocation is not an adjustment.
--     • bucketTotal falls by X (bucket_balance sums signed allocations).
--     • overAllocated falls by X; once it hits 0, buckets = Verified again.
--
-- Guards (server-authoritative, mirror allocate):
--   • X ≤ overAllocated         (cannot trim more than the shortfall)
--   • bucket_balance ≥ X        (never drive a bucket negative; auto-spill
--                                across buckets is a client concern)
-- Privacy unchanged: owner-only table, NO activity_events row.
-- ============================================================

begin;

-- 1. Relax the amount check: allow signed values (in/out), forbid zero ----
-- 0078 created an inline `check (amount > 0)` with an auto-generated name.
-- Drop whichever check constraint references `amount`, then re-add a
-- non-zero check so signed write-downs are permitted.
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
    from pg_constraint
   where conrelid = 'public.balance_allocations'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%amount%';
  if v_constraint is not null then
    execute format(
      'alter table public.balance_allocations drop constraint %I',
      v_constraint
    );
  end if;
end $$;

alter table public.balance_allocations
  add constraint balance_allocations_amount_nonzero check (amount <> 0);

-- 2. deallocate_balance_from_bucket --------------------------------------
-- Mirror allocate_balance_to_bucket: SECURITY DEFINER, search_path public,
-- per user+room advisory lock, idempotent on client_request_id. p_amount is
-- the POSITIVE magnitude to trim; the stored row is negative.
create or replace function public.deallocate_balance_from_bucket(
  p_room_id uuid,
  p_bucket_id uuid,
  p_amount numeric,
  p_client_request_id uuid default null
)
returns table (
  deallocation_id uuid,
  source_bucket_id uuid,
  amount numeric,
  bucket_balance_after numeric,
  over_allocated_after numeric,
  reused boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_amount     numeric(12,2);
  v_existing   public.balance_allocations%rowtype;
  v_bucket     record;
  v_adj_sum    numeric(12,2);
  v_alloc_sum  numeric(12,2);
  v_over       numeric(12,2);
  v_bucket_bal numeric(12,2);
  v_dealloc_id uuid;
  v_now        timestamptz := now();
begin
  -- ── Argument validation ──
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501', hint = 'deallocation_unauthenticated';
  end if;
  if p_room_id is null or p_bucket_id is null then
    raise exception 'room id and bucket id required'
      using errcode = '22023', hint = 'deallocation_invalid_request';
  end if;
  if p_client_request_id is null then
    raise exception 'client_request_id required'
      using errcode = '22023', hint = 'deallocation_invalid_request';
  end if;
  if p_amount is null then
    raise exception 'amount required'
      using errcode = '22023', hint = 'deallocation_invalid_amount';
  end if;
  if p_amount <> round(p_amount::numeric, 2) then
    raise exception 'amount must use at most two decimal places'
      using errcode = '22023', hint = 'deallocation_invalid_amount';
  end if;
  v_amount := p_amount::numeric(12,2);
  if v_amount <= 0 then
    raise exception 'amount must be greater than zero'
      using errcode = '22023', hint = 'deallocation_invalid_amount';
  end if;

  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room'
      using errcode = '42501', hint = 'deallocation_not_room_member';
  end if;

  -- ── Idempotency short-circuit ──
  -- The stored row is negative (−magnitude); a genuine retry carries the
  -- same client_request_id, bucket and magnitude.
  select * into v_existing
    from public.balance_allocations
   where user_id = v_user_id
     and room_id = p_room_id
     and client_request_id = p_client_request_id
   limit 1;

  if found then
    if v_existing.destination_bucket_id <> p_bucket_id
       or v_existing.amount <> (-v_amount) then
      raise exception 'client_request_id already used with different write-down'
        using errcode = '22023', hint = 'deallocation_invalid_request';
    end if;

    select coalesce(sum(a.amount), 0) into v_alloc_sum
      from public.balance_allocations a
     where a.user_id = v_user_id and a.room_id = p_room_id;
    select coalesce(sum(adj.amount), 0) into v_adj_sum
      from public.balance_adjustments adj
     where adj.user_id = v_user_id and adj.room_id = p_room_id;

    return query
      select v_existing.id,
             v_existing.destination_bucket_id,
             (-v_existing.amount)::numeric(12,2),
             public.bucket_balance(v_existing.destination_bucket_id),
             greatest(round(v_alloc_sum - v_adj_sum, 2), 0),
             true,
             v_existing.created_at;
    return;
  end if;

  -- ── Serialize this user's allocations in this room (same lock key as
  --    allocate, so surplus and shortfall writes can't interleave) ──
  perform pg_advisory_xact_lock(hashtext(v_user_id::text || ':' || p_room_id::text));

  -- ── Validate target bucket ──
  perform 1 from public.buckets where id = p_bucket_id for update;

  select b.id, b.user_id, b.room_id, b.archived_at
    into v_bucket
    from public.buckets b
   where b.id = p_bucket_id;
  if not found then
    raise exception 'bucket not found'
      using errcode = 'P0002', hint = 'deallocation_bucket_missing';
  end if;
  if v_bucket.user_id <> v_user_id then
    raise exception 'bucket is not owned by caller'
      using errcode = '42501', hint = 'deallocation_partner_bucket';
  end if;
  if v_bucket.room_id <> p_room_id then
    raise exception 'bucket is not in this room'
      using errcode = '22023', hint = 'deallocation_bucket_wrong_room';
  end if;
  if v_bucket.archived_at is not null then
    raise exception 'bucket is archived'
      using errcode = '22023', hint = 'deallocation_bucket_archived';
  end if;

  -- ── Shortfall check ──
  -- overAllocated = Σ allocations − Σ adjustments  (how much buckets
  -- currently overstate the Verified Balance). We may trim at most this.
  select coalesce(sum(a.amount), 0) into v_alloc_sum
    from public.balance_allocations a
   where a.user_id = v_user_id and a.room_id = p_room_id;
  select coalesce(sum(adj.amount), 0) into v_adj_sum
    from public.balance_adjustments adj
   where adj.user_id = v_user_id and adj.room_id = p_room_id;

  v_over := round(v_alloc_sum - v_adj_sum, 2);
  if v_over < v_amount then
    raise exception 'write-down exceeds the shortfall'
      using errcode = '22023',
            hint = 'deallocation_exceeds_shortfall',
            detail = format('shortfall=%s, requested=%s', greatest(v_over, 0), v_amount);
  end if;

  -- ── No-negative-bucket check ──
  v_bucket_bal := public.bucket_balance(p_bucket_id);
  if v_bucket_bal < v_amount then
    raise exception 'write-down exceeds the bucket balance'
      using errcode = '22023',
            hint = 'deallocation_insufficient_bucket',
            detail = format('bucket_balance=%s, requested=%s', v_bucket_bal, v_amount);
  end if;

  -- ── Append-only signed write-down (negative amount) ──
  insert into public.balance_allocations (
    room_id, user_id, destination_bucket_id,
    amount, client_request_id, created_at
  ) values (
    p_room_id, v_user_id, p_bucket_id,
    (-v_amount), p_client_request_id, v_now
  )
  returning id into v_dealloc_id;

  return query
    select v_dealloc_id,
           p_bucket_id,
           v_amount,
           round(v_bucket_bal - v_amount, 2),
           round(v_over - v_amount, 2),
           false,
           v_now;
end;
$$;

revoke all on function public.deallocate_balance_from_bucket(uuid, uuid, numeric, uuid) from public;
grant execute on function public.deallocate_balance_from_bucket(uuid, uuid, numeric, uuid) to authenticated;

commit;
