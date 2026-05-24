-- ============================================================
-- 0066_harden_bucket_intent_settings_update_rls.sql
-- Hotfix: ensure bucket_intent_settings UPDATE re-checks membership
-- against the new row values, even when manual_next_bucket_id is null.
-- ============================================================

begin;

drop policy if exists "intent_settings_update_own"
  on public.bucket_intent_settings;

create policy "intent_settings_update_own"
  on public.bucket_intent_settings
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = bucket_intent_settings.room_id
         and rm.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
        from public.room_members rm
       where rm.room_id = bucket_intent_settings.room_id
         and rm.user_id = auth.uid()
    )
    and (
      manual_next_bucket_id is null
      or exists (
        select 1
          from public.buckets b
         where b.id = manual_next_bucket_id
           and b.user_id = auth.uid()
           and b.room_id = bucket_intent_settings.room_id
           and b.archived_at is null
      )
    )
  );

commit;
