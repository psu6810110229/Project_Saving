-- ============================================================
-- Task 18 - Rooms (Battle Circles)
-- supabase/migrations/0002_rooms.sql
--
-- Repair-friendly: safe to rerun after a partial/manual Supabase reset.
-- ============================================================

begin;

-- 1. New tables

create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  end_date    date not null,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists idx_room_members_user on public.room_members(user_id);

-- 2. Schema changes

alter table public.goals
  add column if not exists room_id uuid references public.rooms(id) on delete cascade;

alter table public.savings_logs
  add column if not exists room_id uuid references public.rooms(id) on delete cascade;

-- 3. Backfill existing data into default "Japan 2027" room

do $$
declare
  default_room_id uuid;
  first_user_id uuid;
begin
  select id into first_user_id
  from auth.users
  order by created_at asc
  limit 1;

  select id into default_room_id
  from public.rooms
  where invite_code = 'JAPAN7'
  limit 1;

  if default_room_id is null and first_user_id is not null then
    insert into public.rooms (name, invite_code, end_date, created_by)
    values ('Japan 2027', 'JAPAN7', '2027-11-01', first_user_id)
    returning id into default_room_id;
  end if;

  if default_room_id is not null then
    insert into public.room_members (room_id, user_id)
    select default_room_id, id
    from auth.users
    on conflict do nothing;

    update public.goals
    set room_id = default_room_id
    where room_id is null;

    update public.savings_logs
    set room_id = default_room_id
    where room_id is null;
  end if;
end $$;

-- 4. Make room_id not null when the backfill is complete

do $$
begin
  if not exists (select 1 from public.goals where room_id is null) then
    alter table public.goals alter column room_id set not null;
  end if;

  if not exists (select 1 from public.savings_logs where room_id is null) then
    alter table public.savings_logs alter column room_id set not null;
  end if;
end $$;

-- 5. RLS

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

drop policy if exists "rooms_select_member"  on public.rooms;
drop policy if exists "rooms_select_creator" on public.rooms;
drop policy if exists "rooms_insert_authed"  on public.rooms;
drop policy if exists "rooms_update_creator" on public.rooms;
drop policy if exists "rooms_delete_creator" on public.rooms;

create policy "rooms_select_member"
  on public.rooms for select
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = rooms.id and rm.user_id = auth.uid()
    )
  );

create policy "rooms_select_creator"
  on public.rooms for select
  using (created_by = auth.uid());

create policy "rooms_insert_authed"
  on public.rooms for insert
  with check (auth.uid() is not null);

create policy "rooms_update_creator"
  on public.rooms for update
  using (created_by = auth.uid());

create policy "rooms_delete_creator"
  on public.rooms for delete
  using (created_by = auth.uid());

drop policy if exists "room_members_select"      on public.room_members;
drop policy if exists "room_members_insert_self" on public.room_members;
drop policy if exists "room_members_delete_self" on public.room_members;

create policy "room_members_select"
  on public.room_members for select
  using (user_id = auth.uid());

create policy "room_members_insert_self"
  on public.room_members for insert
  with check (user_id = auth.uid());

create policy "room_members_delete_self"
  on public.room_members for delete
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own goal" on public.goals;
drop policy if exists "Users can select their own goal" on public.goals;
drop policy if exists "Users can update their own goal" on public.goals;
drop policy if exists "Users can upsert their own goal" on public.goals;
drop policy if exists "Users can read all goals" on public.goals;
drop policy if exists "Members can read goals in their rooms" on public.goals;
drop policy if exists "goals_member_select" on public.goals;
drop policy if exists "goals_own_upsert" on public.goals;
drop policy if exists "goals_own_update" on public.goals;

create policy "goals_member_select"
  on public.goals for select
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = goals.room_id and rm.user_id = auth.uid()
    )
  );

create policy "goals_own_upsert"
  on public.goals for insert
  with check (user_id = auth.uid());

create policy "goals_own_update"
  on public.goals for update
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own logs" on public.savings_logs;
drop policy if exists "Users can select all logs" on public.savings_logs;
drop policy if exists "Members can read logs in their rooms" on public.savings_logs;
drop policy if exists "logs_member_select" on public.savings_logs;
drop policy if exists "logs_own_insert" on public.savings_logs;

create policy "logs_member_select"
  on public.savings_logs for select
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = savings_logs.room_id and rm.user_id = auth.uid()
    )
  );

create policy "logs_own_insert"
  on public.savings_logs for insert
  with check (user_id = auth.uid());

-- 6. join_room_by_code RPC

create or replace function public.join_room_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
begin
  select id into target_room_id
  from public.rooms
  where invite_code = upper(trim(code))
  limit 1;

  if target_room_id is null then
    return null;
  end if;

  insert into public.room_members (room_id, user_id)
  values (target_room_id, auth.uid())
  on conflict do nothing;

  return target_room_id;
end;
$$;

commit;
