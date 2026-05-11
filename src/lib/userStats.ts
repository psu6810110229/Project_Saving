import type { SavingsLog } from '../types';
import { calcStreak, localDateKey, APP_TZ } from './streak';

export function totalSaved(logs: SavingsLog[]): number {
  return logs.reduce((sum, l) => sum + l.amount, 0);
}

export function biggestSave(logs: SavingsLog[]): number {
  if (logs.length === 0) return 0;
  return Math.max(...logs.map(l => l.amount));
}

export function totalLogCount(logs: SavingsLog[]): number {
  return logs.length;
}

/**
 * Longest ever streak in days.
 * Walks all unique date keys backwards to find consecutive runs.
 * Documented limit: accurate up to ~500 logs; O(n) on unique days.
 */
export function longestStreak(logs: SavingsLog[]): number {
  if (logs.length === 0) return 0;

  const days = Array.from(
    new Set(logs.map(l => localDateKey(l.created_at, APP_TZ)))
  ).sort(); // ascending

  let longest = 1;
  let current = 1;

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + 'T00:00:00');
    const cur = new Date(days[i] + 'T00:00:00');
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }

  return longest;
}

export function currentStreak(logs: SavingsLog[], todayKey: string): number {
  return calcStreak(logs, todayKey);
}
