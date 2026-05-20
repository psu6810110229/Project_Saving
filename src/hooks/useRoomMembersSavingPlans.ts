import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  normalizePause,
  normalizeRevision,
  type RawPauseRow,
  type RawRevisionRow,
} from '../lib/savingPlanNormalization';
import type { SavingPlan } from '../types';

interface RawPlanRow {
  id: string;
  room_id: string;
  user_id: string;
  timezone: string;
  created_at: string;
  archived_at: string | null;
}

export interface UseRoomMembersSavingPlansResult {
  plansByUser: Record<string, SavingPlan | null>;
  loading: boolean;
  error: string | null;
}

const EMPTY_PLANS_BY_USER: Record<string, SavingPlan | null> = {};

function memberIdsKey(ids: string[]): string {
  if (ids.length === 0) return '';
  return [...ids].sort().join(',');
}

/**
 * N-safe fetcher for active Saving Plans of every other room member.
 * Returns one entry per id in `otherMemberIds`; members without an
 * active plan map to `null` (the key is present so consumers can write
 * `plansByUser[id]` without an `undefined` check beyond "is null").
 *
 * Three round-trips total regardless of N: plans → revisions → pauses,
 * each with `.in(...)` on the appropriate id list.
 *
 * This hook is the canonical N-safe internal. `usePartnerSavingPlan`
 * is a thin wrapper over it. MUST NOT import from
 * `usePartnerSavingPlan.ts` — doing so would create a circular import.
 */
export function useRoomMembersSavingPlans(
  roomId: string | null,
  otherMemberIds: string[],
): UseRoomMembersSavingPlansResult {
  const [plansByUser, setPlansByUser] = useState<Record<string, SavingPlan | null>>(EMPTY_PLANS_BY_USER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idsKey = useMemo(() => memberIdsKey(otherMemberIds), [otherMemberIds]);

  useEffect(() => {
    if (!roomId || otherMemberIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlansByUser(EMPTY_PLANS_BY_USER);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    // Stale-data reset: clear before fetching so a room switch does
    // not briefly show the previous room's plans.
    setPlansByUser(EMPTY_PLANS_BY_USER);
    setError(null);
    setLoading(true);

    async function fetchPlans() {
      const plansResult = await supabase
        .from('saving_plans')
        .select('*')
        .eq('room_id', roomId)
        .in('user_id', otherMemberIds)
        .is('archived_at', null);

      if (cancelled) return;
      if (plansResult.error) {
        if (typeof console !== 'undefined') {
          console.warn('[useRoomMembersSavingPlans] plans fetch failed', plansResult.error.message);
        }
        setError(plansResult.error.message);
        setLoading(false);
        return;
      }

      const planRows = (plansResult.data ?? []) as RawPlanRow[];
      const planIds = planRows.map(p => p.id);

      // Seed every requested id with null so callers can rely on the
      // key being present.
      const seeded: Record<string, SavingPlan | null> = {};
      for (const id of otherMemberIds) {
        seeded[id] = null;
      }

      if (planIds.length === 0) {
        setPlansByUser(seeded);
        setLoading(false);
        return;
      }

      const [revResult, pauseResult] = await Promise.all([
        supabase
          .from('saving_plan_revisions')
          .select('*')
          .in('plan_id', planIds)
          .order('effective_from_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('saving_plan_pauses')
          .select('*')
          .in('plan_id', planIds)
          .order('paused_from', { ascending: false }),
      ]);

      if (cancelled) return;
      if (revResult.error) {
        if (typeof console !== 'undefined') {
          console.warn('[useRoomMembersSavingPlans] revisions fetch failed', revResult.error.message);
        }
        setError(revResult.error.message);
        setLoading(false);
        return;
      }
      if (pauseResult.error) {
        if (typeof console !== 'undefined') {
          console.warn('[useRoomMembersSavingPlans] pauses fetch failed', pauseResult.error.message);
        }
        setError(pauseResult.error.message);
        setLoading(false);
        return;
      }

      const revisionsByPlan: Record<string, RawRevisionRow[]> = {};
      for (const r of (revResult.data ?? []) as RawRevisionRow[]) {
        const arr = revisionsByPlan[r.plan_id] ?? (revisionsByPlan[r.plan_id] = []);
        arr.push(r);
      }
      const pausesByPlan: Record<string, RawPauseRow[]> = {};
      for (const p of (pauseResult.data ?? []) as RawPauseRow[]) {
        const arr = pausesByPlan[p.plan_id] ?? (pausesByPlan[p.plan_id] = []);
        arr.push(p);
      }

      for (const row of planRows) {
        if (!otherMemberIds.includes(row.user_id)) continue;
        seeded[row.user_id] = {
          id: row.id,
          room_id: row.room_id,
          user_id: row.user_id,
          timezone: row.timezone,
          created_at: row.created_at,
          archived_at: row.archived_at,
          revisions: (revisionsByPlan[row.id] ?? []).map(normalizeRevision),
          pauses: (pausesByPlan[row.id] ?? []).map(normalizePause),
        };
      }

      setPlansByUser(seeded);
      setLoading(false);
    }

    void fetchPlans();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, idsKey]);

  return { plansByUser, loading, error };
}
