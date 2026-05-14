import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  RecordedDepositsSummary,
  SavingPlan,
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

interface DepositsSummaryRow {
  total: number | string;
  last_deposit_at: string | null;
  deposit_day_keys: string[] | null;
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

export interface CreatePlanInput {
  ruleType: SavingPlanRuleType;
  targetAmount: number;
  amount?: number;
  startAmount?: number;
  incrementAmount?: number;
  capAmount?: number;
  effectiveFromDate?: string;
  endDate?: string;
  dayCount?: number;
}

interface MutationResult {
  error?: string;
  planId?: string;
  revisionId?: string;
}

/**
 * Saving Plan data layer. Reads the caller's own plan + revisions
 * and their authoritative Recorded Deposits summary. Writes go
 * through the security-definer RPCs in migration 0030.
 */
export function useSavingPlan(roomId: string | null) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<SavingPlan | null>(null);
  const [deposits, setDeposits] = useState<RecordedDepositsSummary>({
    total: 0,
    last_deposit_at: null,
    deposit_day_keys: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!user || !roomId) {
      setPlan(null);
      return;
    }
    const { data: planRow, error: planErr } = await supabase
      .from('saving_plans')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .is('archived_at', null)
      .maybeSingle();

    if (planErr) {
      setError(planErr.message);
      return;
    }
    if (!planRow) {
      setPlan(null);
      return;
    }
    const row = planRow as RawPlanRow;

    const { data: revRows, error: revErr } = await supabase
      .from('saving_plan_revisions')
      .select('*')
      .eq('plan_id', row.id)
      .order('effective_from_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (revErr) {
      setError(revErr.message);
      return;
    }

    setPlan({
      id: row.id,
      room_id: row.room_id,
      user_id: row.user_id,
      timezone: row.timezone,
      created_at: row.created_at,
      archived_at: row.archived_at,
      revisions: (revRows ?? []).map(r => normalizeRevision(r as RawRevisionRow)),
    });
  }, [user, roomId]);

  const fetchDeposits = useCallback(async () => {
    if (!user || !roomId) {
      setDeposits({ total: 0, last_deposit_at: null, deposit_day_keys: [] });
      return;
    }
    const { data, error: err } = await supabase
      .rpc('recorded_deposits_summary', { p_room_id: roomId });

    if (err) {
      setError(err.message);
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as DepositsSummaryRow | undefined;
    if (!row) {
      setDeposits({ total: 0, last_deposit_at: null, deposit_day_keys: [] });
      return;
    }
    setDeposits({
      total: toNum(row.total),
      last_deposit_at: row.last_deposit_at,
      deposit_day_keys: row.deposit_day_keys ?? [],
    });
  }, [user, roomId]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    Promise.all([fetchPlan(), fetchDeposits()])
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchPlan, fetchDeposits]);

  async function createPlan(input: CreatePlanInput): Promise<MutationResult> {
    if (!user) return { error: 'Not authenticated' };
    if (!roomId) return { error: 'No active room' };

    const { data, error: rpcErr } = await supabase.rpc('create_saving_plan', {
      p_room_id: roomId,
      p_rule_type: input.ruleType,
      p_target_amount: input.targetAmount,
      p_amount: input.amount ?? null,
      p_start_amount: input.startAmount ?? null,
      p_increment_amount: input.incrementAmount ?? null,
      p_effective_from_date: input.effectiveFromDate ?? null,
      p_end_date: input.endDate ?? null,
      p_day_count: input.dayCount ?? null,
      p_cap_amount: input.capAmount ?? null,
    });
    if (rpcErr) return { error: rpcErr.message };
    const row = (Array.isArray(data) ? data[0] : data) as { plan_id?: string; revision_id?: string } | undefined;
    await fetchPlan();
    return { planId: row?.plan_id, revisionId: row?.revision_id };
  }

  async function changePlan(input: CreatePlanInput): Promise<MutationResult> {
    if (!user) return { error: 'Not authenticated' };
    if (!plan) return { error: 'No plan to change' };

    const { data, error: rpcErr } = await supabase.rpc('change_saving_plan', {
      p_plan_id: plan.id,
      p_rule_type: input.ruleType,
      p_target_amount: input.targetAmount,
      p_amount: input.amount ?? null,
      p_start_amount: input.startAmount ?? null,
      p_increment_amount: input.incrementAmount ?? null,
      p_effective_from_date: input.effectiveFromDate ?? null,
      p_end_date: input.endDate ?? null,
      p_day_count: input.dayCount ?? null,
      p_cap_amount: input.capAmount ?? null,
    });
    if (rpcErr) return { error: rpcErr.message };
    await fetchPlan();
    return { planId: plan.id, revisionId: typeof data === 'string' ? data : undefined };
  }

  return {
    plan,
    deposits,
    loading,
    error,
    createPlan,
    changePlan,
    refetch: useCallback(async () => {
      await Promise.all([fetchPlan(), fetchDeposits()]);
    }, [fetchPlan, fetchDeposits]),
  };
}
