import { useEffect, useMemo, useState } from 'react';
import { calcStreakWithFreezes, localDateKey, APP_TZ } from '../lib/streak';
import { calcPeriodAwareStreak, type StreakGranularity } from '../lib/streakCalculation';
import type { Bucket, BucketTransfer, SavingsLog } from '../types';

function todayKey() {
  return localDateKey(new Date().toISOString(), APP_TZ);
}

interface UseStreakResult {
  streak: number;
  hasLoggedToday: boolean;
  unit: StreakGranularity;
  trackable: boolean;
}

/**
 * Returns the streak number a user should see, honouring any
 * auto-spent freezes for that user. Pass an empty set to recover the
 * original raw-chain behaviour.
 */
export function useStreak(
  userId: string | undefined,
  logs: SavingsLog[],
  frozenDates: ReadonlySet<string> = new Set(),
  buckets?: Bucket[],
  transfers?: BucketTransfer[],
): UseStreakResult {
  const [today, setToday] = useState(todayKey);

  // Tick at midnight Bangkok time so the streak resets without a page reload
  useEffect(() => {
    const id = setInterval(() => {
      const current = todayKey();
      setToday(prev => prev !== current ? current : prev);
    }, 30_000); // check every 30s — cheap string compare
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    if (!userId) return { streak: 0, hasLoggedToday: false, unit: 'day', trackable: false };
    const userLogs = logs.filter(l => l.user_id === userId);
    const userBuckets = buckets?.filter(b => b.user_id === userId) ?? [];
    if (userBuckets.some(bucket => bucket.deadline && bucket.saving_rule_type)) {
      const result = calcPeriodAwareStreak(userBuckets, userLogs, today, frozenDates, transfers);
      return {
        streak: result.streak,
        hasLoggedToday: result.hasLoggedToday,
        unit: result.unit,
        trackable: result.trackable,
      };
    }
    const streak = calcStreakWithFreezes(userLogs, today, frozenDates);
    const hasLoggedToday = userLogs.some(l => localDateKey(l.created_at) === today);
    return { streak, hasLoggedToday, unit: 'day', trackable: true };
  }, [userId, logs, today, frozenDates, buckets, transfers]);
}
