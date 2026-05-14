-- ============================================================
-- 0027_reconcile_checkpoints.sql
-- Reconcile MVP: balance_checkpoints, balance_adjustments,
-- checkpoint_storage_items, the create_balance_checkpoint RPC,
-- and the sanitized balance_activity_for_room RPC.
--
-- savings_logs.amount > 0 is preserved. Corrections live in a
-- separate signed adjustments table so the deposit ledger keeps
-- its meaning. Writes are routed through a security-definer RPC
-- so the client never has to negotiate idempotency or sign rules
-- on its own.
--
-- This migration also hardens the legacy broad savings_logs
-- policies from 0001_init.sql in case they still exist in a
-- given deployment.
-- ============================================================

begin;

-- ── Drop legacy broad savings_logs policies if still present ───
-- 0001 created broad "savings_logs: authenticated users can read"
-- plus owner update/delete policies. Later migrations only added
-- room-scoped names alongside them, so the broad ones can survive
-- in environments that ran 0001 first.
drop policy if exists "savings_logs: authenticated users can read" on public.savings_logs;
drop policy if exists "savings_logs: owner can insert"            on public.savings_logs;
drop policy if exists "savings_logs: owner can update"            on public.savings_logs;
drop policy if exists "savings_logs: owner can delete"            on public.savings_logs;

-- ── balance_checkpoints ────────────────────────────────────────
create table if not exists public.balance_checkpoints (
  id                     uuid primary key default gen_random_uuid(),
  room_id                uuid not null references public.rooms(id) on delete cascade,
  user_id                uuid not null references auth.users(id) on delete cascade,
  ledger_amount_at_time  numeric(12,2) not null check (ledger_amount_at_time >= 0),
  actual_amount          numeric(12,2) not null check (actual_amount >= 0),
  difference_amount      numeric(12,2) not null,
  note                   text,
  checked_at             timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  client_request_id      uuid
);

create index if not exists idx_balance_checkpoints_room_user_time
  on public.balance_checkpoints (room_id, user_id, checked_at desc);

create index if not exists idx_balance_checkpoints_room_time
  on public.balance_checkpoints (room_id, checked_at desc);

create unique index if not exists uq_balance_checkpoints_client_request
  on public.balance_checkpoints (room_id, user_id, client_request_id)
  where client_request_id is not null;

