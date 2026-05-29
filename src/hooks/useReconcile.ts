import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { notifyBalanceChecked } from '../lib/notifyEvents';
import { useAuth } from './useAuth';
import type {
  BalanceActivityEntry,
  BalanceAdjustmentReason,
  BalanceCheckpoint,
} from '../types';

interface CreateCheckpointInput {
  actualAmount: number;
  reason?: BalanceAdjustmentReason;
  note?: string;
  clientRequestId?: string;
}

interface CreateCheckpointResult {
  error?: string;
  checkpointId?: string;
  adjustmentId?: string | null;
  ledgerAmount?: number;
  actualAmount?: number;
  differenceAmount?: number;
  reused?: boolean;
}

interface AllocateInput {
  bucketId: string;
  amount: number;
  clientRequestId?: string;
}

interface AllocateResult {
  error?: string;
  /** Stable RPC HINT token (e.g. `allocation_exceeds_pool`) for copy mapping. */
  errorHint?: string;
  allocationId?: string;
  destinationBucketId?: string;
  amount?: number;
  bucketBalanceAfter?: number;
  poolAfter?: number;
  reused?: boolean;
}

interface AllocateRpcRow {
  allocation_id: string;
  destination_bucket_id: string;
  amount: number | string;
  bucket_balance_after: number | string;
  pool_after: number | string;
  reused: boolean;
  created_at: string;
}

interface CreateCheckpointRpcRow {
  checkpoint_id: string;
  adjustment_id: string | null;
  ledger_amount: number | string;
  actual_amount: number | string;
  difference_amount: number | string;
  reason: BalanceAdjustmentReason | null;
  reused: boolean;
}

interface BalanceActivityRpcRow {
  checkpoint_id: string;
  user_id: string;
  display_name: string | null;
  checked_at: string;
  ledger_amount: number | string;
  actual_amount: number | string;
  difference_amount: number | string;
  reason: BalanceAdjustmentReason | null;
}

