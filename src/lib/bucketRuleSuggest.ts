import type { Bucket, SavingRuleType } from '../types';
import { addDays } from './savingPlan';
import { addMonthsClamped, summarizeFixedScheduleInRange, type FixedScheduleRule } from './fixedSavingSchedule';

export type RuleChoice = 'fixed_daily' | 'fixed_weekly' | 'fixed_monthly' | 'flexible' | 'custom';
export type FixedRuleChoice = Exclude<RuleChoice, 'flexible' | 'custom'>;
export const MAX_SUGGESTED_DAILY_PACE = 250;

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

export interface FixedRuleSuggestion {
  amount: number;
  periods: number;
  total: number;
  dailyEquivalent: number;
  isHard: boolean;
}

export function describeFixedRuleSuggestion(
  targetAmount: number,
  startKey: string,
  endKey: string,
  rule: FixedRuleChoice,
  maxSuggestedDailyPace = MAX_SUGGESTED_DAILY_PACE,
): FixedRuleSuggestion {
  const { periods } = summarizeFixedScheduleInRange(
    startKey,
    endKey,
    rule as FixedScheduleRule,
  );
  const safePeriods = Math.max(1, periods);
  const amount = targetAmount > 0 ? Math.ceil(targetAmount / safePeriods) : 0;
  const dailyEquivalent = rule === 'fixed_daily'
    ? amount
    : rule === 'fixed_weekly'
      ? amount / 7
      : amount / 30;

  return {
    amount,
    periods: safePeriods,
    total: amount * safePeriods,
    dailyEquivalent,
    isHard: dailyEquivalent > maxSuggestedDailyPace,
  };
}
