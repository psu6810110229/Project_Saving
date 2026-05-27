-- ============================================================
-- 0071_bucket_deadlines_and_rules.sql
-- Phase 1 / Slice 1.1 — Add deadline, saving rule, and
-- completion fields to buckets. Create bucket_deadline_revisions
-- audit table with RLS.
--
-- All new columns are nullable so existing buckets are unaffected.
-- NOT NULL enforcement on deadline deferred until migration wizard
-- has run for each user (app-level enforcement).
-- ============================================================

begin;

-- 1. New columns on buckets ------------------------------------

alter table public.buckets
  add column if not exists deadline date,
  add column if not exists saving_rule_type text,
  add column if not exists saving_rule_amount numeric,
  add column if not exists saving_rule_start_amount numeric,
  add column if not exists saving_rule_increment numeric,
  add column if not exists saving_rule_cap numeric,
  add column if not exists saving_rule_day_count integer,
  add column if not exists reminder_day integer,
  add column if not exists payment_type text default 'flexible',
  add column if not exists completed_at timestamptz;

-- 2. Constraints -----------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.buckets'::regclass
      and conname = 'chk_saving_rule_type'
  ) then
    alter table public.buckets
      add constraint chk_saving_rule_type check (
        saving_rule_type is null or saving_rule_type in (
          'fixed_daily','fixed_weekly','fixed_monthly',
          'increasing_daily','increasing_daily_capped','flexible'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.buckets'::regclass
      and conname = 'chk_payment_type'
  ) then
    alter table public.buckets
      add constraint chk_payment_type check (
        payment_type in ('advance_booking','pre_trip','on_trip','flexible')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.buckets'::regclass
      and conname = 'chk_reminder_day'
  ) then
    alter table public.buckets
      add constraint chk_reminder_day check (
        reminder_day is null or (reminder_day >= 1 and reminder_day <= 28)
      );
  end if;
end $$;

-- 3. Audit table for deadline changes --------------------------

create table if not exists public.bucket_deadline_revisions (
  id uuid primary key default gen_random_uuid(),
  bucket_id uuid not null references public.buckets(id),
  previous_deadline date,
  new_deadline date not null,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);

create index if not exists idx_bucket_deadline_revisions_bucket
  on public.bucket_deadline_revisions(bucket_id, changed_at desc);

-- 4. RLS on bucket_deadline_revisions --------------------------

alter table public.bucket_deadline_revisions enable row level security;

drop policy if exists "Room members can view deadline revisions"
  on public.bucket_deadline_revisions;

create policy "Room members can view deadline revisions"
  on public.bucket_deadline_revisions
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.buckets b
        join public.room_members rm on rm.room_id = b.room_id
       where b.id = bucket_deadline_revisions.bucket_id
         and rm.user_id = auth.uid()
    )
  );

drop policy if exists "Bucket owner can insert deadline revisions"
  on public.bucket_deadline_revisions;

create policy "Bucket owner can insert deadline revisions"
  on public.bucket_deadline_revisions
  for insert
  to authenticated
  with check (
    changed_by = auth.uid()
    and exists (
      select 1
        from public.buckets b
       where b.id = bucket_deadline_revisions.bucket_id
         and b.user_id = auth.uid()
    )
  );

commit;