-- ── balance_adjustments ────────────────────────────────────────
create table if not exists public.balance_adjustments (
  id            uuid primary key default gen_random_uuid(),
  checkpoint_id uuid not null references public.balance_checkpoints(id) on delete restrict,
  room_id       uuid not null references public.rooms(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  amount        numeric(12,2) not null check (amount <> 0),
  reason        text not null check (reason in (
    'forgot_to_log',
    'over_recorded',
    'miscounted',
    'spent_or_used',
    'opening_balance',
    'other'
  )),
  note          text,
  created_at    timestamptz not null default now()
);

create unique index if not exists uq_balance_adjustments_checkpoint
  on public.balance_adjustments (checkpoint_id);

create index if not exists idx_balance_adjustments_room_user_time
  on public.balance_adjustments (room_id, user_id, created_at desc);

create index if not exists idx_balance_adjustments_room_time
  on public.balance_adjustments (room_id, created_at desc);

-- ── checkpoint_storage_items (optional split) ──────────────────
create table if not exists public.checkpoint_storage_items (
  id            uuid primary key default gen_random_uuid(),
  checkpoint_id uuid not null references public.balance_checkpoints(id) on delete cascade,
  room_id       uuid not null references public.rooms(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  label         text not null,
  amount        numeric(12,2) not null check (amount >= 0),
  position      int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_checkpoint_storage_items_checkpoint
  on public.checkpoint_storage_items (checkpoint_id, position);

-- ── RLS ────────────────────────────────────────────────────────
alter table public.balance_checkpoints       enable row level security;
alter table public.balance_adjustments       enable row level security;
alter table public.checkpoint_storage_items  enable row level security;

drop policy if exists "balance_checkpoints_select_own"     on public.balance_checkpoints;
drop policy if exists "balance_adjustments_select_own"     on public.balance_adjustments;
drop policy if exists "checkpoint_storage_items_select_own" on public.checkpoint_storage_items;

-- Owners can read their own full rows (including note + storage split).
-- Partner-visible sanitized rows come through balance_activity_for_room.
-- No client insert/update/delete policies; all writes go through the
-- create_balance_checkpoint security-definer RPC.
create policy "balance_checkpoints_select_own"
  on public.balance_checkpoints for select
  to authenticated
  using (user_id = auth.uid());

create policy "balance_adjustments_select_own"
  on public.balance_adjustments for select
  to authenticated
  using (user_id = auth.uid());

create policy "checkpoint_storage_items_select_own"
  on public.checkpoint_storage_items for select
  to authenticated
  using (user_id = auth.uid());

-- ── current_reconciled_balance helper ──────────────────────────
-- Sum of positive deposits plus any non-void adjustments for this
-- (room_id, user_id). MVP has no void support yet, so we treat all
-- adjustments as live; the void columns are deferred.
create or replace function public.current_reconciled_balance(
  p_room_id uuid,
  p_user_id uuid
) returns numeric
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce((
      select sum(l.amount)
      from public.savings_logs l
      where l.room_id = p_room_id
        and l.user_id = p_user_id
    ), 0)
    +
    coalesce((
      select sum(a.amount)
      from public.balance_adjustments a
      where a.room_id = p_room_id
        and a.user_id = p_user_id
    ), 0);
$$;

revoke all on function public.current_reconciled_balance(uuid, uuid) from public;
grant execute on function public.current_reconciled_balance(uuid, uuid) to authenticated;

-- ── create_balance_checkpoint RPC ──────────────────────────────
-- Writes one checkpoint, plus one signed adjustment if the actual
-- amount differs from the ledger. Storage items are optional. The
-- function is the only allowed write path for these tables.
create or replace function public.create_balance_checkpoint(
  p_room_id           uuid,
  p_actual_amount     numeric,
  p_reason            text default null,
  p_note              text default null,
  p_storage_items     jsonb default '[]'::jsonb,
  p_client_request_id uuid default null
)
returns table (
  checkpoint_id     uuid,
  adjustment_id     uuid,
  ledger_amount     numeric,
  actual_amount     numeric,
  difference_amount numeric,
  reason            text,
  reused            boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_ledger     numeric(12,2);
  v_actual     numeric(12,2);
  v_diff       numeric(12,2);
  v_checkpoint uuid;
  v_adjustment uuid;
  v_existing   public.balance_checkpoints%rowtype;
  v_item       jsonb;
  v_item_label text;
  v_item_amt   numeric(12,2);
  v_item_pos   int;
  v_item_sum   numeric(12,2) := 0;
  v_count      int;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_room_id is null then
    raise exception 'room id required' using errcode = '22023';
  end if;

  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  if p_actual_amount is null or p_actual_amount < 0 then
    raise exception 'actual amount must be zero or positive' using errcode = '22023';
  end if;

  v_actual := round(p_actual_amount::numeric, 2);

  -- Idempotency: if a checkpoint for this (room, user, client_request_id)
  -- already exists, return it instead of creating a duplicate. This
  -- guards against double-submit from retried network requests.
  if p_client_request_id is not null then
    select * into v_existing
    from public.balance_checkpoints
    where room_id = p_room_id
      and user_id = v_user_id
      and client_request_id = p_client_request_id
    limit 1;

    if found then
      return query
        select
          v_existing.id,
          (select a.id from public.balance_adjustments a where a.checkpoint_id = v_existing.id limit 1),
          v_existing.ledger_amount_at_time,
          v_existing.actual_amount,
          v_existing.difference_amount,
          (select a.reason from public.balance_adjustments a where a.checkpoint_id = v_existing.id limit 1),
          true;
      return;
    end if;
  end if;

  -- Compute ledger server-side. Equal to current_reconciled_balance,
  -- inlined here so the same transaction sees its own work.
  v_ledger := coalesce((
    select sum(l.amount)
    from public.savings_logs l
    where l.room_id = p_room_id
      and l.user_id = v_user_id
  ), 0)
  + coalesce((
    select sum(a.amount)
    from public.balance_adjustments a
    where a.room_id = p_room_id
      and a.user_id = v_user_id
  ), 0);

  v_diff := round(v_actual - v_ledger, 2);

  if v_diff <> 0 then
    if p_reason is null or trim(p_reason) = '' then
      raise exception 'reason required when actual differs from app balance'
        using errcode = '22023';
    end if;

    if p_reason not in (
      'forgot_to_log',
      'over_recorded',
      'miscounted',
      'spent_or_used',
      'opening_balance',
      'other'
    ) then
      raise exception 'unknown reason: %', p_reason using errcode = '22023';
    end if;
  end if;

  -- Insert checkpoint.
  insert into public.balance_checkpoints (
    room_id, user_id, ledger_amount_at_time, actual_amount,
    difference_amount, note, client_request_id
  ) values (
    p_room_id, v_user_id, v_ledger, v_actual,
    v_diff, nullif(trim(coalesce(p_note, '')), ''), p_client_request_id
  )
  returning id into v_checkpoint;

  -- Insert adjustment when amounts differ.
  if v_diff <> 0 then
    insert into public.balance_adjustments (
      checkpoint_id, room_id, user_id, amount, reason, note
    ) values (
      v_checkpoint, p_room_id, v_user_id, v_diff, p_reason,
      nullif(trim(coalesce(p_note, '')), '')
    )
    returning id into v_adjustment;
  end if;

  -- Optional storage items. If supplied, the sum must equal actual.
  if p_storage_items is not null and jsonb_typeof(p_storage_items) = 'array' then
    v_count := 0;
    for v_item in select * from jsonb_array_elements(p_storage_items)
    loop
      v_item_label := nullif(trim(coalesce(v_item ->> 'label', '')), '');
      v_item_amt   := coalesce((v_item ->> 'amount')::numeric, -1);
      v_item_pos   := coalesce((v_item ->> 'position')::int, v_count);

      if v_item_label is null then
        raise exception 'storage item label required' using errcode = '22023';
      end if;
      if v_item_amt < 0 then
        raise exception 'storage item amount must be zero or positive'
          using errcode = '22023';
      end if;

      insert into public.checkpoint_storage_items (
        checkpoint_id, room_id, user_id, label, amount, position
      ) values (
        v_checkpoint, p_room_id, v_user_id, v_item_label,
        round(v_item_amt, 2), v_item_pos
      );

      v_item_sum := v_item_sum + round(v_item_amt, 2);
      v_count := v_count + 1;
    end loop;

    if v_count > 0 and round(v_item_sum, 2) <> v_actual then
      raise exception 'storage split (%.2f) does not match actual amount (%.2f)',
        v_item_sum, v_actual
        using errcode = '22023';
    end if;
  end if;

  return query
    select v_checkpoint,
           v_adjustment,
           v_ledger,
           v_actual,
           v_diff,
           case when v_diff <> 0 then p_reason else null end,
           false;
end;
$$;

revoke all on function public.create_balance_checkpoint(uuid, numeric, text, text, jsonb, uuid) from public;
grant execute on function public.create_balance_checkpoint(uuid, numeric, text, text, jsonb, uuid) to authenticated;

-- ── balance_activity_for_room RPC (sanitized partner view) ─────
-- Returns checkpoint + adjustment summary rows visible to any room
-- member. Free-form notes and storage split are intentionally
-- omitted to keep partner visibility low-friction.
create or replace function public.balance_activity_for_room(
  p_room_id uuid,
  p_limit   int default 20
)
returns table (
  checkpoint_id      uuid,
  user_id            uuid,
  display_name       text,
  checked_at         timestamptz,
  ledger_amount      numeric,
  actual_amount      numeric,
  difference_amount  numeric,
  reason             text
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

  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  return query
    select
      c.id as checkpoint_id,
      c.user_id,
      p.display_name,
      c.checked_at,
      c.ledger_amount_at_time as ledger_amount,
      c.actual_amount,
      c.difference_amount,
      a.reason
    from public.balance_checkpoints c
    left join public.balance_adjustments a on a.checkpoint_id = c.id
    left join public.profiles p on p.id = c.user_id
    where c.room_id = p_room_id
    order by c.checked_at desc
    limit greatest(coalesce(p_limit, 20), 1);
end;
$$;

revoke all on function public.balance_activity_for_room(uuid, int) from public;
grant execute on function public.balance_activity_for_room(uuid, int) to authenticated;

commit;
