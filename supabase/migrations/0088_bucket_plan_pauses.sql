-- ============================================================
-- 0088_bucket_plan_pauses.sql
-- Bucket-level pause/resume primitives for per-bucket saving plans.
--
-- This intentionally does not replace legacy saving_plan_pauses.
-- Bucket pause history is owner-only; partner visibility is exposed
-- through a sanitized status RPC that omits raw pause/resume dates.
-- ============================================================

begin;

-- 1. bucket_plan_pauses -----------------------------------------------

create table if not exists public.bucket_plan_pauses (
  id uuid primary key default gen_random_uuid(),
  bucket_id uuid not null references public.buckets(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  paused_from date not null,
  resumed_from date,
  created_at timestamptz not null default now(),
  resumed_at timestamptz,
  client_request_id uuid,
  resume_client_request_id uuid,
  constraint bucket_plan_pauses_dates_check
    check (resumed_from is null or resumed_from >= paused_from)
);

create unique index if not exists uq_bucket_plan_pauses_open
  on public.bucket_plan_pauses(bucket_id)
  where resumed_from is null;

create unique index if not exists uq_bucket_plan_pauses_client_request
  on public.bucket_plan_pauses(user_id, client_request_id)
  where client_request_id is not null;

create unique index if not exists uq_bucket_plan_pauses_resume_request
  on public.bucket_plan_pauses(user_id, resume_client_request_id)
  where resume_client_request_id is not null;

create index if not exists idx_bucket_plan_pauses_bucket
  on public.bucket_plan_pauses(bucket_id, paused_from);

create index if not exists idx_bucket_plan_pauses_room_user
  on public.bucket_plan_pauses(room_id, user_id);

alter table public.bucket_plan_pauses enable row level security;

drop policy if exists "bucket_plan_pauses_select_own"
  on public.bucket_plan_pauses;

create policy "bucket_plan_pauses_select_own"
  on public.bucket_plan_pauses
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = public.bucket_plan_pauses.room_id
         and rm.user_id = auth.uid()
    )
  );

-- No client insert/update/delete policies. Writes go through RPCs.

-- 2. bucket_plan_revisions --------------------------------------------

create table if not exists public.bucket_plan_revisions (
  id uuid primary key default gen_random_uuid(),
  bucket_id uuid not null references public.buckets(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from_date date not null,
  deadline date,
  target_amount numeric(12,2) not null,
  saving_rule_type text,
  saving_rule_amount numeric(12,2),
  saving_rule_start_amount numeric(12,2),
  saving_rule_increment numeric(12,2),
  saving_rule_cap numeric(12,2),
  saving_rule_day_count integer,
  saving_rule_start_date date,
  reminder_day integer,
  source text not null,
  created_at timestamptz not null default now(),
  constraint bucket_plan_revisions_target_positive
    check (target_amount > 0),
  constraint bucket_plan_revisions_rule_type_check
    check (
      saving_rule_type is null
      or saving_rule_type in (
        'fixed_daily',
        'fixed_weekly',
        'fixed_monthly',
        'increasing_daily',
        'increasing_daily_capped',
        'flexible'
      )
    ),
  constraint bucket_plan_revisions_reminder_day_check
    check (reminder_day is null or (reminder_day >= 1 and reminder_day <= 28)),
  constraint bucket_plan_revisions_source_check
    check (source in ('migration_backfill', 'resume_recalculated'))
);

create index if not exists idx_bucket_plan_revisions_bucket_effective
  on public.bucket_plan_revisions(bucket_id, effective_from_date desc, created_at desc);

create index if not exists idx_bucket_plan_revisions_room_user
  on public.bucket_plan_revisions(room_id, user_id);

alter table public.bucket_plan_revisions enable row level security;

drop policy if exists "bucket_plan_revisions_select_own"
  on public.bucket_plan_revisions;

create policy "bucket_plan_revisions_select_own"
  on public.bucket_plan_revisions
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = public.bucket_plan_revisions.room_id
         and rm.user_id = auth.uid()
    )
  );

-- No client insert/update/delete policies. Writes go through RPCs/backfill.

