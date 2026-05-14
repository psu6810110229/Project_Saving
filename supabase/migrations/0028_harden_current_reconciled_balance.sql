-- ============================================================
-- 0028_harden_current_reconciled_balance.sql
-- Lock down the reconciled-balance helper to the authenticated
-- caller and the rooms they are a member of.
--
-- The version from 0027 accepted an arbitrary (p_room_id, p_user_id)
-- pair and was granted to `authenticated` as SECURITY DEFINER, which
-- let any signed-in user read any user's reconciled balance for any
-- room. Drop that signature and replace it with a no-arbitrary-user
-- variant that uses auth.uid() and validates room membership.
-- ============================================================

begin;

-- Remove the unsafe signature entirely.
drop function if exists public.current_reconciled_balance(uuid, uuid);

-- Re-create as a single-argument helper bound to the caller. Returns
-- the caller's own reconciled balance for `p_room_id`: positive
-- deposits in savings_logs plus any signed balance_adjustments. The
-- numbers stay consistent with what create_balance_checkpoint
-- computes server-side.
create or replace function public.current_reconciled_balance(p_room_id uuid)
returns numeric
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_room_id is null then
    raise exception 'room id required' using errcode = '22023';
  end if;

  if not public.is_room_member(p_room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  return coalesce((
    select sum(l.amount)
    from public.savings_logs l
    where l.room_id = p_room_id
      and l.user_id = v_user_id
  ), 0)
  + coalesce((
    select sum(a.amount)
    from public.balance_adjustments a
    where a.room_id = p_room_id
      and a.user_id = v_user_id
  ), 0);
end;
$$;

revoke all on function public.current_reconciled_balance(uuid) from public;
grant execute on function public.current_reconciled_balance(uuid) to authenticated;

commit;
