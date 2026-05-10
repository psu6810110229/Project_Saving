import type { SavingsLog } from '../types';
import { localDateKey, calcStreak, APP_TZ } from './streak';
import { predictedCompletion } from './forecast';

export interface DailyTotal {
  date: string;   // YYYY-MM-DD in APP_TZ
  total: number;
}

export interface ComparisonSummary {
  saved: number;
  startedAt: string | null;    // earliest log date YYYY-MM-DD, or null
  currentStreak: number;
  longestStreak: number;
  biggestSave: number;
  logCount: number;
  predictedEnd: string | null; // human-readable e.g. "Oct '27", or null
}

// ---------- helpers ----------

function addDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function dateDiffDays(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00').getTime();
  const b = new Date(to + 'T00:00:00').getTime();
  return Math.round((b - a) / 86_400_000);
}

// ---------- public API ----------

/**
 * Builds a daily cumulative series from `fromDate` to `toDate` inclusive.
 * Days with no logs carry the previous running total forward (flat-line).
 */
export function cumulativeSeries(
  logs: SavingsLog[],
  fromDate: string,
  toDate: string,
): DailyTotal[] {
  if (fromDate > toDate) return [];

  // Build a per-day amount map
  const daily = new Map<string, number>();
  for (const log of logs) {
    const key = localDateKey(log.created_at, APP_TZ);
    daily.set(key, (daily.get(key) ?? 0) + log.amount);
  }

  const result: DailyTotal[] = [];
  let running = 0;
  const totalDays = dateDiffDays(fromDate, toDate);

  for (let i = 0; i <= totalDays; i++) {
    const date = addDays(fromDate, i);
    running += daily.get(date) ?? 0;
    result.push({ date, total: running });
  }

  return result;
}

/**
 * Computes longest streak over all logs (walks sorted unique day-keys).
 */
function computeLongestStreak(logs: SavingsLog[]): number {
  if (logs.length === 0) return 0;
  const days = Array.from(new Set(logs.map(l => localDateKey(l.created_at, APP_TZ)))).sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = dateDiffDays(days[i - 1], days[i]);
    if (diff === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

/**
 * Formats a Date as short month + year, e.g. "Oct '27".
 */
function formatMonthYear(d: Date): string {
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = String(d.getFullYear()).slice(2);
  return `${month} '${year}`;
}

/**
 * Derives all comparison stats for one player's logs.
 */
export function compareSummary(
  logs: SavingsLog[],
  todayKey: string,
  target: number | null,
): ComparisonSummary {
  const saved = logs.reduce((s, l) => s + l.amount, 0);

  const sortedDates = logs
    .map(l => localDateKey(l.created_at, APP_TZ))
    .sort();
  const startedAt = sortedDates[0] ?? null;

  const currentStreak = calcStreak(logs, todayKey);
  const longestStreak = computeLongestStreak(logs);
  const biggestSave = logs.length > 0 ? Math.max(...logs.map(l => l.amount)) : 0;
  const logCount = logs.length;

  // Predicted end — needs target + velocity
  let predictedEnd: string | null = null;
  if (target && target > 0 && startedAt) {
    const daysElapsed = dateDiffDays(startedAt, todayKey);
    // Build a minimal Goal-shaped object for the reused helper
    const fakeGoal = {
      user_id: '',
      target_amount: target,
      start_date: startedAt,
      end_date: addDays(todayKey, 365 * 10), // far-future sentinel
      updated_at: '',
    };
    const completion = predictedCompletion(fakeGoal, saved, daysElapsed);
    if (completion) predictedEnd = formatMonthYear(completion);
  }

  return { saved, startedAt, currentStreak, longestStreak, biggestSave, logCount, predictedEnd };
}
