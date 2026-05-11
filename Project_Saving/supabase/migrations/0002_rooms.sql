-- ============================================================
-- Task 18 — Rooms (Battle Circles)
-- supabase/migrations/0002_rooms.sql
-- ============================================================

begin;

-- ── 1. New tables ─────────────────────────────────────────────

create table rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  end_date    date not null,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create table room_members (
  room_id   uuid not null references rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index idx_room_members_user on room_members(user_id);

-- ── 2. Schema changes ─────────────────────────────────────────

alter table goals       add column room_id uuid references rooms(id) on delete cascade;
alter table savings_logs add column room_id uuid references rooms(id) on delete cascade;

-- ── 3. Backfill existing data into default "Japan 2027" room ──

do $$
declare
  default_room_id uuid;
begin
  -- Create one default room
  insert into rooms (name, invite_code, end_date, created_by)
  select
    'Japan 2027',
    'JAPAN7',
    '2027-11-01',
    id
  from auth.users
  order by created_at asc
  limit 1
  returning id into default_room_id;

  -- Add every existing user as a member
  insert into room_members (room_id, user_id)
  select default_room_id, id
  from auth.users
  on conflict do nothing;

  -- Backfill goals
  update goals set room_id = default_room_id where room_id is null;

  -- Backfill savings_logs
  update savings_logs set room_id = default_room_id where room_id is null;
end $$;

-- ── 4. Make room_id not null after backfill ───────────────────

alter table goals        alter column room_id set not null;
alter table savings_logs alter column room_id set not null;

-- ── 5. RLS ────────────────────────────────────────────────────

alter table rooms        enable row level security;
alter table room_members enable row level security;

-- rooms: select if you are a member
create policy "rooms_select_member"
  on rooms for select
  using (
    exists (
      select 1 from room_members rm
      where rm.room_id = rooms.id and rm.user_id = auth.uid()
    )
  );

-- rooms: any authed user can create
create policy "rooms_insert_authed"
  on rooms for insert
  with check (auth.uid() is not null);

-- rooms: only creator can update/delete
create policy "rooms_update_creator"
  on rooms for update
  using (created_by = auth.uid());

create policy "rooms_delete_creator"
  on rooms for delete
  using (created_by = auth.uid());

-- room_members: select if you are a member of the same room
create policy "room_members_select"
  on room_members for select
  using (
    exists (
      select 1 from room_members rm2
      where rm2.room_id = room_members.room_id and rm2.user_id = auth.uid()
    )
  );

-- room_members: self-insert allowed (handled via RPC, but allow direct for creator)
create policy "room_members_insert_self"
  on room_members for insert
  with check (user_id = auth.uid());

-- room_members: self-delete (leave)
create policy "room_members_delete_self"
  on room_members for delete
  using (user_id = auth.uid());

-- goals: extend existing policies to require room membership
-- (Drop old permissive policies if they exist, add room-scoped ones)
drop policy if exists "Users can insert their own goal" on goals;
drop policy if exists "Users can select their own goal" on goals;
drop policy if exists "Users can update their own goal" on goals;
drop policy if exists "Users can upsert their own goal" on goals;
drop policy if exists "Users can read all goals" on goals;
drop policy if exists "Members can read goals in their rooms" on goals;

create policy "goals_member_select"
  on goals for select
  using (
    exists (
      select 1 from room_members rm
      where rm.room_id = goals.room_id and rm.user_id = auth.uid()
    )
  );

create policy "goals_own_upsert"
  on goals for insert
  with check (user_id = auth.uid());

create policy "goals_own_update"
  on goals for update
  using (user_id = auth.uid());

-- savings_logs: extend to require room membership
drop policy if exists "Users can insert their own logs" on savings_logs;
drop policy if exists "Users can select all logs" on savings_logs;
drop policy if exists "Members can read logs in their rooms" on savings_logs;

create policy "logs_member_select"
  on savings_logs for select
  using (
    exists (
      select 1 from room_members rm
      where rm.room_id = savings_logs.room_id and rm.user_id = auth.uid()
    )
  );

create policy "logs_own_insert"
  on savings_logs for insert
  with check (user_id = auth.uid());

-- ── 6. join_room_by_code RPC ──────────────────────────────────

create or replace function join_room_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
begin
  select id into target_room_id
  from rooms
  where invite_code = upper(trim(code))
  limit 1;

  if target_room_id is null then
    return null;
  end if;

  insert into room_members (room_id, user_id)
  values (target_room_id, auth.uid())
  on conflict do nothing;

  return target_room_id;
end;
$$;

commit;
