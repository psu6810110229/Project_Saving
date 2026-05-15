-- ============================================================
-- 0044_notification_retention_cleanup.sql
-- Task 23.6 polish — retention cleanup.
--
-- Adds two service-role-only cleanup RPCs so the scheduler can
-- bound the size of the notification log and push delivery audit
-- table without manual intervention:
--
--   cleanup_old_notifications(p_days_old int default 90)
--     Deletes notifications that have been READ for more than N
--     days. Unread, archived-but-unread, and recently-read rows
--     are preserved so the in-app center still shows useful
--     recent history (matches the retention note in plan §4).
--
--   cleanup_old_delivery_attempts(p_days_old int default 30)
--     Deletes notification_delivery_attempts older than N days.
--     The table is debug-grade audit only — clients don't read
--     from it — so 30 days is plenty.
--
-- Both return the number of rows deleted so the calling edge
-- function can include the count in its summary. Granted only to
-- service_role; revoked from public and authenticated.
-- ============================================================

begin;

create or replace function public.cleanup_old_notifications(
  p_days_old integer default 90
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days   integer := greatest(coalesce(p_days_old, 90), 1);
  v_cutoff timestamptz := now() - make_interval(days => v_days);
  v_count  integer;
begin
  with deleted as (
    delete from public.notifications
    where read_at is not null
      and read_at < v_cutoff
    returning 1
  )
  select count(*)::int into v_count from deleted;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.cleanup_old_notifications(integer) from public;
revoke all on function public.cleanup_old_notifications(integer) from authenticated;
grant execute on function public.cleanup_old_notifications(integer) to service_role;

create or replace function public.cleanup_old_delivery_attempts(
  p_days_old integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days   integer := greatest(coalesce(p_days_old, 30), 1);
  v_cutoff timestamptz := now() - make_interval(days => v_days);
  v_count  integer;
begin
  with deleted as (
    delete from public.notification_delivery_attempts
    where attempted_at < v_cutoff
    returning 1
  )
  select count(*)::int into v_count from deleted;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.cleanup_old_delivery_attempts(integer) from public;
revoke all on function public.cleanup_old_delivery_attempts(integer) from authenticated;
grant execute on function public.cleanup_old_delivery_attempts(integer) to service_role;

commit;
