-- ============================================================
-- 0047_partner_saving_plan_visibility.sql
-- Bugfix P0-006 (0.9.6 → 0.9.7).
--
-- Extend saving-plan SELECT policies so co-members of a room can
-- read each other's saving_plans / saving_plan_revisions /
-- saving_plan_pauses. Editing remains scoped to the owning user
-- (all writes go through security-definer RPCs in migrations
-- 0030–0036 which validate `auth.uid()` against the plan owner),
-- so the partner gets a read-only view on the Saving Plan page.
--
-- Mirrors the pattern from 0019_partner_buckets_visibility.sql.
-- ============================================================

begin;

-- saving_plans
drop policy if exists "saving_plans_select_own"       on public.saving_plans;
drop policy if exists "saving_plans_select_co_member" on public.saving_plans;
create policy "saving_plans_select_co_member"
  on public.saving_plans for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.room_members rm
      where rm.room_id = public.saving_plans.room_id
        and rm.user_id = auth.uid()
    )
  );

-- saving_plan_revisions
drop policy if exists "saving_plan_revisions_select_own"       on public.saving_plan_revisions;
drop policy if exists "saving_plan_revisions_select_co_member" on public.saving_plan_revisions;
create policy "saving_plan_revisions_select_co_member"
  on public.saving_plan_revisions for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.room_members rm
      where rm.room_id = public.saving_plan_revisions.room_id
        and rm.user_id = auth.uid()
    )
  );

-- saving_plan_pauses
drop policy if exists "saving_plan_pauses_select_own"       on public.saving_plan_pauses;
drop policy if exists "saving_plan_pauses_select_co_member" on public.saving_plan_pauses;
create policy "saving_plan_pauses_select_co_member"
  on public.saving_plan_pauses for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.room_members rm
      where rm.room_id = public.saving_plan_pauses.room_id
        and rm.user_id = auth.uid()
    )
  );

commit;
