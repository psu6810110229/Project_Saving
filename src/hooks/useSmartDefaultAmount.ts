import type { SavingsLog } from '../types';

export type SmartDefaultReason = 'mode' | 'recent' | 'none';

export interface SmartDefaultAmount {
  value: number | null;
  reason: SmartDefaultReason;
}

const MIN_HISTORY = 3;

/**
 * Derives a "habitual" deposit amount from the user's recent positive logs.
 *
 * - Prefers bucket-scoped history; falls back to the user's full positive
 *   log set when the bucket scope has fewer than MIN_HISTORY entries.
 * - Returns the most frequent amount; on tie, the most recent of the tied
 *   amounts; if every amount in scope is distinct, the most recent amount.
 * - Returns `{ value: null, reason: 'none' }` when there are fewer than
 *   MIN_HISTORY qualifying logs, so callers can fall back to today's
 *   default behaviour without a hint.
 */
export function useSmartDefaultAmount(
  userId: string | undefined,
  bucketId: string | null,
  logs: SavingsLog[],
): SmartDefaultAmount {
  if (!userId) return { value: null, reason: 'none' };

  const userLogs = logs.filter(
    log => log.user_id === userId && log.amount > 0,
  );

  const scoped = bucketId
    ? userLogs.filter(log => log.bucket_id === bucketId)
    : [];
  const pool = scoped.length >= MIN_HISTORY ? scoped : userLogs;

  if (pool.length < MIN_HISTORY) {
    return { value: null, reason: 'none' };
  }

  const sortedDesc = [...pool].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  const counts = new Map<number, number>();
  for (const log of sortedDesc) {
    counts.set(log.amount, (counts.get(log.amount) ?? 0) + 1);
  }

  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) maxCount = count;
  }

  if (maxCount <= 1) {
    return { value: sortedDesc[0].amount, reason: 'recent' };
  }

  for (const log of sortedDesc) {
    if (counts.get(log.amount) === maxCount) {
      return { value: log.amount, reason: 'mode' };
    }
  }

  return { value: null, reason: 'none' };
}
