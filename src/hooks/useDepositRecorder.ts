import { useCallback } from 'react';
import { haptic } from '../lib/haptics';
import { localDateKey } from '../lib/streak';
import type { RoomVisibleMomentumFlow } from '../types';

/**
 * Shared deposit orchestration.
 *
 * Centralizes the behavior that follows a positive `savings_logs` insert so
 * the bucket deposit (BucketSheet) and the upcoming Check Balance deposit mode
 * share one path:
 *   - write the deposit via `useLogs.insert` (which owns the notification +
 *     smart-event side effects — those stay in the hook, not here)
 *   - add the optimistic momentum flow
 *   - compute whether the bucket target was reached by this deposit
 *   - fire haptic feedback
 *
 * UI concerns (vault preview, closing sheets) stay with callers, driven by the
 * returned result shape.
 */

export interface RecordDepositInput {
  amount: number;
  bucketId: string;
  bucketName: string;
  /** Bucket saved amount before this deposit. */
  prevSaved: number;
  /** Bucket target; used to compute `reachedTarget`. */
  target: number;
  /** Whether the bucket plan was paused at deposit time. */
  wasPaused: boolean;
  note?: string;
  slipUrl?: string | null;
}

export interface DepositRecorderResult {
  amount: number;
  bucketId: string;
  bucketName: string;
  /** Deposit crossed the bucket target (was below, now at/above). */
  reachedTarget: boolean;
  /** Bucket plan was paused at deposit time (suppress streak-specific copy). */
  wasPaused: boolean;
  error?: string;
}

interface UseDepositRecorderDeps {
  userId: string | undefined;
  insert: (
    amount: number,
    bucketId: string,
    note?: string,
    slipUrl?: string | null,
  ) => Promise<{ error?: string }>;
  addOptimisticFlow: (flow: RoomVisibleMomentumFlow) => void;
}

export function useDepositRecorder({ userId, insert, addOptimisticFlow }: UseDepositRecorderDeps) {
  const recordDeposit = useCallback(
    async (input: RecordDepositInput): Promise<DepositRecorderResult> => {
      const { amount, bucketId, bucketName, prevSaved, target, wasPaused, note, slipUrl } = input;
      const base: Omit<DepositRecorderResult, 'error'> = {
        amount,
        bucketId,
        bucketName,
        reachedTarget: false,
        wasPaused,
      };

      const result = await insert(amount, bucketId, note, slipUrl);
      if (result.error) {
        return { ...base, error: result.error };
      }

      if (userId) {
        const createdAt = new Date().toISOString();
        addOptimisticFlow({
          user_id: userId,
          bucket_id: bucketId,
          date_key: localDateKey(createdAt),
          amount,
          event_kind: 'deposit',
        });
      }

      const reachedTarget = prevSaved < target && prevSaved + amount >= target;
      haptic(reachedTarget ? 'milestone' : 'success');

      return { ...base, reachedTarget };
    },
    [userId, insert, addOptimisticFlow],
  );

  return { recordDeposit };
}
