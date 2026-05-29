-- ============================================================
-- 0078_balance_allocations.sql
-- Plan 56 / Slice 1 — Reconcile difference → bucket allocation.
--
-- When a Check Balance run finds the actual money is MORE than the
-- app (a positive balance_adjustment), the surplus floats in the
-- adjustment layer and is not in any bucket. This migration lets the
-- owner move that "unallocated pool" into their own buckets WITHOUT
-- double counting and WITHOUT it counting as a Recorded Deposit.
--
-- Model (plan §3):
--   Unallocated pool = Verified Balance − bucketTotal
--                    = Σ balance_adjustments − Σ balance_allocations
--   Allocating X = one append-only balance_allocations(+X → bucket).
--     • Verified Balance (current_reconciled_balance) UNCHANGED
--       — allocations are not adjustments and never touch savings_logs.
--     • bucketTotal rises by X (bucket_balance includes allocations).
--     • Recorded Deposits (Σ savings_logs) UNCHANGED — so Saving Plan,
--       streaks, momentum and the deposit activity feed are unaffected
--       by construction.
--
-- Privacy: balance_allocations is owner-only (mirrors
-- bucket_transfers_select_own). We deliberately do NOT write an
-- activity_events row — that table is room-member readable and the
-- amount would leak a private reconcile difference. The append-only
-- balance_allocations table is the owner's audit trail.
--
-- The allocate RPC is SECURITY DEFINER, search_path = public, granted
-- to authenticated only. Direct client writes to balance_allocations
-- are blocked — the RPC is the sole write path. Stable HINT tokens on
-- every raise (plan §5), surfaced to copy in the frontend slice.
-- ============================================================

begin;

-- 1. balance_allocations (append-only ledger) -------------------------
create table if not exists public.balance_allocations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  destination_bucket_id uuid not null
    references public.buckets(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint balance_allocations_client_request_unique
    unique (user_id, room_id, client_request_id)
);

create index if not exists idx_balance_allocations_user_room_recent
  on public.balance_allocations(user_id, room_id, created_at desc);

create index if not exists idx_balance_allocations_destination
  on public.balance_allocations(destination_bucket_id);

create index if not exists idx_balance_allocations_room_recent
  on public.balance_allocations(room_id, created_at desc);

alter table public.balance_allocations enable row level security;

drop policy if exists "balance_allocations_select_own" on public.balance_allocations;

-- Owner-only select, scoped to rooms the caller still belongs to.
-- No insert/update/delete policies — the security-definer RPC is the
-- only normal write path. Service role bypasses RLS as usual.
create policy "balance_allocations_select_own"
  on public.balance_allocations
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = public.balance_allocations.room_id
         and rm.user_id = auth.uid()
    )
  );

-- 2. bucket_balance — extend with incoming allocations ----------------
-- Re-create the canonical balance helper (last defined in 0059) so the
-- dashboard, saving-plan bucket reads, and the archive zero-balance
-- guard all reflect allocated money. Transfer terms are unchanged.
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
    ), 0)
    + coalesce((
      select sum(a.amount)
        from public.balance_allocations a
       where a.destination_bucket_id = p_bucket_id
    ), 0);
$$;

revoke all on function public.bucket_balance(uuid) from public;
revoke all on function public.bucket_balance(uuid) from anon;
revoke all on function public.bucket_balance(uuid) from authenticated;

