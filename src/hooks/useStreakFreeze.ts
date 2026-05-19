import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { APP_TZ, localDateKey } from '../lib/streak';
import type { StreakFreezeUsage } from '../types';

/**
 * SPRINT1-003 streak-freeze data hook.
 *
 * On mount and on `userId` change, this hook:
 *   1. Calls `consume_streak_freezes_if_needed(today)` once with the
 *      caller's Bangkok-local date so any in-budget grace day that
 *      already fits the chain is materialised server-side before we
 *      read it.
 *   2. Loads the user's `streak_freeze_usages` rows for roughly the
 *      last 90 days — wide enough to feed `calcStreakWithFreezes`,
 *      narrow enough to keep the payload tiny.
 *   3. Subscribes to realtime `INSERT` events on `savings_logs` for
 *      this user and re-calls the RPC after each deposit so a save
 *      that crosses the "between two save days" rule consumes a
 *      freeze immediately.
 *   4. Subscribes to realtime `INSERT` on `streak_freeze_usages` to
 *      keep `frozenDates` in sync without a refetch.
 *
 * It exposes a `Set<string>` of Bangkok-local `YYYY-MM-DD` dates that
 * were auto-frozen for this user, plus the per-month bookkeeping and
 * latest freeze date for downstream streak/hint UI.
 *
 * No row is ever written to `savings_logs` by this hook.
 */

const LOOKBACK_DAYS = 90;

interface UseStreakFreezeResult {
  loading: boolean;
  /** Bangkok-local `YYYY-MM-DD` dates auto-frozen for this user (~90d). */
  frozenDates: ReadonlySet<string>;
  freezesUsedThisMonth: number;
  /** Null until the budget row has been resolved server-side. */
  freezesRemainingThisMonth: number | null;
  /** Latest auto-freeze date as `YYYY-MM-DD`, or null if none. */
  lastFreezeDate: string | null;
  refresh: () => Promise<void>;
}

function bangkokTodayKey(): string {
  return localDateKey(new Date().toISOString(), APP_TZ);
}

function bangkokMonthKey(dateKey: string): string {
  // `YYYY-MM-DD` → `YYYY-MM`. Both are already Bangkok-local.
  return dateKey.slice(0, 7);
}

function lookbackStartKey(todayKey: string): string {
  // Add 12 hours of slack so the local-date arithmetic does not skip
  // a day when the runtime crosses DST or when the Date constructor
  // interprets a midnight string as UTC.
  const d = new Date(todayKey + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - LOOKBACK_DAYS);
  return d.toISOString().slice(0, 10);
}

export function useStreakFreeze(userId: string | undefined): UseStreakFreezeResult {
  const [usages, setUsages] = useState<StreakFreezeUsage[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(userId));
  const [todayKey, setTodayKey] = useState<string>(bangkokTodayKey);

  // Tick at midnight Bangkok time so the monthly budget reading flips
  // from "May, 2 left" to "June, 2 left" without a page reload.
  useEffect(() => {
    const id = setInterval(() => {
      const current = bangkokTodayKey();
      setTodayKey(prev => (prev !== current ? current : prev));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const today = bangkokTodayKey();

    // Run the RPC first so any freeze that newly qualifies is
    // materialised before we read the table.
    const { data: rpcRows, error: rpcError } = await supabase.rpc(
      'consume_streak_freezes_if_needed',
      { p_evaluation_date: today },
    );
    if (rpcError && typeof console !== 'undefined') {
      console.warn('[useStreakFreeze] consume_streak_freezes_if_needed failed', rpcError);
    }
    const rpcRow = Array.isArray(rpcRows) ? (rpcRows[0] as { frozen_dates: string[] | null; remaining_in_month: number | null } | undefined) : undefined;
    if (rpcRow && typeof rpcRow.remaining_in_month === 'number') {
      setRemaining(rpcRow.remaining_in_month);
    }

    const since = lookbackStartKey(today);
    const { data, error } = await supabase
      .from('streak_freeze_usages')
      .select('id, user_id, frozen_date, month_key, created_at')
      .eq('user_id', userId)
      .gte('frozen_date', since)
      .order('frozen_date', { ascending: false });

    if (error) {
      if (typeof console !== 'undefined') {
        console.warn('[useStreakFreeze] load failed', error);
      }
      setLoading(false);
      return;
    }
    setUsages((data ?? []) as StreakFreezeUsage[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsages([]);
      setRemaining(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [userId, refresh]);

  // Realtime: after each new deposit by this user, retry the RPC so a
  // gap that just became "interior" is frozen on the spot.
  useEffect(() => {
    if (!userId) return;

    const logsChannelId = `streak-freeze-logs:${userId}-${Math.random().toString(36).slice(2, 9)}`;
    const logsChannel = supabase.channel(logsChannelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'savings_logs',
          filter: `user_id=eq.${userId}`,
        },
        () => { void refresh(); },
      )
      .subscribe();

    const usagesChannelId = `streak-freeze-usages:${userId}-${Math.random().toString(36).slice(2, 9)}`;
    const usagesChannel = supabase.channel(usagesChannelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'streak_freeze_usages',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          const row = payload.new as StreakFreezeUsage;
          setUsages(prev => (
            prev.some(u => u.id === row.id) ? prev : [row, ...prev]
          ));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(usagesChannel);
    };
  }, [userId, refresh]);

  const monthKey = bangkokMonthKey(todayKey);

  const frozenDates = useMemo<ReadonlySet<string>>(() => {
    const set = new Set<string>();
    for (const row of usages) set.add(row.frozen_date);
    return set;
  }, [usages]);

  const freezesUsedThisMonth = useMemo(() => (
    usages.filter(u => u.month_key === monthKey).length
  ), [usages, monthKey]);

  const lastFreezeDate = useMemo(() => {
    if (usages.length === 0) return null;
    // usages is ordered desc by frozen_date from the initial fetch,
    // but realtime inserts could shuffle that. Recompute the max so
    // the hint reliably points at the most recent freeze.
    return usages.reduce<string | null>((acc, u) => (
      acc === null || u.frozen_date > acc ? u.frozen_date : acc
    ), null);
  }, [usages]);

  return {
    loading,
    frozenDates,
    freezesUsedThisMonth,
    freezesRemainingThisMonth: remaining,
    lastFreezeDate,
    refresh,
  };
}
