-- ============================================================
-- 0060_bucket_transfer_notifications.sql
-- Task 40 / Sprint 40.8 — In-app notifications for the bucket
-- transfer and remove flows.
--
-- Adds two security-definer RPCs that fan out one in-app row per
-- OTHER current room member through the existing helper
-- public._insert_partner_notification (migration 0040). The helper
-- pins category = 'partner_activity' and channel_policy = 'in_app',
-- so these events follow the same partner-preference gating as the
-- existing bucket_added / bucket_updated notifications.
--
-- Hard rules (plan §10):
--   * Push is NOT used for transfer/remove. p_push_safe = false is
--     hard-coded; the helper records channel_policy = 'in_app'.
--   * Transfer notes are owner-only. The notification payload carries
--     `has_note` only — never the raw text. Owners read the text via
--     bucket_transfers (owner-only RLS from 0058).
--   * Routes are restricted to the in-app allow-list in
--     src/lib/notifications.ts: target_route /dashboard?section=buckets,
--     fallback_route /dashboard.
--   * Caller must own the transfer / bucket and be a current room
--     member. Idempotent dedupe keys keep retries from double-firing.
--
-- These RPCs are called fire-and-forget from the client after the
-- core RPC (transfer_bucket_money / archive_bucket /
-- transfer_and_archive_bucket from 0059) succeeds, mirroring the
-- pattern used by notify_bucket_added / notify_bucket_updated.
-- ============================================================

begin;

-- 1. notify_bucket_transferred ---------------------------------------
-- Called by the actor after a successful bucket_transfer_money RPC.
-- Fans out to every OTHER current room member. The transfer row's
-- user_id must equal auth.uid() — the actor cannot notify on
-- another user's transfer.
create or replace function public.notify_bucket_transferred(p_transfer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor             uuid := auth.uid();
  v_transfer          record;
  v_source_name       text;
  v_destination_name  text;
  v_actor_name        text;
  v_dedupe            text;
  v_member            record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_transfer_id is null then
    raise exception 'transfer id required' using errcode = '22023';
  end if;

  select t.id, t.room_id, t.user_id, t.source_bucket_id,
         t.destination_bucket_id, t.amount, t.note
    into v_transfer
    from public.bucket_transfers t
   where t.id = p_transfer_id;

  if v_transfer.id is null then
    raise exception 'transfer not found' using errcode = 'P0002';
  end if;
  if v_transfer.user_id <> v_actor then
    raise exception 'cannot notify on another user transfer' using errcode = '42501';
  end if;
  if not public.is_room_member(v_transfer.room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  -- Bucket names are read separately because the source bucket may be
  -- archived (transfer_and_archive_bucket case) and we still want a
  -- readable label.
  select b.name into v_source_name
    from public.buckets b where b.id = v_transfer.source_bucket_id;
  select b.name into v_destination_name
    from public.buckets b where b.id = v_transfer.destination_bucket_id;

  v_actor_name := public._actor_display_name(v_actor);

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_transfer.room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'bucket_transferred:' || p_transfer_id::text
                || ':' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_actor, v_transfer.room_id,
      'bucket_transferred', v_dedupe,
      'Bucket transfer',
      v_actor_name || ' moved money between buckets.',
      'View buckets',
      '/dashboard?section=buckets', null, '/dashboard',
      false,
      jsonb_build_object(
        'actor_name', v_actor_name,
        'transfer_id', p_transfer_id,
        'amount', v_transfer.amount,
        'source_bucket_id', v_transfer.source_bucket_id,
        'source_bucket_name', v_source_name,
        'destination_bucket_id', v_transfer.destination_bucket_id,
        'destination_bucket_name', v_destination_name,
        'has_note', v_transfer.note is not null
      ),
      'bucket_transfers', p_transfer_id
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_bucket_transferred(uuid) from public;
grant execute on function public.notify_bucket_transferred(uuid) to authenticated;

-- 2. notify_bucket_removed -------------------------------------------
-- Called by the actor after archive_bucket or transfer_and_archive_bucket
-- succeeds. Bucket owner is enforced by the RPC; we re-check here so a
-- caller cannot fan out a remove notification for a bucket they don't
-- own.
create or replace function public.notify_bucket_removed(p_bucket_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor       uuid := auth.uid();
  v_bucket_user uuid;
  v_room_id     uuid;
  v_bucket_name text;
  v_actor_name  text;
  v_dedupe      text;
  v_member      record;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_bucket_id is null then
    raise exception 'bucket id required' using errcode = '22023';
  end if;

  select b.user_id, b.room_id, b.name
    into v_bucket_user, v_room_id, v_bucket_name
  from public.buckets b
  where b.id = p_bucket_id;

  if v_bucket_user is null then
    raise exception 'bucket not found' using errcode = 'P0002';
  end if;
  if v_bucket_user <> v_actor then
    raise exception 'cannot notify on another user bucket' using errcode = '42501';
  end if;
  if not public.is_room_member(v_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  v_actor_name := public._actor_display_name(v_actor);

  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'bucket_removed:' || p_bucket_id::text
                || ':' || v_member.user_id::text;
    perform public._insert_partner_notification(
      v_member.user_id, v_actor, v_room_id,
      'bucket_removed', v_dedupe,
      'Bucket removed',
      v_actor_name || ' removed ' || coalesce(nullif(btrim(v_bucket_name), ''), 'a bucket') || '.',
      'View buckets',
      '/dashboard?section=buckets', null, '/dashboard',
      false,
      jsonb_build_object(
        'actor_name', v_actor_name,
        'bucket_id', p_bucket_id,
        'bucket_name', v_bucket_name
      ),
      'buckets', p_bucket_id
    );
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_bucket_removed(uuid) from public;
grant execute on function public.notify_bucket_removed(uuid) to authenticated;

commit;
