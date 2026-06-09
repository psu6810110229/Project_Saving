-- ============================================================
-- 0089_streak_freeze_bucket_pause_awareness.sql
-- Make automatic streak-freeze spending aware of bucket-level pauses.
--
-- Paused days continue the streak chain but never spend freeze budget.
-- Deposits made into a paused bucket remain money movement, but they do
-- not count as raw save days for freeze/streak qualification.
-- ============================================================

begin;

create or replace function public.consume_streak_freezes_if_needed(
  p_evaluation_date date
)
returns table(frozen_dates date[], remaining_in_month smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor       uuid := auth.uid();
  v_budget      smallint;
  v_used        smallint;
  v_remaining   smallint;
  v_month       text;
  v_eval        date := p_evaluation_date;
  v_cursor      date;
  v_oldest      date;
  v_save_days   date[];
  v_frozen_days date[];
  v_pause_days  date[];
  v_inserted    date[] := array[]::date[];
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_eval is null then
    v_eval := (now() at time zone 'Asia/Bangkok')::date;
  end if;

  v_month  := to_char(v_eval, 'YYYY-MM');
  v_oldest := v_eval - 90;

  insert into public.streak_freeze_budgets (user_id)
  values (v_actor)
  on conflict (user_id) do nothing;

  select monthly_budget into v_budget
  from public.streak_freeze_budgets
  where user_id = v_actor;

  select count(*)::smallint into v_used
  from public.streak_freeze_usages
  where user_id = v_actor
    and month_key = v_month;

  v_remaining := greatest(0, (v_budget - v_used))::smallint;

  -- Bucket pause days in the evaluation window. This deliberately uses
  -- the owner's full pause history, not partner-visible status rows.
  with pause_bounds as (
    select
      greatest(bp.paused_from, v_oldest) as start_date,
      least(coalesce(bp.resumed_from - 1, v_eval), v_eval) as end_date
    from public.bucket_plan_pauses bp
    where bp.user_id = v_actor
      and bp.paused_from <= v_eval
      and coalesce(bp.resumed_from, v_eval + 1) > v_oldest
  )
  select coalesce(array_agg(distinct d::date order by d::date), array[]::date[])
    into v_pause_days
  from pause_bounds pb
  cross join lateral generate_series(pb.start_date, pb.end_date, interval '1 day') as gs(d)
  where pb.end_date >= pb.start_date;

  -- Bangkok-local save day set, excluding deposits into a bucket that
  -- was paused on that same Bangkok date.
  select coalesce(array_agg(distinct d order by d), array[]::date[])
    into v_save_days
  from (
    select ((s.created_at at time zone 'Asia/Bangkok')::date) as d
    from public.savings_logs s
    where s.user_id = v_actor
      and s.amount > 0
      and (s.created_at at time zone 'Asia/Bangkok')::date between v_oldest and v_eval
      and not exists (
        select 1
        from public.bucket_plan_pauses bp
        where bp.bucket_id = s.bucket_id
          and bp.user_id = v_actor
          and bp.paused_from <= ((s.created_at at time zone 'Asia/Bangkok')::date)
          and (
            bp.resumed_from is null
            or bp.resumed_from > ((s.created_at at time zone 'Asia/Bangkok')::date)
          )
      )
  ) s;

  select coalesce(array_agg(frozen_date order by frozen_date), array[]::date[])
    into v_frozen_days
  from public.streak_freeze_usages
  where user_id = v_actor
    and frozen_date between v_oldest and v_eval;

  if v_remaining <= 0 or (cardinality(v_save_days) = 0 and cardinality(v_pause_days) = 0) then
    return query select v_inserted, v_remaining;
    return;
  end if;

  -- Walk start: today, or yesterday if today has no save/freeze/pause.
  v_cursor := v_eval;
  if not (v_cursor = any(v_save_days))
     and not (v_cursor = any(v_frozen_days))
     and not (v_cursor = any(v_pause_days)) then
    v_cursor := v_cursor - 1;
  end if;
  if not (v_cursor = any(v_save_days))
     and not (v_cursor = any(v_frozen_days))
     and not (v_cursor = any(v_pause_days)) then
    return query select v_inserted, v_remaining;
    return;
  end if;

  loop
    exit when v_cursor < v_oldest;

    if (v_cursor = any(v_save_days))
       or (v_cursor = any(v_frozen_days))
       or (v_cursor = any(v_pause_days)) then
      v_cursor := v_cursor - 1;
      continue;
    end if;

    if v_remaining <= 0 then exit; end if;
    if to_char(v_cursor, 'YYYY-MM') <> v_month then exit; end if;

    -- A new freeze still needs a raw save on the older side. Paused
    -- days preserve the chain but do not act as that raw-save flank.
    if not ((v_cursor - 1) = any(v_save_days)) then exit; end if;

    insert into public.streak_freeze_usages (user_id, frozen_date, month_key)
    values (v_actor, v_cursor, to_char(v_cursor, 'YYYY-MM'))
    on conflict (user_id, frozen_date) do nothing;

    v_inserted    := array_append(v_inserted, v_cursor);
    v_frozen_days := array_append(v_frozen_days, v_cursor);
    v_remaining   := (v_remaining - 1)::smallint;
    v_cursor      := v_cursor - 1;
  end loop;

  return query select v_inserted, v_remaining;
end;
$$;

revoke all on function public.consume_streak_freezes_if_needed(date) from public;
grant execute on function public.consume_streak_freezes_if_needed(date) to authenticated;

commit;
