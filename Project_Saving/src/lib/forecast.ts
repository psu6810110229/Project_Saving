import type { Goal } from '../types';

export const TRIP_DATE = '2027-11-01';

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export function tripCountdown(today: Date): number {
  const trip = new Date(TRIP_DATE + 'T00:00:00');
  return Math.max(0, daysBetween(today, trip));
}

export function dailyRequired(goal: Goal, savedSoFar: number, today: Date): number {
  const end = new Date(goal.end_date + 'T00:00:00');
  const daysRemaining = Math.max(1, daysBetween(today, end));
  const remaining = goal.target_amount - savedSoFar;
  return remaining <= 0 ? 0 : remaining / daysRemaining;
}

export function predictedCompletion(
  goal: Goal,
  savedSoFar: number,
  daysElapsed: number,
): Date | null {
  if (daysElapsed <= 0 || savedSoFar <= 0) return null;
  const velocity = savedSoFar / daysElapsed;
  const remaining = goal.target_amount - savedSoFar;
  if (remaining <= 0) return new Date();
  const daysNeeded = Math.ceil(remaining / velocity);
  const result = new Date();
  result.setDate(result.getDate() + daysNeeded);
  return result;
}
