-- ============================================================
-- 0086_room_member_theme_colors.sql
-- Room-scoped member theme colors with automatic de-duplication.
-- ============================================================

begin;

alter table public.profiles
  drop constraint if exists profiles_theme_color_check;

alter table public.profiles
  add constraint profiles_theme_color_check
  check (theme_color in ('terracotta', 'slate', 'teal', 'gold', 'leaf', 'coral', 'indigo'));

alter table public.room_members
  add column if not exists theme_color text;

alter table public.room_members
  drop constraint if exists room_members_theme_color_check;

alter table public.room_members
  add constraint room_members_theme_color_check
  check (theme_color in ('terracotta', 'slate', 'teal', 'gold', 'leaf', 'coral', 'indigo'));

create or replace function public.assign_room_member_theme_color(
  p_room_id uuid,
  p_user_id uuid,
  p_requested_theme text default null
)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_palette constant text[] := array['terracotta', 'slate', 'teal', 'gold', 'leaf', 'coral', 'indigo'];
  v_requested text;
  v_theme text;
begin
  if p_room_id is null or p_user_id is null then
    raise exception 'room id and user id required' using errcode = '22023';
  end if;

  v_requested := coalesce(
    p_requested_theme,
    (select p.theme_color from public.profiles p where p.id = p_user_id),
    'terracotta'
  );

  if v_requested = any(v_palette) and not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id <> p_user_id
      and rm.theme_color = v_requested
  ) then
    return v_requested;
  end if;

  select candidate.theme
    into v_theme
  from unnest(v_palette) with ordinality as candidate(theme, ord)
  where not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id <> p_user_id
      and rm.theme_color = candidate.theme
  )
  order by case when candidate.theme = v_requested then 0 else 1 end, candidate.ord
  limit 1;

  if v_theme is null then
    raise exception 'no theme colors available for this room'
      using errcode = '23514',
            hint = 'room_theme_palette_exhausted';
  end if;

  return v_theme;
end;
$$;

revoke all on function public.assign_room_member_theme_color(uuid, uuid, text) from public;
grant execute on function public.assign_room_member_theme_color(uuid, uuid, text) to authenticated;

create or replace function public.before_room_members_assign_theme_color()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.theme_color := public.assign_room_member_theme_color(new.room_id, new.user_id, new.theme_color);
  return new;
end;
$$;

drop trigger if exists trg_room_members_assign_theme_color on public.room_members;

create trigger trg_room_members_assign_theme_color
before insert or update of theme_color on public.room_members
for each row
execute function public.before_room_members_assign_theme_color();

with room_member_seeds as (
  select
    rm.room_id,
    rm.user_id,
    public.assign_room_member_theme_color(
      rm.room_id,
      rm.user_id,
      coalesce(rm.theme_color, p.theme_color)
    ) as resolved_theme
  from public.room_members rm
  join public.profiles p
    on p.id = rm.user_id
)
update public.room_members rm
set theme_color = seeds.resolved_theme
from room_member_seeds seeds
where rm.room_id = seeds.room_id
  and rm.user_id = seeds.user_id;

alter table public.room_members
  alter column theme_color set not null;

create or replace function public.room_members_for_room(p_room_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  theme_color text,
  joined_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select rm.user_id,
         p.display_name,
         p.avatar_url,
         rm.theme_color,
         rm.joined_at
  from public.room_members rm
  join public.profiles p on p.id = rm.user_id
  where rm.room_id = p_room_id
    and exists (
      select 1 from public.room_members me
      where me.room_id = p_room_id
        and me.user_id = auth.uid()
    )
  order by rm.joined_at asc;
$$;

revoke all on function public.room_members_for_room(uuid) from public;
grant execute on function public.room_members_for_room(uuid) to authenticated;

commit;
