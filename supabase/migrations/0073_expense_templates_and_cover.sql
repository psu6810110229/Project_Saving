-- ============================================================
-- Slice 2.1 — Expense Templates & Room Cover Image
-- supabase/migrations/0073_expense_templates_and_cover.sql
--
-- 1. Add cover_image_url to rooms.
-- 2. Create expense_templates table.
-- 3. RLS: room-member read, creator insert/update/delete.
-- 4. Supabase Storage bucket for room cover images.
-- ============================================================

begin;

-- ─── 1. rooms.cover_image_url ───────────────────────────────

alter table public.rooms
  add column if not exists cover_image_url text;

-- ─── 2. expense_templates table ─────────────────────────────

create table if not exists public.expense_templates (
  id                    uuid primary key default gen_random_uuid(),
  room_id               uuid not null references public.rooms(id) on delete cascade,
  category              text not null,
  name                  text not null,
  target_amount         numeric not null check (target_amount > 0),
  payment_type          text not null check (payment_type in ('advance_booking', 'pre_trip', 'on_trip', 'flexible')),
  deadline              date not null,
  suggested_rule_type   text check (suggested_rule_type in (
                          'fixed_daily', 'fixed_weekly', 'fixed_monthly',
                          'increasing_daily', 'increasing_daily_capped', 'flexible'
                        )),
  suggested_rule_amount numeric,
  priority              integer not null default 0,
  tip_key               text,
  created_by            uuid not null references auth.users(id),
  created_at            timestamptz not null default now()
);

create index if not exists idx_expense_templates_room
  on public.expense_templates(room_id);

-- ─── 3. RLS ─────────────────────────────────────────────────

alter table public.expense_templates enable row level security;

-- Room members can read templates
create policy "expense_templates_select_member"
  on public.expense_templates for select
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = expense_templates.room_id
        and rm.user_id = auth.uid()
    )
  );

-- Room creator can also read (covers case where creator hasn't joined room_members yet)
create policy "expense_templates_select_creator"
  on public.expense_templates for select
  using (
    exists (
      select 1 from public.rooms r
      where r.id = expense_templates.room_id
        and r.created_by = auth.uid()
    )
  );

-- Only the room creator can insert templates
create policy "expense_templates_insert_creator"
  on public.expense_templates for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.rooms r
      where r.id = expense_templates.room_id
        and r.created_by = auth.uid()
    )
  );

-- Only the room creator can update templates
create policy "expense_templates_update_creator"
  on public.expense_templates for update
  using (
    exists (
      select 1 from public.rooms r
      where r.id = expense_templates.room_id
        and r.created_by = auth.uid()
    )
  );

-- Only the room creator can delete templates
create policy "expense_templates_delete_creator"
  on public.expense_templates for delete
  using (
    exists (
      select 1 from public.rooms r
      where r.id = expense_templates.room_id
        and r.created_by = auth.uid()
    )
  );

-- ─── 4. Storage bucket for room covers ──────────────────────

insert into storage.buckets (id, name, public)
values ('room-covers', 'room-covers', true)
on conflict (id) do nothing;

-- Anyone authenticated can upload to room-covers
create policy "room_covers_insert_authed"
  on storage.objects for insert
  with check (
    bucket_id = 'room-covers'
    and auth.uid() is not null
  );

-- Public read access for room cover images
create policy "room_covers_select_public"
  on storage.objects for select
  using (bucket_id = 'room-covers');

-- Uploaders can update their own files
create policy "room_covers_update_own"
  on storage.objects for update
  using (
    bucket_id = 'room-covers'
    and auth.uid() = owner
  );

-- Uploaders can delete their own files
create policy "room_covers_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'room-covers'
    and auth.uid() = owner
  );

commit;
