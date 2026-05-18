-- ============================================================
-- 0050_milestone_acknowledgements.sql
--
-- SPRINT1-002: Milestone Celebrations.
--
-- When a room's combined progress (totalSaved / target) crosses a
-- 25 / 50 / 75 / 90 percent threshold, each room member should see a
-- one-shot celebration modal on their next app entry. We need a
-- per-(room, user, threshold) acknowledgement so the modal is shown
-- exactly once per device-agnostic user, and never reappears after
-- a future correction drops the room below the threshold and back
-- above it.
--
-- This migration is read-side only: there is no server-side trigger
-- that watches savings_logs. The client computes the crossing on
-- read by comparing the current room total against the four
-- thresholds, then filters out any thresholds already present in
-- this table for (caller, room). The RPC defined below is the only
-- write path.
--
-- RLS:
--   * select: any current room member can see acknowledgements for
--     their room (mirrors the read-side visibility used by buckets,
--     goals, savings_logs, etc.)
--   * insert: a user can only insert their own acknowledgement, and
--     only for a room they are a member of. Both checks are written
--     in the policy so the RPC and any future direct insert paths
--     stay safe.
--   * update / delete: no client policies. Acknowledgements are
--     append-once. The unique constraint + ON CONFLICT DO NOTHING
--     guarantees idempotency for the RPC.
-- ============================================================

begin;

create table if not exists public.milestone_acknowledgements (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  threshold       smallint not null,
  acknowledged_at timestamptz not null default now(),
  constraint milestone_acknowledgements_threshold_check
    check (threshold in (25, 50, 75, 90)),
  constraint milestone_acknowledgements_unique
    unique (room_id, user_id, threshold)
);

create index if not exists idx_milestone_acknowledgements_room_user
  on public.milestone_acknowledgements (room_id, user_id);

alter table public.milestone_acknowledgements enable row level security;

drop policy if exists "milestone_acks_member_select" on public.milestone_acknowledgements;
drop policy if exists "milestone_acks_self_insert"   on public.milestone_acknowledgements;

create policy "milestone_acks_member_select"
  on public.milestone_acknowledgements
  for select
  to authenticated
  using (public.is_room_member(room_id));

create policy "milestone_acks_self_insert"
  on public.milestone_acknowledgements
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_room_member(room_id)
  );

-- ── acknowledge_milestone RPC ───────────────────────────────────
-- Idempotent server-side write path. Called from
-- src/hooks/useMilestoneCrossings.ts when the user taps "Got it"
-- on the celebration modal, and also during silent catch-up writes
-- (e.g. a user joining a room already past 50% has the 25%
-- threshold acknowledged in the background so it doesn't surface
-- later as a stale milestone).
--
-- Validates:
--   * caller is authenticated,
--   * caller is a current room member,
--   * threshold is one of the four supported values.
-- The insert uses ON CONFLICT DO NOTHING so calling the RPC twice
-- (e.g. realtime echo + manual tap) is a no-op.

create or replace function public.acknowledge_milestone(
  p_room_id uuid,
  p_threshold smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_room_id is null then
    raise exception 'room id required' using errcode = '22023';
  end if;
  if p_threshold not in (25, 50, 75, 90) then
    raise exception 'threshold must be 25, 50, 75, or 90' using errcode = '22023';
  end if;
  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  insert into public.milestone_acknowledgements (room_id, user_id, threshold)
  values (p_room_id, v_actor, p_threshold)
  on conflict (room_id, user_id, threshold) do nothing;
end;
$$;

revoke all on function public.acknowledge_milestone(uuid, smallint) from public;
grant execute on function public.acknowledge_milestone(uuid, smallint) to authenticated;

commit;
