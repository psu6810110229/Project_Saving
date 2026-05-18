-- ============================================================
-- 0051_streak_freeze.sql
--
-- SPRINT1-003: Streak Freeze (grace days).
--
-- A user's day-by-day save streak survives a small, capped number of
-- missed days each Bangkok calendar month. Two tables back this:
--
--   * streak_freeze_budgets — one row per user holding the monthly
--     cap (default 2). Lazily inserted by the RPC on first call.
--   * streak_freeze_usages  — append-only audit row each time a
--     freeze is spent. One row per Bangkok-local date frozen.
--
-- The savings_logs table is never written to, mutated, or back-dated
-- by this flow. The streak helper consults both tables when computing
-- the displayed streak number.
--
-- RLS shape:
--   * streak_freeze_budgets — self-select / self-update. No client
--     insert (handled lazily inside the RPC).
--   * streak_freeze_usages  — read by the row owner OR any user who
--     shares a room with the owner. The cross-room read leaves the
--     door open for a future partner-visible "frozen" indicator on
--     the leaderboard; Sprint 1 UI does not consume it. No client
--     insert / update / delete — writes flow through the RPC.
-- ============================================================

begin;

-- ── streak_freeze_budgets ───────────────────────────────────────

create table if not exists public.streak_freeze_budgets (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  monthly_budget smallint not null default 2,
  updated_at     timestamptz not null default now(),
  constraint streak_freeze_budgets_budget_nonneg
    check (monthly_budget >= 0)
);

alter table public.streak_freeze_budgets enable row level security;

drop policy if exists "streak_freeze_budgets_self_select" on public.streak_freeze_budgets;
drop policy if exists "streak_freeze_budgets_self_update" on public.streak_freeze_budgets;

create policy "streak_freeze_budgets_self_select"
  on public.streak_freeze_budgets
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "streak_freeze_budgets_self_update"
  on public.streak_freeze_budgets
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── streak_freeze_usages ────────────────────────────────────────

create table if not exists public.streak_freeze_usages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  frozen_date  date not null,
  month_key    text not null,
  created_at   timestamptz not null default now(),
  constraint streak_freeze_usages_unique unique (user_id, frozen_date)
);

create index if not exists idx_streak_freeze_usages_user_month
  on public.streak_freeze_usages (user_id, month_key);

alter table public.streak_freeze_usages enable row level security;

drop policy if exists "streak_freeze_usages_self_or_room" on public.streak_freeze_usages;

create policy "streak_freeze_usages_self_or_room"
  on public.streak_freeze_usages
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.room_members rm_self
      join public.room_members rm_other on rm_other.room_id = rm_self.room_id
      where rm_self.user_id = auth.uid()
        and rm_other.user_id = streak_freeze_usages.user_id
    )
  );

-- No client insert / update / delete. Writes go through the RPC.

-- ── consume_streak_freezes_if_needed RPC ────────────────────────
-- Idempotent server-side write path. Called from
-- src/hooks/useStreakFreeze.ts on every app entry and after each
-- successful deposit insert. Walks the caller's positive savings_logs
-- in Bangkok-local dates backward from p_evaluation_date and inserts
-- a streak_freeze_usages row for each gap day that is:
--   1. flanked on the older side by a raw save day in savings_logs
--      (already-frozen days do not back-propagate the chain, so two
--      consecutive raw misses always break the streak),
--   2. not already in streak_freeze_usages,
--   3. inside the same Bangkok calendar month as p_evaluation_date,
--   4. covered by remaining monthly budget.
--
-- Returns:
--   frozen_dates       — date[] of gap days newly inserted this call
--                        (may be empty),
--   remaining_in_month — smallint budget left after these inserts.

