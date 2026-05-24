-- ============================================================
-- 41.4 - Bucket Intent Settings & Events
-- Creates tables for manual next-bucket override and intent
-- event logging, with RLS and indexes.
-- ============================================================

begin;

-- 1. Intent settings (one row per user per room)
create table if not exists public.bucket_intent_settings (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  room_id    uuid        not null references public.rooms(id) on delete cascade,
  manual_next_bucket_id  uuid references public.buckets(id) on delete set null,
  manual_next_set_at     timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

alter table public.bucket_intent_settings enable row level security;

-- Select: own rows where caller is a room member
drop policy if exists "intent_settings_select_own"
  on public.bucket_intent_settings;

create policy "intent_settings_select_own"
  on public.bucket_intent_settings
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = bucket_intent_settings.room_id
         and rm.user_id = auth.uid()
    )
  );

-- Insert: own rows, room member, optional bucket must be own+active+same room
drop policy if exists "intent_settings_insert_own"
  on public.bucket_intent_settings;

create policy "intent_settings_insert_own"
  on public.bucket_intent_settings
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = bucket_intent_settings.room_id
         and rm.user_id = auth.uid()
    )
    and (
      manual_next_bucket_id is null
      or exists (
        select 1
          from public.buckets b
         where b.id = manual_next_bucket_id
           and b.user_id = auth.uid()
           and b.room_id = bucket_intent_settings.room_id
           and b.archived_at is null
      )
    )
  );

-- Update: own rows, room member, optional bucket must be own+active+same room
drop policy if exists "intent_settings_update_own"
  on public.bucket_intent_settings;

create policy "intent_settings_update_own"
  on public.bucket_intent_settings
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = bucket_intent_settings.room_id
         and rm.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = bucket_intent_settings.room_id
         and rm.user_id = auth.uid()
    )
    and (
      manual_next_bucket_id is null
      or exists (
        select 1
          from public.buckets b
         where b.id = manual_next_bucket_id
           and b.user_id = auth.uid()
           and b.room_id = bucket_intent_settings.room_id
           and b.archived_at is null
      )
    )
  );

-- Delete: own rows only
drop policy if exists "intent_settings_delete_own"
  on public.bucket_intent_settings;

create policy "intent_settings_delete_own"
  on public.bucket_intent_settings
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = bucket_intent_settings.room_id
         and rm.user_id = auth.uid()
    )
  );


-- 2. Intent events (append-only log)
create table if not exists public.bucket_intent_events (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  room_id    uuid        not null references public.rooms(id) on delete cascade,
  bucket_id  uuid        references public.buckets(id) on delete set null,
  event_key  text        not null,
  payload    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.bucket_intent_events enable row level security;

-- Select: own events where caller is a room member
drop policy if exists "intent_events_select_own"
  on public.bucket_intent_events;

create policy "intent_events_select_own"
  on public.bucket_intent_events
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = bucket_intent_events.room_id
         and rm.user_id = auth.uid()
    )
  );

-- Insert: own events where caller is a room member
drop policy if exists "intent_events_insert_own"
  on public.bucket_intent_events;

create policy "intent_events_insert_own"
  on public.bucket_intent_events
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = bucket_intent_events.room_id
         and rm.user_id = auth.uid()
    )
  );

-- No update/delete for events (append-only)


-- 3. Constraints
alter table public.bucket_intent_events
  drop constraint if exists intent_events_event_key_check;

alter table public.bucket_intent_events
  add constraint intent_events_event_key_check
  check (event_key in (
    'category_reviewed',
    'next_bucket_selected',
    'next_bucket_cleared',
    'done_lock_overridden',
    'deposit_bucket_changed_from_default',
    'transfer_suggested',
    'transfer_completed'
  ));


-- 4. Indexes
create index if not exists idx_bucket_intent_events_user_room_time
  on public.bucket_intent_events (user_id, room_id, created_at desc);

commit;
