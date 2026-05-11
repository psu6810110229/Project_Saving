-- ============================================================
-- 0006_fix_goals_pk.sql
-- Change primary key of goals table to (user_id, room_id)
-- to allow one goal per user per room.
--
-- Repair-friendly: safe to rerun after a partial/manual Supabase reset.
-- ============================================================

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'goals'
      and constraint_name = 'goals_pkey'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.goals drop constraint goals_pkey;
  end if;

  if not exists (select 1 from public.goals where user_id is null or room_id is null)
    and not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'goals'
      and constraint_name = 'goals_pkey'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.goals add constraint goals_pkey primary key (user_id, room_id);
  end if;
end $$;

commit;
