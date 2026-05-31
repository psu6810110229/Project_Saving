-- ============================================================
-- 0081_bucket_saving_rule_start_date.sql
-- Add an optional start date for a bucket's increasing-daily
-- saving rule. When set, the daily schedule (and habit/streak
-- tracking) counts from this date instead of the bucket's
-- creation date, so users can pick a future start.
--
-- Nullable so existing buckets keep anchoring to created_at.
-- ============================================================

begin;

alter table public.buckets
  add column if not exists saving_rule_start_date date;

commit;
