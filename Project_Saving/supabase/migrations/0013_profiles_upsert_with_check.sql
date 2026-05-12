-- ============================================================
-- 0013_profiles_upsert_with_check.sql
-- Make profile owner updates explicit for PostgREST upsert paths
-- and populate Google display names at signup/backfill time.
-- ============================================================

begin;

drop policy if exists "profiles: owner can update" on public.profiles;

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1),
    'User'
  );

  insert into public.profiles (id, display_name)
  values (new.id, v_display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

with metadata_names as (
  select
    id,
    split_part(email, '@', 1) as email_name,
    coalesce(
      nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(raw_user_meta_data ->> 'name'), '')
    ) as metadata_name
  from auth.users
)
update public.profiles p
set display_name = m.metadata_name
from metadata_names m
where p.id = m.id
  and m.metadata_name is not null
  and (
    p.display_name = m.email_name
    or p.display_name = 'User'
    or trim(p.display_name) = ''
  );

commit;
