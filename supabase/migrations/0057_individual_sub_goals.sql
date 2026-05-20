-- ============================================================
-- 0057_individual_sub_goals.sql
-- Task 37 - Individual personal sub-goals under a room goal.
--
-- Shifts the canonical "shared project goal" onto the rooms table
-- and reframes goals.target_amount as each member's personal
-- sub-goal under the room goal. Adds defense-in-depth triggers,
-- the new update_member_goal RPC, replaces update_room_goal with
-- a body that only touches rooms.target_amount + rooms.end_date,
-- and rewires _smart_check_goal_reached to read the room target
-- from rooms.target_amount instead of any member's goals row.
--
-- The backfill is intentionally the current visible Vault
-- denominator (sum of member personal goals) per the approved
-- tradeoff in docs/plans/37-individual-sub-goals.md.
-- ============================================================

begin;

-- 1. Schema -----------------------------------------------------

alter table public.rooms
  add column if not exists target_amount numeric(12,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rooms_target_amount_positive'
      and conrelid = 'public.rooms'::regclass
  ) then
    alter table public.rooms
      add constraint rooms_target_amount_positive
      check (target_amount is null or target_amount > 0);
  end if;
end $$;

-- 2. Backfill ---------------------------------------------------
-- For each room with current member goal rows, set
-- rooms.target_amount to the sum of positive goals.target_amount
-- across current room_members. This preserves the current visible
-- Dashboard Vault denominator. For rooms with no current-member
-- goals but a historical goal row, fall back to the max positive
-- goal. Leave NULL only when no positive source exists.

update public.rooms r
   set target_amount = sub.member_sum
  from (
    select rm.room_id, sum(g.target_amount) as member_sum
      from public.room_members rm
      join public.goals g
        on g.room_id = rm.room_id
       and g.user_id = rm.user_id
     where g.target_amount > 0
     group by rm.room_id
  ) sub
 where sub.room_id = r.id
   and r.target_amount is null;

update public.rooms r
   set target_amount = sub.fallback_target
  from (
    select g.room_id, max(g.target_amount) as fallback_target
      from public.goals g
     where g.target_amount > 0
     group by g.room_id
  ) sub
 where sub.room_id = r.id
   and r.target_amount is null;

-- Verification SQL (read-only; safe to leave in the migration).
-- Future _not null_ follow-up must confirm zero rows return here.
do $$
declare
  v_null_rooms int;
  v_room_below_personal int;
  v_member_below_buckets int;
  v_nonpositive_log int;
begin
  select count(*) into v_null_rooms
    from public.rooms r
   where r.target_amount is null
     and r.archived_at is null;

  -- Verification is scoped to CURRENT room members; stale leaver goal
  -- rows must not count against an otherwise consistent room.
  select count(*) into v_room_below_personal
    from public.rooms r
    join public.goals g on g.room_id = r.id
    join public.room_members rm
      on rm.room_id = g.room_id
     and rm.user_id = g.user_id
   where r.target_amount is not null
     and g.target_amount > r.target_amount;

  select count(*) into v_member_below_buckets
    from (
      select g.user_id, g.room_id, g.target_amount as personal,
             coalesce(sum(b.target_amount), 0) as bucket_sum
        from public.goals g
        join public.room_members rm
          on rm.room_id = g.room_id
         and rm.user_id = g.user_id
        left join public.buckets b
          on b.user_id = g.user_id
         and b.room_id = g.room_id
       group by g.user_id, g.room_id, g.target_amount
    ) t
   where t.personal < t.bucket_sum;

  select count(*) into v_nonpositive_log
    from public.savings_logs
   where amount <= 0;

  raise notice 'Task 37 backfill verification: null_rooms=%, room_below_personal=%, member_below_buckets=%, nonpositive_logs=%',
    v_null_rooms, v_room_below_personal, v_member_below_buckets, v_nonpositive_log;
end $$;

-- 3. Invariant triggers ----------------------------------------

-- rooms.target_amount: reject non-positive values and reject
-- lowering below any current member's personal sub-goal.
create or replace function public.enforce_room_target_amount_invariant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_personal numeric;
begin
  if new.target_amount is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.target_amount is not distinct from new.target_amount then
    return new;
  end if;

  if new.target_amount <= 0 then
    raise exception 'rooms.target_amount must be greater than 0'
      using errcode = '23514';
  end if;

  -- Only consider personal sub-goals belonging to CURRENT room members.
  -- A user who left the room may leave behind a high historical goal
  -- row; ignoring those rows prevents valid creator edits from being
  -- rejected forever.
  select coalesce(max(g.target_amount), 0)
    into v_max_personal
    from public.goals g
    join public.room_members rm
      on rm.room_id = g.room_id
     and rm.user_id = g.user_id
   where g.room_id = new.id
     and g.target_amount > 0;

  if new.target_amount < v_max_personal then
    raise exception 'rooms.target_amount cannot be lower than the highest personal sub-goal (%)', v_max_personal
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rooms_target_amount_invariant on public.rooms;
create trigger trg_rooms_target_amount_invariant
  before insert or update on public.rooms
  for each row execute function public.enforce_room_target_amount_invariant();

