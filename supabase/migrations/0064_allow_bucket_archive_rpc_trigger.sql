-- ============================================================
-- 0064_allow_bucket_archive_rpc_trigger.sql
-- Hotfix: allow the bucket archive RPC to pass the protected-field
-- trigger even when the SECURITY DEFINER owner/current_user is not one
-- of the role names whitelisted in migration 0058.
--
-- Direct client updates still cannot archive buckets because the
-- buckets_own_update RLS policy has `with check (... archived_at is null)`.
-- This trigger change only lets an archive-shaped update through after
-- the RPC has already validated ownership, room membership, balance, and
-- last-active rules.
-- ============================================================

begin;

create or replace function public.prevent_bucket_protected_field_update()
returns trigger
language plpgsql
as $$
declare
  v_actor uuid := auth.uid();
  v_archive_only boolean;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  v_archive_only :=
    v_actor is not null
    and old.user_id = v_actor
    and new.user_id is not distinct from old.user_id
    and new.room_id is not distinct from old.room_id
    and old.archived_at is null
    and new.archived_at is not null
    and old.archived_by is null
    and new.archived_by = v_actor;

  if old.user_id is distinct from new.user_id
     or old.room_id is distinct from new.room_id
     or old.archived_at is distinct from new.archived_at
     or old.archived_by is distinct from new.archived_by then
    if not v_archive_only then
      raise exception 'protected bucket fields must be changed through bucket RPCs'
        using errcode = '42501', hint = 'bucket_protected_fields';
    end if;
  end if;

  return new;
end;
$$;

commit;
