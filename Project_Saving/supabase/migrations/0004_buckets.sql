-- ============================================================
-- Task 19 — Buckets (Sub-Goals)
-- supabase/migrations/0004_buckets.sql
-- Depends on: 0002_rooms.sql, 0003_fix_rooms_rls.sql
-- ============================================================

begin;

-- ── 1. Create buckets table ───────────────────────────────────

create table buckets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  room_id       uuid not null references rooms(id)      on delete cascade,
  name          text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  unique(user_id, room_id, name)
);

create index idx_buckets_user_room on buckets(user_id, room_id);

-- ── 2. Enforce 10-bucket-per-(user, room) limit ───────────────

create or replace function enforce_bucket_limit() returns trigger as $$
begin
  if (
    select count(*)
    from buckets
    where user_id = NEW.user_id and room_id = NEW.room_id
  ) >= 10 then
    raise exception 'Bucket limit reached (10 per room)';
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_bucket_limit
  before insert on buckets
  for each row execute function enforce_bucket_limit();

-- ── 3. Add bucket_id to savings_logs (nullable first) ────────

alter table savings_logs add column bucket_id uuid references buckets(id) on delete restrict;

-- ── 4. Backfill: one "General" bucket per (user_id, room_id) ─
-- For each distinct (user_id, room_id) in savings_logs OR goals,
-- insert a General bucket with target_amount = the user's goal for that room
-- (or 1 if no goal exists), then assign all existing logs to it.

do $$
declare
  rec record;
  bucket_id uuid;
  goal_amount numeric;
begin
  for rec in
    select distinct user_id, room_id
    from (
      select user_id, room_id from savings_logs
      union
      select user_id, room_id from goals
    ) combined
  loop
    -- Get goal target (fallback 1 if user has no goal yet)
    select target_amount into goal_amount
    from goals
    where user_id = rec.user_id and room_id = rec.room_id
    limit 1;

    if goal_amount is null then
      goal_amount := 1;
    end if;

    -- Insert General bucket (skip if already exists, e.g. re-run)
    insert into buckets (user_id, room_id, name, target_amount, position)
    values (rec.user_id, rec.room_id, 'General', goal_amount, 0)
    on conflict (user_id, room_id, name) do nothing
    returning id into bucket_id;

    -- If we did a skip (on conflict), look up the existing id
    if bucket_id is null then
      select id into bucket_id
      from buckets
      where user_id = rec.user_id and room_id = rec.room_id and name = 'General';
    end if;

    -- Assign logs that don't yet have a bucket
    update savings_logs
    set bucket_id = bucket_id
    where user_id = rec.user_id
      and room_id = rec.room_id
      and bucket_id is null;
  end loop;
end $$;

-- ── 5. Make bucket_id NOT NULL after backfill ─────────────────

alter table savings_logs alter column bucket_id set not null;

-- ── 6. RLS — buckets ─────────────────────────────────────────

alter table buckets enable row level security;

-- Select: own buckets only
create policy "buckets_own_select"
  on buckets for select
  using (user_id = auth.uid());

-- Insert: own buckets, must be a room member
create policy "buckets_own_insert"
  on buckets for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from room_members rm
      where rm.room_id = buckets.room_id and rm.user_id = auth.uid()
    )
  );

-- Update: own buckets only
create policy "buckets_own_update"
  on buckets for update
  using (user_id = auth.uid());

-- Delete: own buckets only
create policy "buckets_own_delete"
  on buckets for delete
  using (user_id = auth.uid());

-- ── 7. RLS — savings_logs: ensure bucket belongs to inserter ─
-- Drop the old insert policy and replace with stricter one.

drop policy if exists "logs_own_insert" on savings_logs;

create policy "logs_own_insert"
  on savings_logs for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from buckets b
      where b.id = savings_logs.bucket_id and b.user_id = auth.uid()
    )
  );

commit;
