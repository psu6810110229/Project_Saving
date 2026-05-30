import type { BucketCategory, PaymentType, SavingRuleType } from '../types';
import { addDays, daysBetween, todayBangkokKey } from './savingPlan';
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
    nameEn: 'Travel',
    nameTh: 'ค่าเดินทาง',
    monthsBeforeEvent: 4,
    paymentType: 'advance_booking',
    priority: 1,
    tipKey: getPrimaryTipKey('flight'),
    budgetPercent: 0.35,
  },
  {
    category: 'stay',
    nameEn: 'Accommodation',
    nameTh: 'ที่พัก',
    monthsBeforeEvent: 3,
    paymentType: 'advance_booking',
    priority: 2,
    tipKey: getPrimaryTipKey('stay'),
    budgetPercent: 0.30,
  },
  {
    category: 'activities',
    nameEn: 'Activities',
    nameTh: 'กิจกรรม',
    monthsBeforeEvent: 1,
    paymentType: 'pre_trip',
    priority: 3,
    tipKey: getPrimaryTipKey('activities'),
    budgetPercent: 0.15,
  },
  {
    category: 'food',
    nameEn: 'Food & Shopping',
    nameTh: 'อาหารและช็อปปิ้ง',
    monthsBeforeEvent: 0,
    paymentType: 'on_trip',
    priority: 4,
    tipKey: getPrimaryTipKey('food'),
    budgetPercent: 0.20,
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

export function calcSuggestedDeadline(
  eventDate: string,
  category: BucketCategory,
  today?: string,
): string {
  const rule = getTravelExpenseRule(category);
  if (!rule || rule.monthsBeforeEvent === 0) return eventDate;
  const todayKey = today ?? todayBangkokKey();
  const deadline = subMonths(eventDate, rule.monthsBeforeEvent);
  // Never suggest a deadline today or in the past: if the lead time lands on/
  // before today (event sooner than the lead time), fall back to a near-future
  // date, never past the event itself.
  if (deadline <= todayKey) {
    const fallback = addDays(todayKey, 7);
    return fallback < eventDate ? fallback : eventDate;
  }
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
 * Sequential cascade schedule
 *
 * Real saving is sequential, not parallel: a room funds its highest-priority
 * bucket first (flight), then the next, and so on. Spreading one sustainable
 * rate across the whole runway keeps every bucket's daily amount even and
 * affordable, instead of cramming the nearest deadline into a tiny window
 * (which produced impossible per-day rates like ฿443/day).
 *
 * DAILY_RATE_CAP is an internal affordability ceiling — never shown to the
 * user, only used in the math. The suggested plan must not imply more than this
 * per day, matching the real income of the target audience (Thai students /
 * middle class). It only bites when the goal is too large for the time given.
 * ──────────────────────────────────────────────────────────────────── */

export const DAILY_RATE_CAP = 200;

export interface CascadeInput {
  id: string;
  targetAmount: number;
  priority: number;
}

export interface CascadeLeg {
  id: string;
  /** When saving toward this bucket begins (the previous bucket's deadline). */
  startDate: string;
  /** When this bucket is funded, in priority order. */
  deadline: string;
  /** Rate suggested over this bucket's own funding window (not the whole runway). */
  suggestedRule: SuggestedRule;
}

export interface CascadeSchedule {
  legs: CascadeLeg[];
  /** True when the even rate already exceeds the daily cap — the goal is too
   *  large for the timeframe to stay affordable. */
  overCap: boolean;
}

export function cascadeExpenseSchedule(
  items: CascadeInput[],
  eventDate: string,
  today?: string,
): CascadeSchedule {
  const todayKey = today ?? todayBangkokKey();
  const totalDays = Math.max(1, daysBetween(todayKey, eventDate));
  const total = items.reduce((sum, it) => sum + Math.max(0, it.targetAmount), 0);
  const baseRate = total > 0 ? total / totalDays : 0;
  const overCap = baseRate > DAILY_RATE_CAP;
  const effectiveRate = overCap ? DAILY_RATE_CAP : baseRate;

  const ordered = [...items].sort((a, b) => a.priority - b.priority);
  const legs: CascadeLeg[] = [];
  let cumulative = 0;
  let prevDeadline = todayKey;

  for (const it of ordered) {
    const amount = Math.max(0, it.targetAmount);
    cumulative += amount;

    let deadline: string;
    if (effectiveRate <= 0) {
      deadline = eventDate;
    } else {
      deadline = addDays(todayKey, Math.ceil(cumulative / effectiveRate));
      if (deadline > eventDate) deadline = eventDate;
    }

    // Saving toward this bucket starts when the previous one is funded, but
    // never before today and never after this bucket's own deadline.
    const startDate = prevDeadline > todayKey && prevDeadline < deadline ? prevDeadline : todayKey;
    legs.push({
      id: it.id,
      startDate,
      deadline,
      suggestedRule: calcSuggestedRule(amount, deadline, startDate),
    });
    prevDeadline = deadline;
  }

  return { legs, overCap };
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
    const deadline = calcSuggestedDeadline(eventDate, rule.category, todayKey);
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

/**
 * Split a total budget across the catalog categories so the per-category
 * amounts sum **exactly** to the budget. Each share is rounded to the nearest
 * ฿100 and any leftover is absorbed by the largest-share category, so the
 * auto-split never overshoots the budget (which would otherwise trip the
 * wizard's "budget < expenses" guard for odd/small budgets).
 */
export function splitBudget(totalBudget: number): Partial<Record<BucketCategory, number>> {
  const rules = TRAVEL_EXPENSE_RULES;
  const rounded = rules.map(r => Math.round((totalBudget * r.budgetPercent) / 100) * 100);
  const diff = totalBudget - rounded.reduce((sum, amount) => sum + amount, 0);
  let largestIdx = 0;
  rules.forEach((r, i) => {
    if (r.budgetPercent > rules[largestIdx].budgetPercent) largestIdx = i;
  });
  rounded[largestIdx] = rounded[largestIdx] + diff;
  const out: Partial<Record<BucketCategory, number>> = {};
  rules.forEach((r, i) => {
    out[r.category] = Math.max(0, rounded[i]);
  });
  return out;
}
