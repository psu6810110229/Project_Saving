import type { BucketCategory, PaymentType, SavingRuleType } from '../types';
import { daysBetween, todayBangkokKey } from './savingPlan';
import { getPrimaryTipKey } from '../i18n/expenseTips';

/* ──────────────────────────────────────────────────────────────────────
 * Travel expense rule catalog
 * ──────────────────────────────────────────────────────────────────── */

export interface TravelExpenseRule {
  category: BucketCategory;
  nameEn: string;
  nameTh: string;
  /** How many months before the event this expense should be paid. 0 = on-trip. */
  monthsBeforeEvent: number;
  paymentType: PaymentType;
  /** Lower number = pay first. */
  priority: number;
  tipKey: string | null;
  /** Approximate share of a typical travel budget (sums to 1.0). */
  budgetPercent: number;
}

export const TRAVEL_EXPENSE_RULES: readonly TravelExpenseRule[] = [
  {
    category: 'flight',
    nameEn: 'Flights',
    nameTh: 'ตั๋วเครื่องบิน',
    monthsBeforeEvent: 4,
    paymentType: 'advance_booking',
    priority: 1,
    tipKey: getPrimaryTipKey('flight'),
    budgetPercent: 0.30,
  },
  {
    category: 'stay',
    nameEn: 'Accommodation',
    nameTh: 'ที่พัก',
    monthsBeforeEvent: 3,
    paymentType: 'advance_booking',
    priority: 2,
    tipKey: getPrimaryTipKey('stay'),
    budgetPercent: 0.25,
  },
  {
    category: 'activities',
    nameEn: 'Activities',
    nameTh: 'กิจกรรม',
    monthsBeforeEvent: 1,
    paymentType: 'pre_trip',
    priority: 3,
    tipKey: getPrimaryTipKey('activities'),
    budgetPercent: 0.10,
  },
  {
    category: 'transport',
    nameEn: 'Transport',
    nameTh: 'การเดินทาง',
    monthsBeforeEvent: 1,
    paymentType: 'pre_trip',
    priority: 4,
    tipKey: getPrimaryTipKey('transport'),
    budgetPercent: 0.10,
  },
  {
    category: 'food',
    nameEn: 'Food & Dining',
    nameTh: 'อาหาร',
    monthsBeforeEvent: 0,
    paymentType: 'on_trip',
    priority: 5,
    tipKey: getPrimaryTipKey('food'),
    budgetPercent: 0.12,
  },
  {
    category: 'shopping',
    nameEn: 'Shopping',
    nameTh: 'ช้อปปิ้ง',
    monthsBeforeEvent: 0,
    paymentType: 'on_trip',
    priority: 6,
    tipKey: getPrimaryTipKey('shopping'),
    budgetPercent: 0.05,
  },
  {
    category: 'buffer',
    nameEn: 'Emergency Buffer',
    nameTh: 'เงินสำรองฉุกเฉิน',
    monthsBeforeEvent: 0,
    paymentType: 'flexible',
    priority: 7,
    tipKey: getPrimaryTipKey('buffer'),
    budgetPercent: 0.08,
  },
] as const;

export function getTravelExpenseRule(category: BucketCategory): TravelExpenseRule | undefined {
  return TRAVEL_EXPENSE_RULES.find(r => r.category === category);
}

/* ──────────────────────────────────────────────────────────────────────
 * Deadline calculation
 * ──────────────────────────────────────────────────────────────────── */

function subMonths(dateKey: string, months: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  let targetMonth = m - months;
  let targetYear = y;
  while (targetMonth <= 0) {
    targetMonth += 12;
    targetYear -= 1;
  }
  const maxDay = new Date(targetYear, targetMonth, 0).getDate();
  const clampedDay = Math.min(d, maxDay);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function calcSuggestedDeadline(eventDate: string, category: BucketCategory): string {
  const rule = getTravelExpenseRule(category);
  if (!rule || rule.monthsBeforeEvent === 0) return eventDate;
  const deadline = subMonths(eventDate, rule.monthsBeforeEvent);
  return deadline < eventDate ? deadline : eventDate;
}

/* ──────────────────────────────────────────────────────────────────────
 * Rule suggestion
 * ──────────────────────────────────────────────────────────────────── */

function roundUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export interface SuggestedRule {
  ruleType: SavingRuleType;
  amount: number;
}

export function calcSuggestedRule(
  targetAmount: number,
  deadline: string,
  today?: string,
): SuggestedRule {
  const todayKey = today ?? todayBangkokKey();
  const remaining = daysBetween(todayKey, deadline);

  if (remaining <= 0 || targetAmount <= 0) {
    return { ruleType: 'flexible', amount: 0 };
  }

  const perDay = targetAmount / remaining;
  const perWeek = targetAmount / Math.max(1, remaining / 7);
  const perMonth = targetAmount / Math.max(1, remaining / 30);

  if (remaining > 180) {
    return { ruleType: 'fixed_monthly', amount: roundUp(perMonth, 100) };
  }
  if (remaining > 60) {
    if (perWeek >= 100) {
      return { ruleType: 'fixed_weekly', amount: roundUp(perWeek, 50) };
    }
    return { ruleType: 'fixed_monthly', amount: roundUp(perMonth, 100) };
  }
  if (perDay >= 20) {
    return { ruleType: 'fixed_daily', amount: roundUp(perDay, 5) };
  }
  if (perWeek >= 50) {
    return { ruleType: 'fixed_weekly', amount: roundUp(perWeek, 10) };
  }
  return { ruleType: 'fixed_monthly', amount: roundUp(perMonth, 100) };
}

/* ──────────────────────────────────────────────────────────────────────
 * Budget splitting
 * ──────────────────────────────────────────────────────────────────── */

export interface SuggestedExpense {
  category: BucketCategory;
  nameEn: string;
  nameTh: string;
  targetAmount: number;
  deadline: string;
  paymentType: PaymentType;
  priority: number;
  tipKey: string | null;
  suggestedRule: SuggestedRule;
}

export function suggestExpenses(
  totalBudget: number,
  eventDate: string,
  today?: string,
): SuggestedExpense[] {
  const todayKey = today ?? todayBangkokKey();
  return TRAVEL_EXPENSE_RULES.map(rule => {
    const targetAmount = roundUp(totalBudget * rule.budgetPercent, 100);
    const deadline = calcSuggestedDeadline(eventDate, rule.category);
    return {
      category: rule.category,
      nameEn: rule.nameEn,
      nameTh: rule.nameTh,
      targetAmount,
      deadline,
      paymentType: rule.paymentType,
      priority: rule.priority,
      tipKey: rule.tipKey,
      suggestedRule: calcSuggestedRule(targetAmount, deadline, todayKey),
    };
  });
}
