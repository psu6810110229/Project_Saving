-- ============================================================
-- Step 8 - Smart Bucket categories for icon-driven bucket rows
-- Adds the category picked in CreateBucketForm.
-- ============================================================

begin;

alter table public.buckets
  add column if not exists category text not null default 'other';

update public.buckets
set category = case
  when lower(name) like '%flight%' then 'flight'
  when lower(name) like '%accom%' or lower(name) like '%stay%' or lower(name) like '%hotel%' then 'accom'
  when lower(name) like '%dining%' or lower(name) like '%food%' then 'dining'
  when lower(name) like '%transport%' or lower(name) like '%train%' then 'transport'
  when lower(name) like '%activit%' or lower(name) like '%ticket%' then 'activities'
  when lower(name) like '%gear%' then 'gear'
  when lower(name) like '%home%' then 'home'
  else category
end;

alter table public.buckets
  drop constraint if exists buckets_category_check;

alter table public.buckets
  add constraint buckets_category_check
  check (category in ('travel', 'flight', 'accom', 'dining', 'transport', 'activities', 'gear', 'home', 'other'));

commit;
