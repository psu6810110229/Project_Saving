-- ============================================================
-- Task 19 - Buckets (Sub-Goals)
-- Depends on: 0002_rooms.sql, 0003_fix_rooms_rls.sql
--
-- Repair-friendly: safe to rerun after a partial/manual Supabase reset.
-- ============================================================

begin;

-- 1. Create buckets table

create table if not exists public.buckets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  room_id       uuid not null references public.rooms(id) on delete cascade,
  name          text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  unique(user_id, room_id, name)
);

create index if not exists idx_buckets_user_room
  on public.buckets(user_id, room_id);

-- 2. Enforce 10-bucket-per-(user, room) limit

create or replace function public.enforce_bucket_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.buckets
    where user_id = new.user_id and room_id = new.room_id
  ) >= 10 then
    raise exception 'Bucket limit reached (10 per room)';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bucket_limit on public.buckets;
create trigger trg_bucket_limit
  before insert on public.buckets
  for each row execute function public.enforce_bucket_limit();

-- 3. Add bucket_id to savings_logs

alter table public.savings_logs
  add column if not exists bucket_id uuid references public.buckets(id) on delete restrict;

-- 4. Backfill: one "General" bucket per (user_id, room_id)

do $$
declare
  rec record;
  v_bucket_id uuid;
  goal_amount numeric;
begin
  delete from public.savings_logs
  where room_id is not null
    and room_id not in (select id from public.rooms);

  delete from public.goals
  where room_id is not null
    and room_id not in (select id from public.rooms);

  for rec in
    select distinct combined.user_id, combined.room_id
    from (
      select user_id, room_id from public.savings_logs where room_id is not null
      union
      select user_id, room_id from public.goals where room_id is not null
    ) combined
    inner join public.rooms r on r.id = combined.room_id
  loop
    select target_amount into goal_amount
    from public.goals
    where user_id = rec.user_id and room_id = rec.room_id
    limit 1;

    if goal_amount is null then
      goal_amount := 1;
    end if;

    insert into public.buckets (user_id, room_id, name, target_amount, position)
    values (rec.user_id, rec.room_id, 'General', goal_amount, 0)
    on conflict (user_id, room_id, name) do nothing
    returning id into v_bucket_id;

    if v_bucket_id is null then
      select id into v_bucket_id
      from public.buckets
      where user_id = rec.user_id and room_id = rec.room_id and name = 'General';
    end if;

    update public.savings_logs
    set bucket_id = v_bucket_id
    where user_id = rec.user_id
      and room_id = rec.room_id
      and bucket_id is null;
  end loop;
end $$;

-- 5. Make bucket_id not null when the backfill is complete

do $$
begin
  if not exists (select 1 from public.savings_logs where bucket_id is null) then
    alter table public.savings_logs alter column bucket_id set not null;
  end if;
end $$;

-- 6. RLS - buckets

alter table public.buckets enable row level security;

drop policy if exists "buckets_own_select" on public.buckets;
drop policy if exists "buckets_own_insert" on public.buckets;
drop policy if exists "buckets_own_update" on public.buckets;
drop policy if exists "buckets_own_delete" on public.buckets;

create policy "buckets_own_select"
  on public.buckets for select
  using (user_id = auth.uid());

create policy "buckets_own_insert"
  on public.buckets for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.room_members rm
      where rm.room_id = buckets.room_id and rm.user_id = auth.uid()
    )
  );

create policy "buckets_own_update"
  on public.buckets for update
  using (user_id = auth.uid());

create policy "buckets_own_delete"
  on public.buckets for delete
  using (user_id = auth.uid());

-- 7. RLS - savings_logs: ensure bucket belongs to inserter

drop policy if exists "logs_own_insert" on public.savings_logs;

create policy "logs_own_insert"
  on public.savings_logs for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.buckets b
      where b.id = savings_logs.bucket_id and b.user_id = auth.uid()
    )
  );

commit;
