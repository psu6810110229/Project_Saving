import type { Bucket, SavingRuleType } from '../types';
import { addDays } from './savingPlan';

export type RuleChoice = 'fixed_daily' | 'fixed_weekly' | 'fixed_monthly' | 'flexible' | 'custom';
export type FixedRuleChoice = Exclude<RuleChoice, 'flexible' | 'custom'>;

export const CATEGORY_MONTH_OFFSETS: Record<string, number> = {
  flight: -6,
  stay: -3,
  activities: -2,
  transport: -1,
  food: 0,
  shopping: 0,
  buffer: 0,
  home: 0,
  other: 0,
};

export function addMonthsClamped(dateKey: string, offsetMonths: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const targetMonthIndex = month - 1 + offsetMonths;
  const firstOfTarget = new Date(Date.UTC(year, targetMonthIndex, 1));
  const targetYear = firstOfTarget.getUTCFullYear();
  const targetMonth = firstOfTarget.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  const mm = String(targetMonth + 1).padStart(2, '0');
  const dd = String(clampedDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

export function calcDefaultDeadline(bucket: Bucket, roomEndDate: string | null, today: string): string {
  const roomEnd = roomEndDate?.slice(0, 10);
  if (!roomEnd) return addDays(today, 30);
  const offset = CATEGORY_MONTH_OFFSETS[bucket.category ?? 'other'] ?? 0;
  const suggested = addMonthsClamped(roomEnd, offset);
  return suggested > today ? suggested : addDays(today, 7);
}

export function recommendedRule(remainingDays: number): RuleChoice {
  if (remainingDays <= 90) return 'fixed_daily';
  if (remainingDays <= 365) return 'fixed_weekly';
  return 'fixed_monthly';
}

export function initialRuleChoice(ruleType: SavingRuleType | null | undefined, remainingDays: number): RuleChoice {
  if (
    ruleType === 'fixed_daily'
    || ruleType === 'fixed_weekly'
    || ruleType === 'fixed_monthly'
    || ruleType === 'flexible'
  ) {
    return ruleType;
  }
  if (ruleType === 'increasing_daily' || ruleType === 'increasing_daily_capped') {
    return 'custom';
  }
  return recommendedRule(remainingDays);
}

export function calcRuleAmount(targetAmount: number, remainingDays: number, rule: FixedRuleChoice): number {
  if (remainingDays <= 0) return targetAmount;
  switch (rule) {
    case 'fixed_daily':
      return Math.ceil(targetAmount / remainingDays);
    case 'fixed_weekly':
      return Math.ceil(targetAmount / Math.max(1, Math.ceil(remainingDays / 7)));
    case 'fixed_monthly':
      return Math.ceil(targetAmount / Math.max(1, Math.ceil(remainingDays / 30)));
  }
}
