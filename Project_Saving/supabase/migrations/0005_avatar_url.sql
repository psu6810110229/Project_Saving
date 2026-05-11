begin;

-- Add avatar_url to profiles
alter table public.profiles add column if not exists avatar_url text;

-- Note: The following requires storage schema which exists in Supabase.
-- It creates a public bucket named 'avatars'
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

-- Set up storage policies (safe to run multiple times if we drop first or use if not exists, but policies don't have if not exists easily, so we just drop them first)
drop policy if exists "Avatar images are publicly accessible." on storage.objects;
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

drop policy if exists "Users can upload their own avatar." on storage.objects;
create policy "Users can upload their own avatar."
  on storage.objects for insert
  with check ( bucket_id = 'avatars' and auth.uid() = owner );

drop policy if exists "Users can update their own avatar." on storage.objects;
create policy "Users can update their own avatar."
  on storage.objects for update
  using ( bucket_id = 'avatars' and auth.uid() = owner );

commit;