create or replace function public.consume_streak_freezes_if_needed(
  p_evaluation_date date
)
returns table(frozen_dates date[], remaining_in_month smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor       uuid := auth.uid();
  v_budget      smallint;
  v_used        smallint;
  v_remaining   smallint;
  v_month       text;
  v_eval        date := p_evaluation_date;
  v_cursor      date;
  v_oldest      date;
  v_save_days   date[];
  v_frozen_days date[];
  v_inserted    date[] := array[]::date[];
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_eval is null then
    -- Caller should always pass a Bangkok-local date; fall back so a
    -- missing arg cannot crash the streak-render path on the client.
    v_eval := (now() at time zone 'Asia/Bangkok')::date;
  end if;

  v_month  := to_char(v_eval, 'YYYY-MM');
  v_oldest := v_eval - 90;

  -- Ensure a budget row exists for the caller.
  insert into public.streak_freeze_budgets (user_id)
  values (v_actor)
  on conflict (user_id) do nothing;

  select monthly_budget into v_budget
  from public.streak_freeze_budgets
  where user_id = v_actor;

  select count(*)::smallint into v_used
  from public.streak_freeze_usages
  where user_id = v_actor
    and month_key = v_month;

  v_remaining := greatest(0, (v_budget - v_used))::smallint;

  -- Bangkok-local save day set, bounded to the recent 90 days so a
  -- long history does not blow up the function.
  select coalesce(array_agg(distinct d order by d), array[]::date[])
    into v_save_days
  from (
    select ((created_at at time zone 'Asia/Bangkok')::date) as d
    from public.savings_logs
    where user_id = v_actor
      and amount > 0
      and (created_at at time zone 'Asia/Bangkok')::date between v_oldest and v_eval
  ) s;

  select coalesce(array_agg(frozen_date order by frozen_date), array[]::date[])
    into v_frozen_days
  from public.streak_freeze_usages
  where user_id = v_actor
    and frozen_date between v_oldest and v_eval;

  if v_remaining <= 0 or cardinality(v_save_days) = 0 then
    return query select v_inserted, v_remaining;
    return;
  end if;

  -- Walk start: today, or yesterday if today has no save/freeze yet.
  v_cursor := v_eval;
  if not (v_cursor = any(v_save_days)) and not (v_cursor = any(v_frozen_days)) then
    v_cursor := v_cursor - 1;
  end if;
  if not (v_cursor = any(v_save_days)) and not (v_cursor = any(v_frozen_days)) then
    return query select v_inserted, v_remaining;
    return;
  end if;

  -- Walk backward through the chain. Already-frozen days continue the
  -- chain but do not act as the "older save" flank for a new freeze.
  loop
    exit when v_cursor < v_oldest;

    if (v_cursor = any(v_save_days)) or (v_cursor = any(v_frozen_days)) then
      v_cursor := v_cursor - 1;
      continue;
    end if;

    -- v_cursor is a gap day. Decide whether to freeze it.
    if v_remaining <= 0 then exit; end if;
    if to_char(v_cursor, 'YYYY-MM') <> v_month then exit; end if;

    -- "Strictly between two save days": the older flank (cursor - 1)
    -- must be a raw save in savings_logs. Frozen days are not allowed
    -- as the older flank — that enforces "two consecutive missed days
    -- never auto-freeze".
    if not ((v_cursor - 1) = any(v_save_days)) then exit; end if;

    insert into public.streak_freeze_usages (user_id, frozen_date, month_key)
    values (v_actor, v_cursor, to_char(v_cursor, 'YYYY-MM'))
    on conflict (user_id, frozen_date) do nothing;

    v_inserted    := array_append(v_inserted, v_cursor);
    v_frozen_days := array_append(v_frozen_days, v_cursor);
    v_remaining   := (v_remaining - 1)::smallint;
    v_cursor      := v_cursor - 1;
  end loop;

  return query select v_inserted, v_remaining;
end;
$$;

revoke all on function public.consume_streak_freezes_if_needed(date) from public;
grant execute on function public.consume_streak_freezes_if_needed(date) to authenticated;

commit;
