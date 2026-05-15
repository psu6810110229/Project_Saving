import type { SavingsLog } from '../types';
import { localDateKey } from './streak';
import { addDays, todayBangkokKey } from './savingPlan';

export function fallbackInitial(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

export function lastSevenDayLabels(today = new Date(), locale = 'en-US'): string[] {
  return lastSevenDateKeys(today).map(dateKey => {
    const date = new Date(`${dateKey}T00:00:00`);
    return date.toLocaleDateString(locale, { weekday: 'narrow' });
  });
}

export function dailyAmountSeries(logs: SavingsLog[], userId?: string, today = new Date()): number[] {
  const keys = lastSevenDateKeys(today);
  return keys.map(key => logs
    .filter(log => (!userId || log.user_id === userId) && localDateKey(log.created_at) === key)
    .reduce((sum, log) => sum + log.amount, 0));
}

export function cumulativeAmountSeries(logs: SavingsLog[], userId?: string, pending = 0, today = new Date()): number[] {
  let running = 0;
  const daily = dailyAmountSeries(logs, userId, today);
  return daily.map((amount, index) => {
    running += amount;
    return index === daily.length - 1 ? running + pending : running;
  });
}

export function weeklyTrendPct(logs: SavingsLog[], today = new Date()): number {
  const current = sumBetween(logs, daysAgo(today, 6), today);
  const previous = sumBetween(logs, daysAgo(today, 13), daysAgo(today, 7));
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function sumBetween(logs: SavingsLog[], start: Date, end: Date): number {
  const startTime = startOfDay(start).getTime();
  const endTime = endOfDay(end).getTime();
  return logs
    .filter(log => {
      const time = new Date(log.created_at).getTime();
      return time >= startTime && time <= endTime;
    })
    .reduce((sum, log) => sum + log.amount, 0);
}

/**
 * YYYY-MM-DD keys for the 7-day chart window, oldest → newest.
 * Used by the daily / cumulative series and any aligned overlays
 * (e.g. Saving Plan Expected Progress) so the bars and reference
 * line share an x-axis. Keys are Asia/Bangkok-local so they line up
 * with Saving Plan day boundaries.
 */
export function lastSevenDateKeys(today: Date = new Date()): string[] {
  const todayKey = todayBangkokKey(today);
  return Array.from({ length: 7 }, (_, index) => addDays(todayKey, index - 6));
}

function daysAgo(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}