-- goals.target_amount: personal sub-goal must be > 0, must be
-- <= rooms.target_amount (when set), and must be >= owner's
-- bucket target total. Bootstrap and self-edit paths must pass.
create or replace function public.enforce_personal_goal_target_invariant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_target numeric;
  v_bucket_sum numeric;
begin
  if new.target_amount is null or new.target_amount <= 0 then
    raise exception 'goals.target_amount must be greater than 0'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and old.target_amount is not distinct from new.target_amount
     and old.room_id is not distinct from new.room_id
     and old.user_id is not distinct from new.user_id then
    return new;
  end if;

  select r.target_amount
    into v_room_target
    from public.rooms r
   where r.id = new.room_id;

  if v_room_target is not null and new.target_amount > v_room_target then
    raise exception 'Personal sub-goal (%) cannot exceed room goal (%)', new.target_amount, v_room_target
      using errcode = '23514';
  end if;

  select coalesce(sum(b.target_amount), 0)
    into v_bucket_sum
    from public.buckets b
   where b.user_id = new.user_id
     and b.room_id = new.room_id;

  if new.target_amount < v_bucket_sum then
    raise exception 'Personal sub-goal (%) cannot be less than your bucket target total (%)', new.target_amount, v_bucket_sum
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_goals_personal_target_invariant on public.goals;
create trigger trg_goals_personal_target_invariant
  before insert or update on public.goals
  for each row execute function public.enforce_personal_goal_target_invariant();

-- 4. RPC: update_room_goal (creator-only; room target + end date) -----

create or replace function public.update_room_goal(
  p_room_id uuid,
  p_target_amount numeric,
  p_end_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_creator uuid;
  v_archived_at timestamptz;
  v_max_personal numeric;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'target amount must be greater than 0' using errcode = '22023';
  end if;

  if p_end_date is null then
    raise exception 'end date is required' using errcode = '22023';
  end if;

  select r.created_by, r.archived_at
    into v_creator, v_archived_at
    from public.rooms r
   where r.id = p_room_id;

  if v_creator is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;

  if v_archived_at is not null then
    raise exception 'room is archived' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.room_members rm
     where rm.room_id = p_room_id
       and rm.user_id = v_caller
  ) then
    raise exception 'caller is not a room member' using errcode = '42501';
  end if;

  if v_creator <> v_caller then
    raise exception 'only the room creator can update the shared project goal'
      using errcode = '42501';
  end if;

  -- Only consider personal sub-goals belonging to CURRENT room members.
  -- See enforce_room_target_amount_invariant for the same guardrail.
  select coalesce(max(g.target_amount), 0)
    into v_max_personal
    from public.goals g
    join public.room_members rm
      on rm.room_id = g.room_id
     and rm.user_id = g.user_id
   where g.room_id = p_room_id
     and g.target_amount > 0;

  if p_target_amount < v_max_personal then
    raise exception 'room goal cannot be lower than the highest personal sub-goal (%)', v_max_personal
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from public.goals g
     where g.room_id = p_room_id
       and g.start_date > p_end_date
  ) then
    raise exception 'end date cannot be before an existing goal start date'
      using errcode = '22023';
  end if;

  update public.rooms
     set target_amount = p_target_amount,
         end_date = p_end_date
   where id = p_room_id;
end;
$$;

revoke all on function public.update_room_goal(uuid, numeric, date) from public;
grant execute on function public.update_room_goal(uuid, numeric, date) to authenticated;

-- 5. RPC: update_member_goal (self-only personal sub-goal) --------

create or replace function public.update_member_goal(
  p_room_id uuid,
  p_target_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_room_target numeric;
  v_archived_at timestamptz;
  v_room_end_date date;
  v_bucket_sum numeric;
  v_existing_start date;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'target amount must be greater than 0' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.room_members rm
     where rm.room_id = p_room_id
       and rm.user_id = v_caller
  ) then
    raise exception 'caller is not a room member' using errcode = '42501';
  end if;

  select r.target_amount, r.archived_at, r.end_date
    into v_room_target, v_archived_at, v_room_end_date
    from public.rooms r
   where r.id = p_room_id;

  if v_archived_at is not null then
    raise exception 'room is archived' using errcode = '42501';
  end if;

  if v_room_target is null then
    raise exception 'room goal not set' using errcode = '22023';
  end if;

  if p_target_amount > v_room_target then
    raise exception 'personal sub-goal cannot exceed room goal (%)', v_room_target
      using errcode = '23514';
  end if;

  select coalesce(sum(b.target_amount), 0)
    into v_bucket_sum
    from public.buckets b
   where b.user_id = v_caller
     and b.room_id = p_room_id;

  if p_target_amount < v_bucket_sum then
    raise exception 'personal sub-goal cannot be less than your bucket target total (%)', v_bucket_sum
      using errcode = '23514';
  end if;

  select g.start_date
    into v_existing_start
    from public.goals g
   where g.user_id = v_caller
     and g.room_id = p_room_id;

  insert into public.goals (
    user_id,
    room_id,
    target_amount,
    start_date,
    end_date,
    updated_at
  )
  values (
    v_caller,
    p_room_id,
    p_target_amount,
    coalesce(v_existing_start, least(current_date, v_room_end_date)),
    v_room_end_date,
    now()
  )
  on conflict (user_id, room_id) do update
    set target_amount = excluded.target_amount,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.update_member_goal(uuid, numeric) from public;
