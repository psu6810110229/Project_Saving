-- ============================================================
-- 0019_partner_buckets_visibility.sql
-- Extend public.buckets RLS so co-members of a room can SELECT
-- each other's bucket plans. Editing (INSERT/UPDATE/DELETE)
-- remains scoped to the owning user, so the partner can see a
-- read-only summary on the Dashboard but cannot mutate.
--
-- This is required for the Phase 6.2 Dashboard segmented view
-- "Your Buckets / Partner's Buckets" so fran can see very_sad's
-- bucket progress without owning her plan, and vice versa.
-- ============================================================

begin;

-- Drop and recreate the SELECT policy so it covers any member of
-- the same room. INSERT/UPDATE/DELETE policies from 0004 remain
-- unchanged (user_id = auth.uid()). The original policy name from
-- 0004 is "buckets_own_select".
drop policy if exists "buckets_own_select" on public.buckets;
drop policy if exists "buckets_select_own" on public.buckets;
drop policy if exists "buckets_select" on public.buckets;
create policy "buckets_select_co_member"
  on public.buckets
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.room_members rm
      where rm.room_id = public.buckets.room_id
        and rm.user_id = auth.uid()
    )
  );

commit;
