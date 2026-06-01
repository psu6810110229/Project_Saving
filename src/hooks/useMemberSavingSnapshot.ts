import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Read-only snapshot of a single member's saving data inside a room,
 * scoped to fields the Member Detail page is allowed to display.
 *
 * Privacy contract: this hook MUST NOT read raw private balance rows.
 * It reads room-visible aggregate RPCs plus the member's public goal row.
 * Specifically it does not read `savings_logs.note`, `savings_logs.slip_url`,
 * raw `balance_allocations`, raw `bucket_transfers`, `balance_checkpoints`,
 * `balance_adjustments`, `current_reconciled_balance`,
 * `balance_activity_for_room`, `notification_preferences`,
 * `push_subscriptions`, or the raw `auth.users.email`.
 */
export interface MemberSavingSnapshot {
  /** Member's personal goal target for this room. */
  target: number;
  /** Room-visible bucket balance for the member. */
  saved: number;
  /** Room-visible per-bucket balances, keyed by bucket id. */
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
  total: string | number;
  last_deposit_at: string | null;
  deposit_day_keys: string[] | null;
}

interface RawBucketTotalRow {
  bucket_id: string;
  total: string | number;
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
      const [goalRes, summaryRes, bucketRes] = await Promise.all([
        supabase
          .from('goals')
          .select('target_amount')
          .eq('room_id', roomId)
          .eq('user_id', userId)
          .maybeSingle(),
        supabase.rpc('member_visible_balance_summary', {
          p_room_id: roomId,
          p_user_id: userId,
        }),
        supabase.rpc('member_bucket_visible_balances', {
          p_room_id: roomId,
          p_user_id: userId,
        }),
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
      if (summaryRes.error) {
        setState({
          target: 0,
          saved: 0,
          bucketSavedById: EMPTY_BUCKET_MAP,
          depositDayKeys: EMPTY_DAY_KEYS,
          loading: false,
          error: summaryRes.error.message,
        });
        return;
      }
      if (bucketRes.error) {
        setState({
          target: 0,
          saved: 0,
          bucketSavedById: EMPTY_BUCKET_MAP,
          depositDayKeys: EMPTY_DAY_KEYS,
          loading: false,
          error: bucketRes.error.message,
        });
        return;
      }

      const target = goalRes.data
        ? Number((goalRes.data as RawGoalRow).target_amount)
        : 0;

      const summaryRow = (Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data) as RawLogRow | undefined;
      const saved = summaryRow ? Number(summaryRow.total) : 0;
      const bucketSavedById: Record<string, number> = {};
      for (const row of (bucketRes.data ?? []) as RawBucketTotalRow[]) {
        if (!row.bucket_id) continue;
        bucketSavedById[row.bucket_id] = Number(row.total);
      }

      setState({
        target,
        saved,
        bucketSavedById,
        depositDayKeys: summaryRow?.deposit_day_keys ?? EMPTY_DAY_KEYS,
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