grant execute on function public.update_member_goal(uuid, numeric) to authenticated;

-- 6. bootstrap_joiner_goal: seed from rooms.target_amount --------

create or replace function public.bootstrap_joiner_goal(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_room_target numeric;
  v_room_end date;
  v_seed_target numeric;
begin
  if v_caller is null then
    raise exception 'must be authenticated';
  end if;

  if not exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = v_caller
  ) then
    raise exception 'caller is not a member of room %', p_room_id;
  end if;

  select r.target_amount, r.end_date
    into v_room_target, v_room_end
    from public.rooms r
   where r.id = p_room_id;

  if v_room_end is null then
    raise exception 'room % does not exist', p_room_id;
  end if;

  if v_room_target is not null and v_room_target > 0 then
    v_seed_target := v_room_target;
  else
    -- Fallback only considers personal sub-goals owned by CURRENT
    -- room members so a stale leaver row cannot seed the joiner.
    select max(g.target_amount)
      into v_seed_target
      from public.goals g
      join public.room_members rm
        on rm.room_id = g.room_id
       and rm.user_id = g.user_id
     where g.room_id = p_room_id
       and g.target_amount > 0;
  end if;

  -- goals.target_amount is positive-only; if no positive source
  -- exists we cannot seed safely. The joiner can set their
  -- personal sub-goal via update_member_goal afterwards.
  if v_seed_target is null or v_seed_target <= 0 then
    return;
  end if;

  insert into public.goals (user_id, room_id, target_amount, start_date, end_date, updated_at)
  values (v_caller, p_room_id, v_seed_target, least(current_date, v_room_end), v_room_end, now())
  on conflict (user_id, room_id) do nothing;
end;
$$;

revoke all on function public.bootstrap_joiner_goal(uuid) from public;
grant execute on function public.bootstrap_joiner_goal(uuid) to authenticated;

-- 7. _smart_check_goal_reached: read rooms.target_amount --------
-- Only the target source changes from migration 0055. Fan-out
-- recipients (loop over every current room member), dedupe shape,
-- per-recipient strict crossing logic with v_log_created_at /
-- v_prev_total / v_new_total, push behavior, and notification
-- transport are all preserved verbatim from 0055.

create or replace function public._smart_check_goal_reached(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_user       uuid;
  v_room_id        uuid;
  v_amount         numeric;
  v_log_created_at timestamptz;
  v_target         numeric;
  v_prev_total     numeric;
  v_new_total      numeric;
  v_dedupe         text;
  v_member         record;
begin
  select s.user_id, s.room_id, s.amount, s.created_at
    into v_log_user, v_room_id, v_amount, v_log_created_at
  from public.savings_logs s
  where s.id = p_log_id;

  if v_amount is null or v_amount <= 0 then
    return;
  end if;

  -- Task 37: the shared project target lives on rooms.target_amount.
  select r.target_amount into v_target
    from public.rooms r
   where r.id = v_room_id;

  if v_target is null or v_target <= 0 then
    return;
  end if;

  -- Combined room total just before this log landed.
  select coalesce(sum(amount), 0)::numeric into v_prev_total
  from public.savings_logs
  where room_id = v_room_id
    and id <> p_log_id
    and created_at <= v_log_created_at;

  v_new_total := v_prev_total + v_amount;

  -- Strict crossing only.
  if v_prev_total >= v_target then
    return;
  end if;
  if v_new_total < v_target then
    return;
  end if;

  -- Fan out to every current room member (the depositor included).
  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_room_id
  loop
    v_dedupe := 'goal_reached:' || v_room_id::text || ':' || v_target::text
                || ':' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_log_user, v_room_id, 'goal_reached', v_dedupe,
      'Goal reached',
      'The project hit its savings target.',
      'View dashboard',
      '/dashboard', null, '/dashboard',
      false,
      jsonb_build_object('target_amount', v_target),
      'rooms', v_room_id
    );
  end loop;
end;
$$;

revoke all on function public._smart_check_goal_reached(uuid) from public;
revoke all on function public._smart_check_goal_reached(uuid) from authenticated;

commit;
