-- ============================================================
-- 0068_fix_bucket_sum_check_archived.sql
-- Hotfix: enforce_bucket_sum_le_goal previously counted archived
-- buckets when summing a user's bucket targets. After Task 40
-- (migration 0058) introduced bucket archive, the active-buckets
-- UI sums only `archived_at is null` rows, so the dashboard could
-- show e.g. "40k allocated of 53k, 13k remaining" while the
-- trigger refused a new 10k bucket because archived rows kept the
-- DB-side total above the personal sub-goal.
--
-- The bucket limit (migration 0058) already filters archived
-- buckets. This migration brings the personal-sub-goal cap in
-- line with the same active-only semantics so the trigger result
-- matches what the UI displays.
-- ============================================================

begin;

create or replace function public.enforce_bucket_sum_le_goal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  goal_target numeric;
  bucket_sum numeric;
begin
  select g.target_amount
    into goal_target
  from public.goals g
  where g.user_id = new.user_id
    and g.room_id = new.room_id;

  if goal_target is null then
    return new;
  end if;

  -- Only active buckets count toward the personal sub-goal cap.
  -- Archived rows remain for history but no longer reserve goal
  -- capacity (see migration 0058 for archive semantics).
  select coalesce(sum(b.target_amount), 0)
    into bucket_sum
  from public.buckets b
  where b.user_id = new.user_id
    and b.room_id = new.room_id
    and b.id <> new.id
    and b.archived_at is null;

  if bucket_sum + new.target_amount > goal_target then
    raise exception 'Bucket total (%) exceeds goal target (%)', bucket_sum + new.target_amount, goal_target
      using errcode = '23514';
  end if;

  return new;
end;
$$;

commit;
