-- 0081_notifications_realtime.sql
--
-- The in-app toast bridge (InAppNotificationBridge) subscribes to INSERTs on
-- public.notifications via Supabase realtime postgres_changes, but the table
-- was never added to the supabase_realtime publication. As a result Postgres
-- emitted no change events and realtime-driven toasts (nudge received, partner
-- deposited, balance checked, etc.) never fired, even when the trigger was met.
--
-- Add the table to the publication so recipients receive INSERT events. RLS
-- (notifications_select_own: recipient_user_id = auth.uid()) already scopes
-- visibility to the recipient, and default replica identity is sufficient for
-- INSERT events.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
