-- 0087_native_push_subscriptions.sql
-- Add Android FCM device subscriptions alongside existing Web Push rows.

begin;

alter table public.push_subscriptions
  add column if not exists provider text not null default 'web',
  add column if not exists fcm_token text,
  add column if not exists platform text,
  add column if not exists device_id text,
  add column if not exists app_version text;

alter table public.push_subscriptions
  alter column p256dh drop not null,
  alter column auth_key drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_subscriptions_provider_check'
      and conrelid = 'public.push_subscriptions'::regclass
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_provider_check
      check (provider in ('web', 'fcm'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_subscriptions_provider_payload_check'
      and conrelid = 'public.push_subscriptions'::regclass
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_provider_payload_check
      check (
        (provider = 'web' and p256dh is not null and auth_key is not null)
        or
        (provider = 'fcm' and fcm_token is not null and device_id is not null)
      );
  end if;
end $$;

create unique index if not exists push_subscriptions_native_device_unique
  on public.push_subscriptions (user_id, provider, device_id)
  where provider = 'fcm';

create index if not exists idx_push_subscriptions_provider_user
  on public.push_subscriptions (provider, user_id);

create or replace function public.upsert_native_push_token(
  p_device_id text,
  p_fcm_token text,
  p_platform text default 'android',
  p_app_version text default null
)
returns public.push_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_id text := nullif(btrim(p_device_id), '');
  v_fcm_token text := nullif(btrim(p_fcm_token), '');
  v_platform text := coalesce(nullif(btrim(p_platform), ''), 'android');
  v_row public.push_subscriptions;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_device_id is null then
    raise exception 'device_id required' using errcode = '22023';
  end if;
  if v_fcm_token is null then
    raise exception 'fcm_token required' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth_key,
    user_agent,
    provider,
    fcm_token,
    platform,
    device_id,
    app_version,
    updated_at,
    last_seen_at
  )
  values (
    v_user_id,
    'fcm:' || v_device_id,
    null,
    null,
    'native-android',
    'fcm',
    v_fcm_token,
    v_platform,
    v_device_id,
    nullif(btrim(p_app_version), ''),
    now(),
    now()
  )
  on conflict (user_id, endpoint)
  do update set
    fcm_token = excluded.fcm_token,
    platform = excluded.platform,
    device_id = excluded.device_id,
    app_version = excluded.app_version,
    user_agent = excluded.user_agent,
    provider = 'fcm',
    p256dh = null,
    auth_key = null,
    updated_at = now(),
    last_seen_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.upsert_native_push_token(text, text, text, text) from public;
grant execute on function public.upsert_native_push_token(text, text, text, text) to authenticated;

create or replace function public.delete_native_push_token(
  p_device_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_id text := nullif(btrim(p_device_id), '');
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_device_id is null then
    return;
  end if;

  delete from public.push_subscriptions
    where user_id = v_user_id
      and provider = 'fcm'
      and device_id = v_device_id;
end;
$$;

revoke all on function public.delete_native_push_token(text) from public;
grant execute on function public.delete_native_push_token(text) to authenticated;

commit;
