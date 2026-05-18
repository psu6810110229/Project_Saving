import { useEffect, useMemo, useState } from 'react';
import { calcStreakWithFreezes, localDateKey, APP_TZ } from '../lib/streak';
import type { SavingsLog } from '../types';

function todayKey() {
  return localDateKey(new Date().toISOString(), APP_TZ);
}

interface UseStreakResult {
  streak: number;
  hasLoggedToday: boolean;
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
    if (!userId) return { streak: 0, hasLoggedToday: false };
    const userLogs = logs.filter(l => l.user_id === userId);
    const streak = calcStreakWithFreezes(userLogs, today, frozenDates);
    const hasLoggedToday = userLogs.some(l => localDateKey(l.created_at) === today);
    return { streak, hasLoggedToday };
  }, [userId, logs, today, frozenDates]);
}
