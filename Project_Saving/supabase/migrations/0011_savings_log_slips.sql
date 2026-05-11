-- ============================================================
-- Step 8 - Savings log slip attachments
-- Adds optional transfer slip metadata for AddMoneyForm and ActivityFeed.
-- ============================================================

begin;

alter table savings_logs
  add column if not exists slip_url text;

alter table savings_logs
  drop constraint if exists savings_logs_slip_url_check;

alter table savings_logs
  add constraint savings_logs_slip_url_check
  check (slip_url is null or length(trim(slip_url)) > 0);

commit;