function toNum(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

/**
 * Reconcile / Check Balance data layer.
 *
 * Wraps the `create_balance_checkpoint` write RPC, the owner-only
 * fetch of the latest checkpoint, and the sanitized
 * `balance_activity_for_room` RPC for partner-visible summaries.
 */
export function useReconcile(roomId: string | null) {
  const { user } = useAuth();
  const [latest, setLatest] = useState<BalanceCheckpoint | null>(null);
  const [activity, setActivity] = useState<BalanceActivityEntry[]>([]);
  const [adjustmentSum, setAdjustmentSum] = useState(0);
  const [allocationSum, setAllocationSum] = useState(0);
  /**
   * Server-authoritative Verified Balance for the current user in this
   * room (positive deposits + signed adjustments). Loaded via the hardened
   * `current_reconciled_balance` RPC so the client never has to sum a
   * truncated log list. `null` while the first fetch is pending.
   */
  const [appBalance, setAppBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLatest = useCallback(async () => {
    if (!user || !roomId) {
      setLatest(null);
      return;
    }
    const { data, error: err } = await supabase
      .from('balance_checkpoints')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err) {
      setError(err.message);
      return;
    }
    setLatest(data
      ? {
          ...data,
          ledger_amount_at_time: Number(data.ledger_amount_at_time),
          actual_amount: Number(data.actual_amount),
          difference_amount: Number(data.difference_amount),
        }
      : null);
  }, [user, roomId]);

  const fetchAdjustmentSum = useCallback(async () => {
    if (!user || !roomId) {
      setAdjustmentSum(0);
      return;
    }
    const { data, error: err } = await supabase
      .from('balance_adjustments')
      .select('amount')
      .eq('room_id', roomId)
      .eq('user_id', user.id);

    if (err) {
      setError(err.message);
      return;
    }
    const rows = (data ?? []) as { amount: number | string }[];
    setAdjustmentSum(rows.reduce((sum, row) => sum + toNum(row.amount), 0));
  }, [user, roomId]);

  const fetchAllocationSum = useCallback(async () => {
    if (!user || !roomId) {
      setAllocationSum(0);
      return;
    }
    const { data, error: err } = await supabase
      .from('balance_allocations')
      .select('amount')
      .eq('room_id', roomId)
      .eq('user_id', user.id);

    if (err) {
      setError(err.message);
      return;
    }
    const rows = (data ?? []) as { amount: number | string }[];
    setAllocationSum(rows.reduce((sum, row) => sum + toNum(row.amount), 0));
  }, [user, roomId]);

  const fetchAppBalance = useCallback(async () => {
    if (!user || !roomId) {
      setAppBalance(null);
      return;
    }
    const { data, error: err } = await supabase
      .rpc('current_reconciled_balance', { p_room_id: roomId });

    if (err) {
      setError(err.message);
      return;
    }
    setAppBalance(toNum(data as number | string | null));
  }, [user, roomId]);

  const fetchActivity = useCallback(async (limit = 20) => {
    if (!roomId) {
      setActivity([]);
      return;
    }
    const { data, error: err } = await supabase
      .rpc('balance_activity_for_room', { p_room_id: roomId, p_limit: limit });

    if (err) {
      setError(err.message);
      return;
    }
    const rows = (data ?? []) as BalanceActivityRpcRow[];
    setActivity(rows.map(row => ({
      checkpoint_id: row.checkpoint_id,
      user_id: row.user_id,
      display_name: row.display_name,
      checked_at: row.checked_at,
      ledger_amount: toNum(row.ledger_amount),
      actual_amount: toNum(row.actual_amount),
      difference_amount: toNum(row.difference_amount),
      reason: row.reason,
    })));
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    Promise.all([fetchLatest(), fetchActivity(), fetchAdjustmentSum(), fetchAllocationSum(), fetchAppBalance()])
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchLatest, fetchActivity, fetchAdjustmentSum, fetchAllocationSum, fetchAppBalance]);

  async function createCheckpoint(input: CreateCheckpointInput): Promise<CreateCheckpointResult> {
    if (!user) return { error: 'Not authenticated' };
    if (!roomId) return { error: 'No active room' };
    if (!Number.isFinite(input.actualAmount) || input.actualAmount < 0) {
      return { error: 'Enter an actual amount of zero or more.' };
    }

    const { data, error: rpcError } = await supabase.rpc('create_balance_checkpoint', {
      p_room_id: roomId,
      p_actual_amount: input.actualAmount,
      p_reason: input.reason ?? null,
      p_note: input.note ?? null,
      p_storage_items: [],
      p_client_request_id: input.clientRequestId ?? null,
    });

    if (rpcError) return { error: rpcError.message };

    const row = (Array.isArray(data) ? data[0] : data) as CreateCheckpointRpcRow | undefined;
    if (!row) return { error: 'No checkpoint returned' };

    await Promise.all([fetchLatest(), fetchActivity(), fetchAdjustmentSum(), fetchAllocationSum(), fetchAppBalance()]);

    // Fire-and-forget partner notification. Reuse is no-op on the
    // server side, so retrying the same checkpoint id is safe.
    if (!row.reused) {
      notifyBalanceChecked(row.checkpoint_id);
    }

    return {
      checkpointId: row.checkpoint_id,
      adjustmentId: row.adjustment_id,
      ledgerAmount: toNum(row.ledger_amount),
      actualAmount: toNum(row.actual_amount),
      differenceAmount: toNum(row.difference_amount),
      reused: row.reused,
    };
  }

  /**
   * Move `amount` of the unallocated reconcile surplus into one of the
   * caller's own buckets. Verified Balance is unchanged (allocations are
   * not deposits and not adjustments); only the bucket's balance and the
   * unallocated pool move. Idempotent via `clientRequestId`.
   */
  async function allocate(input: AllocateInput): Promise<AllocateResult> {
    if (!user) return { error: 'Not authenticated' };
    if (!roomId) return { error: 'No active room' };
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { error: 'Enter an amount greater than zero.' };
    }

    const { data, error: rpcError } = await supabase.rpc('allocate_balance_to_bucket', {
      p_room_id: roomId,
      p_bucket_id: input.bucketId,
      p_amount: input.amount,
      p_client_request_id: input.clientRequestId ?? null,
    });

    if (rpcError) return { error: rpcError.message, errorHint: rpcError.hint ?? undefined };

    const row = (Array.isArray(data) ? data[0] : data) as AllocateRpcRow | undefined;
    if (!row) return { error: 'No allocation returned' };

    await Promise.all([fetchAdjustmentSum(), fetchAllocationSum(), fetchAppBalance()]);

    return {
      allocationId: row.allocation_id,
      destinationBucketId: row.destination_bucket_id,
      amount: toNum(row.amount),
      bucketBalanceAfter: toNum(row.bucket_balance_after),
      poolAfter: toNum(row.pool_after),
      reused: row.reused,
    };
  }

  return {
    latest,
    activity,
    adjustmentSum,
    allocationSum,
    appBalance,
    /**
     * Reconcile surplus not yet placed in any bucket
     * (Verified Balance − bucketTotal = Σ adjustments − Σ allocations).
     * Clamped to ≥ 0; a negative pool means buckets currently exceed the
     * verified balance, which is surfaced as a downward difference, not an
     * allocatable amount.
     */
    unallocatedPool: Math.max(0, Math.round((adjustmentSum - allocationSum) * 100) / 100),
    loading,
    error,
    createCheckpoint,
    allocate,
    refetch: useCallback(async () => {
      await Promise.all([fetchLatest(), fetchActivity(), fetchAdjustmentSum(), fetchAllocationSum(), fetchAppBalance()]);
    }, [fetchLatest, fetchActivity, fetchAdjustmentSum, fetchAllocationSum, fetchAppBalance]),
  };
}