-- 3. allocate_balance_to_bucket --------------------------------------
create or replace function public.allocate_balance_to_bucket(
  p_room_id uuid,
  p_bucket_id uuid,
  p_amount numeric,
  p_client_request_id uuid default null
)
returns table (
  allocation_id uuid,
  destination_bucket_id uuid,
  amount numeric,
  bucket_balance_after numeric,
  pool_after numeric,
  reused boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_amount    numeric(12,2);
  v_existing  public.balance_allocations%rowtype;
  v_bucket    record;
  v_adj_sum   numeric(12,2);
  v_alloc_sum numeric(12,2);
  v_available numeric(12,2);
  v_alloc_id  uuid;
  v_now       timestamptz := now();
begin
  -- ── Argument validation ──
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501', hint = 'allocation_unauthenticated';
  end if;
  if p_room_id is null or p_bucket_id is null then
    raise exception 'room id and bucket id required'
      using errcode = '22023', hint = 'allocation_invalid_request';
  end if;
  if p_client_request_id is null then
    raise exception 'client_request_id required'
      using errcode = '22023', hint = 'allocation_invalid_request';
  end if;
  if p_amount is null then
    raise exception 'amount required'
      using errcode = '22023', hint = 'allocation_invalid_amount';
  end if;
  if p_amount <> round(p_amount::numeric, 2) then
    raise exception 'amount must use at most two decimal places'
      using errcode = '22023', hint = 'allocation_invalid_amount';
  end if;
  v_amount := p_amount::numeric(12,2);
  if v_amount <= 0 then
    raise exception 'amount must be greater than zero'
      using errcode = '22023', hint = 'allocation_invalid_amount';
  end if;

  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room'
      using errcode = '42501', hint = 'allocation_not_room_member';
  end if;

  -- ── Idempotency short-circuit ──
  -- A retried double-submit (same client_request_id) returns the
  -- original allocation instead of moving money twice. The
  -- (user_id, room_id, client_request_id) unique constraint defends
  -- in depth; this lookup is the cooperative path.
  select * into v_existing
    from public.balance_allocations
   where user_id = v_user_id
     and room_id = p_room_id
     and client_request_id = p_client_request_id
   limit 1;

  if found then
    -- Same id with a different payload is a client bug, not a retry.
    if v_existing.destination_bucket_id <> p_bucket_id
       or v_existing.amount <> v_amount then
      raise exception 'client_request_id already used with different allocation'
        using errcode = '22023', hint = 'allocation_invalid_request';
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
             v_existing.amount,
             public.bucket_balance(v_existing.destination_bucket_id),
             round(v_adj_sum - v_alloc_sum, 2),
             true,
             v_existing.created_at;
    return;
  end if;

  -- ── Serialize this user's allocations in this room ──
  -- The contended resource is the unallocated pool (per user+room),
  -- not a single bucket row, so concurrent drops to different buckets
  -- could each read a stale pool. A transaction-scoped advisory lock
  -- serializes them so the pool check below is authoritative.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text || ':' || p_room_id::text));

  -- ── Validate destination bucket ──
  perform 1 from public.buckets where id = p_bucket_id for update;

  select b.id, b.user_id, b.room_id, b.archived_at
    into v_bucket
    from public.buckets b
   where b.id = p_bucket_id;
  if not found then
    raise exception 'bucket not found'
      using errcode = 'P0002', hint = 'allocation_bucket_missing';
  end if;
  if v_bucket.user_id <> v_user_id then
    raise exception 'bucket is not owned by caller'
      using errcode = '42501', hint = 'allocation_partner_bucket';
  end if;
  if v_bucket.room_id <> p_room_id then
    raise exception 'bucket is not in this room'
      using errcode = '22023', hint = 'allocation_bucket_wrong_room';
  end if;
  if v_bucket.archived_at is not null then
    raise exception 'bucket is archived'
      using errcode = '22023', hint = 'allocation_bucket_archived';
  end if;

  -- ── Pool check ──
  -- available = Verified Balance − bucketTotal
  --           = Σ adjustments − Σ allocations   (savings_logs cancel)
  select coalesce(sum(a.amount), 0) into v_alloc_sum
    from public.balance_allocations a
   where a.user_id = v_user_id and a.room_id = p_room_id;
  select coalesce(sum(adj.amount), 0) into v_adj_sum
    from public.balance_adjustments adj
   where adj.user_id = v_user_id and adj.room_id = p_room_id;

  v_available := round(v_adj_sum - v_alloc_sum, 2);
  if v_available < v_amount then
    raise exception 'allocation exceeds the unallocated pool'
      using errcode = '22023',
            hint = 'allocation_exceeds_pool',
            detail = format('available=%s, requested=%s', v_available, v_amount);
  end if;

  -- ── Append-only allocation ──
  insert into public.balance_allocations (
    room_id, user_id, destination_bucket_id,
    amount, client_request_id, created_at
  ) values (
    p_room_id, v_user_id, p_bucket_id,
    v_amount, p_client_request_id, v_now
  )
  returning id into v_alloc_id;

  return query
    select v_alloc_id,
           p_bucket_id,
           v_amount,
           public.bucket_balance(p_bucket_id),
           round(v_available - v_amount, 2),
           false,
           v_now;
end;
$$;

revoke all on function public.allocate_balance_to_bucket(uuid, uuid, numeric, uuid) from public;
grant execute on function public.allocate_balance_to_bucket(uuid, uuid, numeric, uuid) to authenticated;

commit;
