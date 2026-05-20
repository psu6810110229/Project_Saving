import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Read-only snapshot of a single member's saving data inside a room,
 * scoped to fields the Member Detail page is allowed to display.
 *
 * Privacy contract: this hook MUST NOT query private columns or tables.
 * Specifically it does not read `savings_logs.note`, `savings_logs.slip_url`,
 * `balance_checkpoints`, `balance_adjustments`, `current_reconciled_balance`,
 * `balance_activity_for_room`, `notification_preferences`, `push_subscriptions`,
 * or the raw `auth.users.email`. The deposit query selects only the columns
 * needed to compute the member-visible totals: `amount`, `bucket_id`,
 * `created_at`.
 */
export interface MemberSavingSnapshot {
  /** Member's personal goal target for this room. */
  target: number;
  /** Sum of positive deposits the member has recorded in this room. */
  saved: number;
  /** Per-bucket sum of the member's deposits, keyed by bucket id. */
  bucketSavedById: Record<string, number>;
  /** Distinct day keys (YYYY-MM-DD) the member recorded a deposit on. */
  depositDayKeys: string[];
  loading: boolean;
  error: string | null;
}

const EMPTY_BUCKET_MAP: Record<string, number> = {};
const EMPTY_DAY_KEYS: string[] = [];

interface RawGoalRow {
  target_amount: string | number;
}

interface RawLogRow {
  amount: string | number;
  bucket_id: string | null;
  created_at: string;
}

export function useMemberSavingSnapshot(
  roomId: string | null,
  userId: string | null,
): MemberSavingSnapshot {
  const [state, setState] = useState<MemberSavingSnapshot>(() => ({
    target: 0,
    saved: 0,
    bucketSavedById: EMPTY_BUCKET_MAP,
    depositDayKeys: EMPTY_DAY_KEYS,
    loading: roomId !== null && userId !== null,
    error: null,
  }));

  useEffect(() => {
    if (!roomId || !userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({
        target: 0,
        saved: 0,
        bucketSavedById: EMPTY_BUCKET_MAP,
        depositDayKeys: EMPTY_DAY_KEYS,
        loading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: null }));

    async function load() {
      const [goalRes, logsRes] = await Promise.all([
        supabase
          .from('goals')
          .select('target_amount')
          .eq('room_id', roomId)
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('savings_logs')
          .select('amount, bucket_id, created_at')
          .eq('room_id', roomId)
          .eq('user_id', userId),
      ]);

      if (cancelled) return;

      if (goalRes.error) {
        setState({
          target: 0,
          saved: 0,
          bucketSavedById: EMPTY_BUCKET_MAP,
          depositDayKeys: EMPTY_DAY_KEYS,
          loading: false,
          error: goalRes.error.message,
        });
        return;
      }
      if (logsRes.error) {
        setState({
          target: 0,
          saved: 0,
          bucketSavedById: EMPTY_BUCKET_MAP,
          depositDayKeys: EMPTY_DAY_KEYS,
          loading: false,
          error: logsRes.error.message,
        });
        return;
      }

      const target = goalRes.data
        ? Number((goalRes.data as RawGoalRow).target_amount)
        : 0;

      const rows = (logsRes.data ?? []) as RawLogRow[];
      let saved = 0;
      const bucketSavedById: Record<string, number> = {};
      const dayKeySet = new Set<string>();
      for (const row of rows) {
        const amount = Number(row.amount);
        saved += amount;
        if (row.bucket_id) {
          bucketSavedById[row.bucket_id] = (bucketSavedById[row.bucket_id] ?? 0) + amount;
        }
        if (row.created_at && row.created_at.length >= 10) {
          dayKeySet.add(row.created_at.slice(0, 10));
        }
      }

      setState({
        target,
        saved,
        bucketSavedById,
        depositDayKeys: Array.from(dayKeySet),
        loading: false,
        error: null,
      });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [roomId, userId]);

  return state;
}
