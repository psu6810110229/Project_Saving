-- ============================================================
-- 0058_bucket_transfers_archive.sql
-- Task 40 / Sprint 40.2 — Database schema for bucket transfer,
-- bucket archive, and append-only activity events.
--
-- Schema only. RPCs (transfer_bucket_money, archive_bucket,
-- balance helper), idempotency wiring, and partner-visibility
-- shaping of activity payloads are handled in later slices
-- (40.3+). Direct client writes to bucket_transfers /
-- activity_events are intentionally blocked here so the only
-- normal write path is via security-definer RPCs.
-- ============================================================

begin;

-- 1. buckets: archive fields -----------------------------------

alter table public.buckets
  add column if not exists archived_at timestamptz;

alter table public.buckets
  add column if not exists archived_by uuid
    references auth.users(id) on delete set null;

-- Partial index for the common active-bucket lookup path.
create index if not exists idx_buckets_user_room_active
  on public.buckets(user_id, room_id)
  where archived_at is null;

-- Make the (user_id, room_id, name) uniqueness apply only to
-- active buckets so a user can later create a new "Flight"
-- after archiving the old one. The original constraint was
-- defined inline by 0004_buckets.sql with an auto-generated
-- name; resolve it dynamically.
do $$
declare
  v_conname text;
begin
  select conname into v_conname
    from pg_constraint
   where conrelid = 'public.buckets'::regclass
     and contype = 'u'
     and pg_get_constraintdef(oid) ilike '%(user_id, room_id, name)%';

  if v_conname is not null then
    execute format(
      'alter table public.buckets drop constraint %I',
      v_conname
    );
  end if;
end $$;

create unique index if not exists ux_buckets_user_room_name_active
  on public.buckets(user_id, room_id, name)
  where archived_at is null;

-- 2. bucket_transfers (append-only ledger) ---------------------

create table if not exists public.bucket_transfers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_bucket_id uuid not null
    references public.buckets(id) on delete restrict,
  destination_bucket_id uuid not null
    references public.buckets(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint bucket_transfers_distinct_buckets
    check (source_bucket_id <> destination_bucket_id),
  constraint bucket_transfers_client_request_unique
    unique (user_id, room_id, client_request_id)
);

create index if not exists idx_bucket_transfers_user_room_recent
  on public.bucket_transfers(user_id, room_id, created_at desc);

create index if not exists idx_bucket_transfers_room_recent
  on public.bucket_transfers(room_id, created_at desc);

create index if not exists idx_bucket_transfers_source
  on public.bucket_transfers(source_bucket_id);

create index if not exists idx_bucket_transfers_destination
  on public.bucket_transfers(destination_bucket_id);

alter table public.bucket_transfers enable row level security;

drop policy if exists "bucket_transfers_select_own" on public.bucket_transfers;

-- Owner-only select, additionally scoped to rooms the caller
-- still belongs to. Direct insert/update/delete are not granted
-- — the security-definer transfer RPC (Sprint 40.3) is the only
-- normal write path. Service role bypasses RLS as usual.
create policy "bucket_transfers_select_own"
  on public.bucket_transfers
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = public.bucket_transfers.room_id
         and rm.user_id = auth.uid()
    )
  );

-- 3. activity_events (server-written audit feed) ---------------

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  actor_user_id uuid
    references auth.users(id) on delete set null,
  event_key text not null,
  source_table text,
  source_id uuid,
  bucket_id uuid
    references public.buckets(id) on delete set null,
  target_bucket_id uuid
    references public.buckets(id) on delete set null,
  amount numeric(12,2) check (amount is null or amount > 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_events_event_key_not_empty
    check (length(btrim(event_key)) > 0)
);

create index if not exists idx_activity_events_room_recent
  on public.activity_events(room_id, created_at desc);

create index if not exists idx_activity_events_actor_recent
  on public.activity_events(actor_user_id, created_at desc);

create index if not exists idx_activity_events_bucket
  on public.activity_events(bucket_id);

create index if not exists idx_activity_events_target_bucket
  on public.activity_events(target_bucket_id);

create index if not exists idx_activity_events_event_key
  on public.activity_events(event_key, created_at desc);

alter table public.activity_events enable row level security;

drop policy if exists "activity_events_select_room_member" on public.activity_events;

-- Room members can read activity rows for their room. Note that
-- partner-visible event types must keep private text (e.g. the
-- transfer note) out of payload at the RPC layer — see plan
-- section 10. No client insert/update/delete policies; the
-- activity feed is server-written.
create policy "activity_events_select_room_member"
  on public.activity_events
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.room_members rm
       where rm.room_id = public.activity_events.room_id
         and rm.user_id = auth.uid()
    )
  );

commit;
