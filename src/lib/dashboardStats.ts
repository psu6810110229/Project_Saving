import type { SavingsLog } from '../types';

export function fallbackInitial(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

export function lastSevenDayLabels(today = new Date()): string[] {
  return lastSevenDateKeys(today).map(dateKey => {
    const date = new Date(`${dateKey}T00:00:00`);
    return date.toLocaleDateString('en-US', { weekday: 'narrow' });
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
