import type { SavingsLog } from '../types';

/**
 * Cumulative recorded-deposit series for the Deposit Race line chart.
 *
 * Given the logs for a room, returns the running total per day for the
 * last 7 days, filtered by user and optionally by bucket. Output has the
 * same length as `lastSevenDayLabels` so the parent can align both
 * axes. The series resets per call (no shared state across renders).
 *
 * If `bucketId` is null the totals include all of the user's logs in
 * the room (the "All buckets" / main-goal mode).
 */
export function cumulativeRaceSeries(
  logs: SavingsLog[],
  userId: string | undefined | null,
  bucketId: string | null,
  today = new Date(),
): number[] {
  if (!userId) return Array.from({ length: 7 }, () => 0);
  const keys = lastSevenDateKeys(today);
  const dailyTotals = keys.map(key => logs
    .filter(log => log.user_id === userId
      && (bucketId === null || log.bucket_id === bucketId)
      && localDateKey(log.created_at) === key)
    .reduce((sum, log) => sum + log.amount, 0));
  let running = 0;
  return dailyTotals.map(amount => {
    running += amount;
    return running;
  });
}

function lastSevenDateKeys(today: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => localDateKey(daysAgo(today, 6 - index).toISOString()));
}

function daysAgo(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function localDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