insert into public.bucket_plan_revisions (
  bucket_id,
  room_id,
  user_id,
  effective_from_date,
  deadline,
  target_amount,
  saving_rule_type,
  saving_rule_amount,
  saving_rule_start_amount,
  saving_rule_increment,
  saving_rule_cap,
  saving_rule_day_count,
  saving_rule_start_date,
  reminder_day,
  source
)
select
  b.id,
  b.room_id,
  b.user_id,
  coalesce(b.saving_rule_start_date, (b.created_at at time zone 'Asia/Bangkok')::date),
  b.deadline,
  b.target_amount,
  b.saving_rule_type,
  b.saving_rule_amount,
  b.saving_rule_start_amount,
  b.saving_rule_increment,
  b.saving_rule_cap,
  b.saving_rule_day_count,
  b.saving_rule_start_date,
  b.reminder_day,
  'migration_backfill'
from public.buckets b
where not exists (
  select 1
    from public.bucket_plan_revisions r
   where r.bucket_id = b.id
     and r.source = 'migration_backfill'
);

-- 3. Sanitized status read model --------------------------------------

create or replace function public.room_bucket_pause_statuses(
  p_room_id uuid
)
returns table (
  bucket_id uuid,
  room_id uuid,
  user_id uuid,
  status text,
  is_paused boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
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
    select
      b.id,
      b.room_id,
      b.user_id,
      case when coalesce(p.is_paused, false) then 'paused' else 'active' end,
      coalesce(p.is_paused, false)
    from public.buckets b
    left join lateral (
      select true as is_paused
      from public.bucket_plan_pauses bp
      where bp.bucket_id = b.id
        and bp.paused_from <= v_today
        and (bp.resumed_from is null or bp.resumed_from > v_today)
      limit 1
    ) p on true
    where b.room_id = p_room_id
      and b.archived_at is null
    order by b.user_id asc, b.position asc, b.created_at asc;
end;
$$;

revoke all on function public.room_bucket_pause_statuses(uuid) from public;
grant execute on function public.room_bucket_pause_statuses(uuid) to authenticated;

-- 4. pause_bucket_plan -------------------------------------------------

create or replace function public.pause_bucket_plan(
  p_bucket_id uuid,
  p_paused_from date default null,
  p_client_request_id uuid default null
)
returns table (
  pause_id uuid,
  bucket_id uuid,
  room_id uuid,
  user_id uuid,
  paused_from date,
  resumed_from date,
  created_at timestamptz,
  resumed_at timestamptz,
  reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_paused_from date := coalesce(p_paused_from, (now() at time zone 'Asia/Bangkok')::date);
  v_bucket public.buckets%rowtype;
  v_existing public.bucket_plan_pauses%rowtype;
  v_pause public.bucket_plan_pauses%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_bucket_id is null then
    raise exception 'bucket id required' using errcode = '22023';
  end if;
  if v_paused_from < v_today then
    raise exception 'past bucket pauses are not supported'
      using errcode = '22023', hint = 'bucket_pause_past_date';
  end if;

  if p_client_request_id is not null then
    select * into v_existing
      from public.bucket_plan_pauses bp
     where bp.user_id = v_user_id
       and bp.client_request_id = p_client_request_id
     limit 1;

    if found then
      if v_existing.bucket_id <> p_bucket_id
         or (p_paused_from is not null and v_existing.paused_from <> p_paused_from) then
        raise exception 'client_request_id already used with different pause'
          using errcode = '22023', hint = 'bucket_pause_invalid_request';
      end if;

      return query
        select
          v_existing.id,
          v_existing.bucket_id,
          v_existing.room_id,
          v_existing.user_id,
          v_existing.paused_from,
          v_existing.resumed_from,
          v_existing.created_at,
          v_existing.resumed_at,
          true;
      return;
    end if;
  end if;

  perform 1 from public.buckets where id = p_bucket_id for update;

  select * into v_bucket
    from public.buckets
   where public.buckets.id = p_bucket_id;

  if not found then
    raise exception 'bucket not found' using errcode = 'P0002';
  end if;
  if v_bucket.user_id <> v_user_id then
    raise exception 'cannot pause another user bucket' using errcode = '42501';
  end if;
  if v_bucket.archived_at is not null then
    raise exception 'bucket is archived' using errcode = '22023';
  end if;
  if not public.is_room_member(v_bucket.room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  if exists (
    select 1
      from public.bucket_plan_pauses bp
     where bp.bucket_id = p_bucket_id
       and bp.resumed_from is null
  ) then
    raise exception 'bucket already has an open pause'
      using errcode = '23505', hint = 'bucket_pause_open_exists';
  end if;

  insert into public.bucket_plan_pauses (
    bucket_id,
    room_id,
    user_id,
    paused_from,
    client_request_id
  )
  values (
    p_bucket_id,
    v_bucket.room_id,
    v_user_id,
    v_paused_from,
    p_client_request_id
  )
  returning * into v_pause;

  return query
    select
      v_pause.id,
      v_pause.bucket_id,
      v_pause.room_id,
      v_pause.user_id,
      v_pause.paused_from,
      v_pause.resumed_from,
      v_pause.created_at,
      v_pause.resumed_at,
      false;
end;
$$;

revoke all on function public.pause_bucket_plan(uuid, date, uuid) from public;
grant execute on function public.pause_bucket_plan(uuid, date, uuid) to authenticated;

-- 5. resume_bucket_plan -----------------------------------------------

create or replace function public.resume_bucket_plan(
  p_bucket_id uuid,
  p_resumed_from date default null,
  p_client_request_id uuid default null,
  p_rule_snapshot jsonb default null
)
returns table (
  pause_id uuid,
  bucket_id uuid,
  room_id uuid,
  user_id uuid,
  paused_from date,
  resumed_from date,
  created_at timestamptz,
  resumed_at timestamptz,
  reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_resumed_from date := coalesce(p_resumed_from, (now() at time zone 'Asia/Bangkok')::date);
  v_bucket public.buckets%rowtype;
  v_existing public.bucket_plan_pauses%rowtype;
  v_pause public.bucket_plan_pauses%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_bucket_id is null then
    raise exception 'bucket id required' using errcode = '22023';
  end if;
  if p_rule_snapshot is not null and jsonb_typeof(p_rule_snapshot) <> 'object' then
    raise exception 'rule snapshot must be a JSON object'
      using errcode = '22023', hint = 'bucket_resume_invalid_snapshot';
  end if;

  if p_client_request_id is not null then
    select * into v_existing
      from public.bucket_plan_pauses bp
     where bp.user_id = v_user_id
       and bp.resume_client_request_id = p_client_request_id
     limit 1;

    if found then
      if v_existing.bucket_id <> p_bucket_id
         or (p_resumed_from is not null and v_existing.resumed_from <> p_resumed_from) then
        raise exception 'client_request_id already used with different resume'
          using errcode = '22023', hint = 'bucket_resume_invalid_request';
      end if;

      return query
        select
          v_existing.id,
          v_existing.bucket_id,
          v_existing.room_id,
          v_existing.user_id,
          v_existing.paused_from,
          v_existing.resumed_from,
          v_existing.created_at,
          v_existing.resumed_at,
          true;
      return;
    end if;
  end if;

  perform 1 from public.buckets where id = p_bucket_id for update;

  select * into v_bucket
    from public.buckets
   where public.buckets.id = p_bucket_id;

  if not found then
    raise exception 'bucket not found' using errcode = 'P0002';
  end if;
  if v_bucket.user_id <> v_user_id then
    raise exception 'cannot resume another user bucket' using errcode = '42501';
  end if;
  if v_bucket.archived_at is not null then
    raise exception 'bucket is archived' using errcode = '22023';
  end if;
  if not public.is_room_member(v_bucket.room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  select * into v_pause
    from public.bucket_plan_pauses
   where public.bucket_plan_pauses.bucket_id = p_bucket_id
     and public.bucket_plan_pauses.resumed_from is null
   for update;

  if not found then
    raise exception 'no open pause to resume'
      using errcode = 'P0002', hint = 'bucket_resume_no_open_pause';
  end if;
  if v_resumed_from < v_pause.paused_from then
    raise exception 'resume date cannot be before pause date'
      using errcode = '22023', hint = 'bucket_resume_before_pause';
  end if;

  update public.bucket_plan_pauses
     set resumed_from = v_resumed_from,
         resumed_at = now(),
         resume_client_request_id = p_client_request_id
   where id = v_pause.id
   returning * into v_pause;

  if p_rule_snapshot is not null then
    update public.buckets
       set deadline = case
             when p_rule_snapshot ? 'deadline'
               then nullif(p_rule_snapshot ->> 'deadline', '')::date
             else deadline
           end,
           target_amount = case
             when p_rule_snapshot ? 'target_amount'
               then nullif(p_rule_snapshot ->> 'target_amount', '')::numeric
             else target_amount
           end,
           saving_rule_type = case
             when p_rule_snapshot ? 'saving_rule_type'
               then nullif(p_rule_snapshot ->> 'saving_rule_type', '')
             else saving_rule_type
           end,
           saving_rule_amount = case
             when p_rule_snapshot ? 'saving_rule_amount'
               then nullif(p_rule_snapshot ->> 'saving_rule_amount', '')::numeric
             else saving_rule_amount
           end,
           saving_rule_start_amount = case
             when p_rule_snapshot ? 'saving_rule_start_amount'
               then nullif(p_rule_snapshot ->> 'saving_rule_start_amount', '')::numeric
             else saving_rule_start_amount
           end,
           saving_rule_increment = case
             when p_rule_snapshot ? 'saving_rule_increment'
               then nullif(p_rule_snapshot ->> 'saving_rule_increment', '')::numeric
             else saving_rule_increment
           end,
           saving_rule_cap = case
             when p_rule_snapshot ? 'saving_rule_cap'
               then nullif(p_rule_snapshot ->> 'saving_rule_cap', '')::numeric
             else saving_rule_cap
           end,
           saving_rule_day_count = case
             when p_rule_snapshot ? 'saving_rule_day_count'
               then nullif(p_rule_snapshot ->> 'saving_rule_day_count', '')::integer
             else saving_rule_day_count
           end,
           saving_rule_start_date = case
             when p_rule_snapshot ? 'saving_rule_start_date'
               then nullif(p_rule_snapshot ->> 'saving_rule_start_date', '')::date
             else saving_rule_start_date
           end,
           reminder_day = case
             when p_rule_snapshot ? 'reminder_day'
               then nullif(p_rule_snapshot ->> 'reminder_day', '')::integer
             else reminder_day
           end
     where id = p_bucket_id;

    select * into v_bucket
      from public.buckets
     where public.buckets.id = p_bucket_id;
  end if;

  insert into public.bucket_plan_revisions (
    bucket_id,
    room_id,
    user_id,
    effective_from_date,
    deadline,
    target_amount,
    saving_rule_type,
    saving_rule_amount,
    saving_rule_start_amount,
    saving_rule_increment,
    saving_rule_cap,
    saving_rule_day_count,
    saving_rule_start_date,
    reminder_day,
    source
  )
  values (
    v_bucket.id,
    v_bucket.room_id,
    v_bucket.user_id,
    v_resumed_from,
    v_bucket.deadline,
    v_bucket.target_amount,
    v_bucket.saving_rule_type,
    v_bucket.saving_rule_amount,
    v_bucket.saving_rule_start_amount,
    v_bucket.saving_rule_increment,
    v_bucket.saving_rule_cap,
    v_bucket.saving_rule_day_count,
    v_bucket.saving_rule_start_date,
    v_bucket.reminder_day,
    'resume_recalculated'
  );

  return query
    select
      v_pause.id,
      v_pause.bucket_id,
      v_pause.room_id,
      v_pause.user_id,
      v_pause.paused_from,
      v_pause.resumed_from,
      v_pause.created_at,
      v_pause.resumed_at,
      false;
end;
$$;

revoke all on function public.resume_bucket_plan(uuid, date, uuid, jsonb) from public;
grant execute on function public.resume_bucket_plan(uuid, date, uuid, jsonb) to authenticated;

commit;
