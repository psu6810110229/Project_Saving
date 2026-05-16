import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  SavingPlan,
  SavingPlanPause,
  SavingPlanRevision,
  SavingPlanRuleType,
} from '../types';

interface RawPlanRow {
  id: string;
  room_id: string;
  user_id: string;
  timezone: string;
  created_at: string;
  archived_at: string | null;
}

interface RawRevisionRow {
  id: string;
  plan_id: string;
  room_id: string;
  user_id: string;
  effective_from_date: string;
  rule_type: SavingPlanRuleType;
  amount: number | string | null;
  start_amount: number | string | null;
  increment_amount: number | string | null;
  cap_amount: number | string | null;
  target_amount: number | string;
  end_date: string | null;
  day_count: number | null;
  created_at: string;
}

interface RawPauseRow {
  id: string;
  plan_id: string;
  room_id: string;
  user_id: string;
  paused_from: string;
  resumed_from: string | null;
  created_at: string;
  resumed_at: string | null;
}

function toNum(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

function maybeNum(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value);
}

function normalizeRevision(row: RawRevisionRow): SavingPlanRevision {
  return {
    id: row.id,
    plan_id: row.plan_id,
    room_id: row.room_id,
    user_id: row.user_id,
    effective_from_date: row.effective_from_date,
    rule_type: row.rule_type,
    amount: maybeNum(row.amount),
    start_amount: maybeNum(row.start_amount),
    increment_amount: maybeNum(row.increment_amount),
    cap_amount: maybeNum(row.cap_amount),
    target_amount: toNum(row.target_amount),
    end_date: row.end_date,
    day_count: row.day_count,
    created_at: row.created_at,
  };
}

function normalizePause(row: RawPauseRow): SavingPlanPause {
  return {
    id: row.id,
    plan_id: row.plan_id,
    room_id: row.room_id,
    user_id: row.user_id,
    paused_from: row.paused_from,
    resumed_from: row.resumed_from,
    created_at: row.created_at,
    resumed_at: row.resumed_at,
  };
}

export interface UsePartnerSavingPlanResult {
  plan: SavingPlan | null;
  loading: boolean;
  error: string | null;
}

/**
 * Read-only view of a partner's active Saving Plan for the active
 * room. Mirrors the read path of useSavingPlan but never exposes any
 * mutation; the Saving Plan page renders this in a hidden-CTA mode.
 *
 * Relies on migration 0047 widening SELECT to co-members. Without
 * 0047 the queries simply return no rows (RLS-filtered), so the
 * partner tab shows the empty state instead of throwing.
 */
export function usePartnerSavingPlan(
  roomId: string | null,
  partnerUserId: string | null | undefined,
): UsePartnerSavingPlanResult {
  const [plan, setPlan] = useState<SavingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!roomId || !partnerUserId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlan(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    async function fetchPartnerPlan() {
      const { data: planRow, error: planErr } = await supabase
        .from('saving_plans')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', partnerUserId as string)
        .is('archived_at', null)
        .maybeSingle();

      if (cancelled) return;
      if (planErr) {
        setError(planErr.message);
        setPlan(null);
        setLoading(false);
        return;
      }
      if (!planRow) {
        setPlan(null);
        setLoading(false);
        return;
      }
      const row = planRow as RawPlanRow;

      const [revResult, pauseResult] = await Promise.all([
        supabase
          .from('saving_plan_revisions')
          .select('*')
          .eq('plan_id', row.id)
          .order('effective_from_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('saving_plan_pauses')
          .select('*')
          .eq('plan_id', row.id)
          .order('paused_from', { ascending: false }),
      ]);

      if (cancelled) return;
      if (revResult.error) {
        setError(revResult.error.message);
        setPlan(null);
        setLoading(false);
        return;
      }
      if (pauseResult.error) {
        setError(pauseResult.error.message);
        setPlan(null);
        setLoading(false);
        return;
      }

      setPlan({
        id: row.id,
        room_id: row.room_id,
        user_id: row.user_id,
        timezone: row.timezone,
        created_at: row.created_at,
        archived_at: row.archived_at,
        revisions: (revResult.data ?? []).map(r => normalizeRevision(r as RawRevisionRow)),
        pauses: (pauseResult.data ?? []).map(p => normalizePause(p as RawPauseRow)),
      });
      setLoading(false);
    }

    void fetchPartnerPlan();
    return () => {
      cancelled = true;
    };
  }, [roomId, partnerUserId]);

  return { plan, loading, error };
}
