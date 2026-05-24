-- ============================================================
-- 0065_fix_archive_bucket_ambiguous_archived_at.sql
-- Hotfix: qualify archived_at references inside archive_bucket.
--
-- archive_bucket returns a table with an output column named
-- `archived_at`. In PL/pgSQL, unqualified references like
-- `archived_at is null` can be interpreted as either the output
-- variable or the buckets table column, causing Postgres 42702:
-- "column reference archived_at is ambiguous".
-- ============================================================

begin;

create or replace function public.archive_bucket(
  p_bucket_id uuid
)
returns table (
  bucket_id uuid,
  archived_at timestamptz,
  archived_by uuid,
  activity_id uuid,
  reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_bucket      record;
  v_balance     numeric(12,2);
  v_active_left int;
  v_activity_id uuid;
  v_existing_activity uuid;
  v_now         timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501', hint = 'archive_unauthenticated';
  end if;
  if p_bucket_id is null then
    raise exception 'bucket id required'
      using errcode = '22023', hint = 'archive_invalid_request';
  end if;

  perform 1
    from public.buckets b
   where b.id = p_bucket_id
   for update;

  select b.id, b.user_id, b.room_id, b.name, b.archived_at, b.archived_by
    into v_bucket
    from public.buckets b
   where b.id = p_bucket_id;
  if not found then
    raise exception 'bucket not found'
      using errcode = 'P0002', hint = 'archive_bucket_missing';
  end if;
  if v_bucket.user_id <> v_user_id then
    raise exception 'bucket is not owned by caller'
      using errcode = '42501', hint = 'archive_partner_bucket';
  end if;

  if v_bucket.archived_at is not null then
    select ae.id into v_existing_activity
      from public.activity_events ae
     where ae.event_key = 'bucket_removed'
       and ae.source_table = 'buckets'
       and ae.source_id = p_bucket_id
     order by ae.created_at desc
     limit 1;

    return query
      select v_bucket.id, v_bucket.archived_at, v_bucket.archived_by,
             v_existing_activity, true;
    return;
  end if;

  if not public.is_room_member(v_bucket.room_id) then
    raise exception 'not a member of this room'
      using errcode = '42501', hint = 'archive_not_room_member';
  end if;

  v_balance := public.bucket_balance(p_bucket_id);
  if v_balance > 0 then
    raise exception 'bucket has a positive balance'
      using errcode = '22023',
            hint = 'archive_nonzero_balance',
            detail = format('balance=%s', v_balance);
  end if;

  select count(*) into v_active_left
    from public.buckets b
   where b.user_id = v_user_id
     and b.room_id = v_bucket.room_id
     and b.archived_at is null
     and b.id <> p_bucket_id;

  if v_active_left = 0 then
    raise exception 'cannot archive the last active bucket'
      using errcode = '22023', hint = 'archive_last_active';
  end if;

  update public.buckets
     set archived_at = v_now,
         archived_by = v_user_id
   where public.buckets.id = p_bucket_id
     and public.buckets.archived_at is null;

  insert into public.activity_events (
    room_id, actor_user_id, event_key,
    source_table, source_id,
    bucket_id, payload, created_at
  ) values (
    v_bucket.room_id, v_user_id, 'bucket_removed',
    'buckets', p_bucket_id,
    p_bucket_id,
    jsonb_build_object(
      'bucket_id', p_bucket_id,
      'bucket_name', v_bucket.name,
      'reason', 'empty_archive'
    ),
    v_now
  )
  returning id into v_activity_id;

  return query
    select p_bucket_id, v_now, v_user_id, v_activity_id, false;
end;
$$;

revoke all on function public.archive_bucket(uuid) from public;
grant execute on function public.archive_bucket(uuid) to authenticated;

commit;
