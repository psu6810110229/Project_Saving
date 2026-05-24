-- ============================================================
-- 41.2 - Bucket Category Intelligence
-- Adds category metadata columns, migrates old categories to
-- the new normalized set, and tightens the check constraint.
-- ============================================================

begin;

-- 1. Add metadata columns
alter table public.buckets
  add column if not exists category_source text not null default 'user',
  add column if not exists category_confidence smallint not null default 100,
  add column if not exists category_reviewed_at timestamptz;

-- 2. Drop old category check constraint
alter table public.buckets
  drop constraint if exists buckets_category_check;

-- 3. Migrate existing data

-- 3a. Direct category mapping (known old values)
update public.buckets
set
  category = 'stay',
  category_source = 'migration',
  category_confidence = 90
where category = 'accom';

update public.buckets
set
  category = 'food',
  category_source = 'migration',
  category_confidence = 90
where category = 'dining';

update public.buckets
set
  category = 'shopping',
  category_source = 'migration',
  category_confidence = 80
where category = 'gear';

update public.buckets
set
  category_source = 'migration',
  category_confidence = 90
where category in ('flight', 'transport', 'activities', 'home');

-- 3b. Name-based inference for 'travel' and 'other'
update public.buckets
set
  category = case
    when lower(name) ~ '(flight|plane|airline|air\y|fly|ตั๋วเครื่อง|เครื่องบิน|ค่าเครื่อง)'
      then 'flight'
    when lower(name) ~ '(hotel|stay|accom|airbnb|hostel|room|ที่พัก|โรงแรม)'
      then 'stay'
    when lower(name) ~ '(transport|train|taxi|bus|fuel|gas\y|car\y|metro|subway|เดินทาง|รถไฟ|แท็กซี่|น้ำมัน|รถ)'
      then 'transport'
    when lower(name) ~ '(food|meal|dining|restaurant|cafe|อาหาร|ข้าว|กิน)'
      then 'food'
    when lower(name) ~ '(activity|activities|tour|park|museum|disney|ตั๋ว|กิจกรรม|ทัวร์|สวนสนุก)'
      then 'activities'
    when lower(name) ~ '(shop|shopping|souvenir|gift|ของฝาก|ช้อป|ซื้อของ)'
      then 'shopping'
    when lower(name) ~ '(buffer|emergency|reserve|safety|backup|สำรอง|ฉุกเฉิน)'
      then 'buffer'
    when lower(name) ~ '(home|house|บ้าน)'
      then 'home'
    else 'other'
  end,
  category_source = 'inferred',
  category_confidence = case
    when lower(name) ~ '(flight|plane|airline|air\y|fly|ตั๋วเครื่อง|เครื่องบิน|ค่าเครื่อง)' then 80
    when lower(name) ~ '(hotel|stay|accom|airbnb|hostel|room|ที่พัก|โรงแรม)' then 80
    when lower(name) ~ '(transport|train|taxi|bus|fuel|gas\y|car\y|metro|subway|เดินทาง|รถไฟ|แท็กซี่|น้ำมัน|รถ)' then 80
    when lower(name) ~ '(food|meal|dining|restaurant|cafe|อาหาร|ข้าว|กิน)' then 80
    when lower(name) ~ '(activity|activities|tour|park|museum|disney|ตั๋ว|กิจกรรม|ทัวร์|สวนสนุก)' then 80
    when lower(name) ~ '(shop|shopping|souvenir|gift|ของฝาก|ช้อป|ซื้อของ)' then 80
    when lower(name) ~ '(buffer|emergency|reserve|safety|backup|สำรอง|ฉุกเฉิน)' then 80
    when lower(name) ~ '(home|house|บ้าน)' then 80
    else 40
  end,
  category_reviewed_at = null
where category in ('travel', 'other');

-- 4. Add new check constraints
alter table public.buckets
  add constraint buckets_category_check
  check (category in ('flight', 'stay', 'transport', 'food', 'activities', 'shopping', 'buffer', 'home', 'other'));

alter table public.buckets
  add constraint buckets_category_source_check
  check (category_source in ('user', 'migration', 'inferred'));

alter table public.buckets
  add constraint buckets_category_confidence_check
  check (category_confidence between 0 and 100);

commit;
