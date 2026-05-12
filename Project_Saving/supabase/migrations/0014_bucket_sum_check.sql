-- ============================================================
-- 0014_bucket_sum_check.sql
-- Enforce that a user's bucket targets do not exceed their room goal.
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

  select coalesce(sum(b.target_amount), 0)
    into bucket_sum
  from public.buckets b
  where b.user_id = new.user_id
    and b.room_id = new.room_id
    and b.id <> new.id;

  if bucket_sum + new.target_amount > goal_target then
    raise exception 'Bucket total (%) exceeds goal target (%)', bucket_sum + new.target_amount, goal_target
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bucket_sum_check on public.buckets;

create trigger trg_bucket_sum_check
  before insert or update on public.buckets
  for each row execute function public.enforce_bucket_sum_le_goal();

commit;
