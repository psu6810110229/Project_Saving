-- ============================================================
-- 0018_backfill_google_avatars.sql
-- Persist the Google profile photo (raw_user_meta_data->>'avatar_url')
-- into public.profiles.avatar_url on signup, AND backfill existing
-- rows where avatar_url is currently NULL so the dashboard / activity
-- feed / head-to-head card show the real photos immediately.
--
-- Safe to rerun: the backfill update only touches rows where
-- avatar_url is null, so a user who later uploaded a custom photo
-- is never clobbered.
-- ============================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_avatar_url text;
begin
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1),
    'User'
  );

  v_avatar_url := nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '');

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, v_display_name, v_avatar_url)
  on conflict (id) do update
    set avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  return new;
end;
$$;

-- Backfill: only set avatar_url where it is currently NULL so we
-- never overwrite a user-uploaded photo.
update public.profiles p
set avatar_url = nullif(trim(u.raw_user_meta_data ->> 'avatar_url'), '')
from auth.users u
where u.id = p.id
  and p.avatar_url is null
  and nullif(trim(u.raw_user_meta_data ->> 'avatar_url'), '') is not null;

commit;
