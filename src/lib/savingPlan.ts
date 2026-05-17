import { APP_TZ } from './streak';
import type { SavingPlanPause, SavingPlanRevision, SavingPlanRuleType } from '../types';

/**
 * Pure calculation helpers for Task 22.1 Saving Plan / Progress
 * Insights. All date logic uses `Asia/Bangkok` (`APP_TZ`) day keys
 * to match the rest of the app; UTC slicing is never used for plan
 * day boundaries.
 *
 * Plan progress is intentionally computed from Recorded Deposits
 * (positive savings_logs only). Reconcile balance_adjustments are
 * NOT included — Verified Balance stays a separate signal.
 */

// ── Bangkok date primitives ───────────────────────────────────

/** Today's Bangkok-local YYYY-MM-DD key. */
export function todayBangkokKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

/** Add `n` whole days to a YYYY-MM-DD key (can be negative). */
export function addDays(dateKey: string, n: number): string {
  const { y, m, d } = parseKey(dateKey);
  const ms = Date.UTC(y, m - 1, d) + n * 86_400_000;
  const date = new Date(ms);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Inclusive day count between two day keys (`end - start + 1`). */
export function daysInclusive(startKey: string, endKey: string): number {
  if (endKey < startKey) return 0;
  const a = parseKey(startKey);
  const b = parseKey(endKey);
  const diff = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(diff / 86_400_000) + 1;
}

/** Signed day count `end - start` (0 when same day). */
export function daysBetween(startKey: string, endKey: string): number {
  const a = parseKey(startKey);
  const b = parseKey(endKey);
  const diff = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(diff / 86_400_000);
}

/** ISO week boundaries (Mon..Sun) containing the given key. */
function weekBoundaries(dateKey: string): { start: string; end: string } {
  const { y, m, d } = parseKey(dateKey);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay(); // 0=Sun..6=Sat
  const isoDow = dow === 0 ? 7 : dow;
  const start = addDays(dateKey, 1 - isoDow);
  const end = addDays(start, 6);
  return { start, end };
}

// ── Pause helpers ─────────────────────────────────────────────

/**
 * True when `dateKey` falls inside any pause interval.
 * Pause covers Bangkok dates [paused_from, resumed_from).
 */
export function isPausedOnDate(pauses: SavingPlanPause[], dateKey: string): boolean {
  return pauses.some(
    p =>
      dateKey >= p.paused_from &&
      (p.resumed_from === null || dateKey < p.resumed_from),
  );
}

/**
 * Number of paused days whose Bangkok dates fall within [startKey, endKey].
 * Used to keep the increasing_daily active-day index accurate.
 */
function pausedDaysInRange(
  pauses: SavingPlanPause[],
  startKey: string,
  endKey: string,
): number {
  if (pauses.length === 0 || endKey < startKey) return 0;
  let count = 0;
  for (const p of pauses) {
    const overlapStart = p.paused_from > startKey ? p.paused_from : startKey;
    const pauseEndInclusive =
      p.resumed_from != null ? addDays(p.resumed_from, -1) : endKey;
    const overlapEnd =
      pauseEndInclusive < endKey ? pauseEndInclusive : endKey;
    if (overlapEnd >= overlapStart) {
      count += daysInclusive(overlapStart, overlapEnd);
    }
  }
  return count;
}

/** Calendar-month boundaries containing the given key. */
function monthBoundaries(dateKey: string): { start: string; end: string } {
  const { y, m } = parseKey(dateKey);
  const startD = new Date(Date.UTC(y, m - 1, 1));
  const endD = new Date(Date.UTC(y, m, 0));
  const mm = String(m).padStart(2, '0');
  const startKey = `${y}-${mm}-01`;
  const endKey = `${y}-${mm}-${String(endD.getUTCDate()).padStart(2, '0')}`;
  void startD;
  return { start: startKey, end: endKey };
}

// ── Revision selection ────────────────────────────────────────

/** The revision active on `dateKey` (latest whose effective_from <= date). */
export function activeRevisionAt(
  revisions: SavingPlanRevision[],
  dateKey: string,
): SavingPlanRevision | null {
  const sorted = [...revisions].sort((a, b) => {
    const dateCmp = b.effective_from_date.localeCompare(a.effective_from_date);
    if (dateCmp !== 0) return dateCmp;
    return b.created_at.localeCompare(a.created_at);
  });
  for (const rev of sorted) {
    if (dateKey >= rev.effective_from_date) return rev;
  }
  return null;
}

/**
 * Earliest revision whose effective_from_date is strictly after
 * `dateKey`. Returns null when no future revision exists.
 *
 * HOTFIX-004: used as a fallback when `activeRevisionAt` returns null
 * for future-start plans so the Dashboard and SavingPlan page can
 * still reference a plan that hasn't started yet.
 */
export function nextUpcomingRevision(
  revisions: SavingPlanRevision[],
  dateKey: string,
): SavingPlanRevision | null {
  const future = revisions
    .filter(r => r.effective_from_date > dateKey)
    .sort((a, b) => {
      const dateCmp = a.effective_from_date.localeCompare(b.effective_from_date);
      if (dateCmp !== 0) return dateCmp;
      return a.created_at.localeCompare(b.created_at);
    });
  return future[0] ?? null;
}

/**
 * Daily planned amount IGNORING any stop (end_date, day_count,
 * target reach). Used to drive the target-reach search without
 * recursing through revisionEndKey.
 *
 * When `pauses` is provided, paused days return 0 and the
 * increasing-daily active-day index is adjusted to exclude them.
 */
function rawDailyForRevision(
  rev: SavingPlanRevision,
  dateKey: string,
  pauses: SavingPlanPause[] = [],
): number {
  if (dateKey < rev.effective_from_date) return 0;
  if (pauses.length > 0 && isPausedOnDate(pauses, dateKey)) return 0;
  switch (rev.rule_type) {
    case 'fixed_daily': {
      return Number(rev.amount ?? 0);
    }
    case 'fixed_weekly': {
      const { start, end } = weekBoundaries(dateKey);
      const winStart = start < rev.effective_from_date ? rev.effective_from_date : start;
      const winEnd = end;
      if (winEnd < winStart) return 0;
      const activeDays = daysInclusive(winStart, winEnd);
      if (activeDays <= 0) return 0;
      return Number(rev.amount ?? 0) / activeDays;
    }
    case 'fixed_monthly': {
      const { start, end } = monthBoundaries(dateKey);
      const winStart = start < rev.effective_from_date ? rev.effective_from_date : start;
      const winEnd = end;
      if (winEnd < winStart) return 0;
      const activeDays = daysInclusive(winStart, winEnd);
      if (activeDays <= 0) return 0;
      return Number(rev.amount ?? 0) / activeDays;
    }
    case 'increasing_daily': {
      const totalDays = daysInclusive(rev.effective_from_date, dateKey);
      const pausedDays = pausedDaysInRange(pauses, rev.effective_from_date, dateKey);
      const idx = totalDays - pausedDays;
      const startA = Number(rev.start_amount ?? 0);
      const inc = Number(rev.increment_amount ?? 0);
      return startA + (idx - 1) * inc;
    }
    case 'increasing_daily_capped': {
      const totalDays = daysInclusive(rev.effective_from_date, dateKey);
      const pausedDays = pausedDaysInRange(pauses, rev.effective_from_date, dateKey);
      const idx = totalDays - pausedDays;
      const startA = Number(rev.start_amount ?? 0);
      const inc = Number(rev.increment_amount ?? 0);
      const cap = Number(rev.cap_amount ?? Infinity);
      const raw = startA + (idx - 1) * inc;
      return raw > cap ? cap : raw;
    }
    default:
      return 0;
  }
}

const TARGET_REACH_CACHE = new WeakMap<SavingPlanRevision, { value: string | null }>();
const TARGET_REACH_HORIZON = 10000;

/**
 * First Bangkok date on which the revision's raw planned curve
 * accumulates to `target_amount` from `effective_from_date`. Returns
 * null when the target is unreachable within the search horizon or
 * the revision has no positive target.
 *
 * Result is cached per revision object when no pauses are present.
 * With pauses the cache is bypassed so paused days are skipped.
 */
function targetReachDateKey(
  rev: SavingPlanRevision,
  pauses: SavingPlanPause[] = [],
): string | null {
  if (pauses.length === 0) {
    const cached = TARGET_REACH_CACHE.get(rev);
    if (cached) return cached.value;
  }

  const target = Number(rev.target_amount ?? 0);
  if (!Number.isFinite(target) || target <= 0) {
    if (pauses.length === 0) TARGET_REACH_CACHE.set(rev, { value: null });
    return null;
  }

  let cumul = 0;
  let cursor = rev.effective_from_date;
  let found: string | null = null;
  for (let i = 0; i < TARGET_REACH_HORIZON; i++) {
    const daily = rawDailyForRevision(rev, cursor, pauses);
    if (daily > 0) {
      cumul += daily;
      if (cumul + 0.005 >= target) {
        found = cursor;
        break;
      }
    }
    cursor = addDays(cursor, 1);
  }
  if (pauses.length === 0) TARGET_REACH_CACHE.set(rev, { value: found });
  return found;
}

function revisionEndKey(
  rev: SavingPlanRevision,
  pauses: SavingPlanPause[] = [],
): string | null {
  let endKey: string | null = rev.end_date;
  if (rev.day_count && rev.day_count > 0) {
    const dayCountEnd = addDays(rev.effective_from_date, rev.day_count - 1);
    if (!endKey || dayCountEnd < endKey) endKey = dayCountEnd;
  }
  // When no explicit stop (no end_date, no day_count), the plan's
  // target_amount acts as the implicit stop: once the planned curve
  // would accumulate to target, daily amounts go to 0 so expected
  // cumulative can't push past the target and mark a user "behind"
  // after they've already reached it.
  if (endKey === null) {
    const targetReach = targetReachDateKey(rev, pauses);
    if (targetReach) endKey = targetReach;
  }
  return endKey;
}

/** Daily planned amount for a single revision on a Bangkok date. */
function revisionDailyAmount(
  rev: SavingPlanRevision,
  dateKey: string,
  pauses: SavingPlanPause[] = [],
): number {
  if (dateKey < rev.effective_from_date) return 0;
  if (pauses.length > 0 && isPausedOnDate(pauses, dateKey)) return 0;
  const endKey = revisionEndKey(rev, pauses);
  if (endKey && dateKey > endKey) return 0;

  switch (rev.rule_type) {
    case 'fixed_daily': {
      return Number(rev.amount ?? 0);
    }
    case 'fixed_weekly': {
      const { start, end } = weekBoundaries(dateKey);
      const winStart = start < rev.effective_from_date ? rev.effective_from_date : start;
      const winEnd = endKey && end > endKey ? endKey : end;
      if (winEnd < winStart) return 0;
      const activeDays = daysInclusive(winStart, winEnd);
      if (activeDays <= 0) return 0;
      return Number(rev.amount ?? 0) / activeDays;
    }
    case 'fixed_monthly': {
      const { start, end } = monthBoundaries(dateKey);
      const winStart = start < rev.effective_from_date ? rev.effective_from_date : start;
      const winEnd = endKey && end > endKey ? endKey : end;
      if (winEnd < winStart) return 0;
      const activeDays = daysInclusive(winStart, winEnd);
      if (activeDays <= 0) return 0;
      return Number(rev.amount ?? 0) / activeDays;
    }
    case 'increasing_daily': {
      const totalDays = daysInclusive(rev.effective_from_date, dateKey);
      const pausedDays = pausedDaysInRange(pauses, rev.effective_from_date, dateKey);
      const idx = totalDays - pausedDays;
      const startA = Number(rev.start_amount ?? 0);
      const inc = Number(rev.increment_amount ?? 0);
      return startA + (idx - 1) * inc;
    }
    case 'increasing_daily_capped': {
      const totalDays = daysInclusive(rev.effective_from_date, dateKey);
      const pausedDays = pausedDaysInRange(pauses, rev.effective_from_date, dateKey);
      const idx = totalDays - pausedDays;
      const startA = Number(rev.start_amount ?? 0);
      const inc = Number(rev.increment_amount ?? 0);
      const cap = Number(rev.cap_amount ?? Infinity);
      const raw = startA + (idx - 1) * inc;
      return raw > cap ? cap : raw;
    }
    default:
      return 0;
  }
}

/** Daily planned amount considering all revisions (0 before plan start). */
export function plannedAmountForDate(
  revisions: SavingPlanRevision[],
  dateKey: string,
  pauses: SavingPlanPause[] = [],
): number {
  const rev = activeRevisionAt(revisions, dateKey);
  if (!rev) return 0;
  return revisionDailyAmount(rev, dateKey, pauses);
}

/** Cumulative planned amount from first effective date through `asOfDateKey`. */
export function plannedCumulativeThroughDate(
  revisions: SavingPlanRevision[],
  asOfDateKey: string,
  cap = 4000,
  pauses: SavingPlanPause[] = [],
): number {
  if (revisions.length === 0) return 0;
  const sortedAsc = [...revisions].sort((a, b) => {
    const dateCmp = a.effective_from_date.localeCompare(b.effective_from_date);
    if (dateCmp !== 0) return dateCmp;
    return a.created_at.localeCompare(b.created_at);
  });
  const firstStart = sortedAsc[0].effective_from_date;
  if (asOfDateKey < firstStart) return 0;
  let total = 0;
  let cursor = firstStart;
  for (let i = 0; i < cap; i++) {
    if (cursor > asOfDateKey) break;
    total += plannedAmountForDate(revisions, cursor, pauses);
    cursor = addDays(cursor, 1);
  }
  // In target-reach mode (no day_count, no end_date on the active
  // revision), the planned curve overshoots target by at most one
  // day's amount on the target-reach day itself. Clamp so the
  // headline expected cumulative never exceeds the plan's target.
  const active = activeRevisionAt(revisions, asOfDateKey);
  if (active && !active.end_date && (active.day_count == null || active.day_count <= 0)) {
    const target = Number(active.target_amount ?? 0);
    if (Number.isFinite(target) && target > 0 && total > target) {
      total = target;
    }
  }
  return total;
}

// ── Money status ──────────────────────────────────────────────

export type MoneyState = 'ahead' | 'behind' | 'on_track' | 'not_started';

export interface MoneyStatus {
  state: MoneyState;
  expectedToday: number;
  expectedCumulative: number;
  recordedDeposits: number;
  /** recordedDeposits - expectedCumulative. Positive = ahead. */
  delta: number;
  /** Plan target snapshot from the currently active revision. */
  targetAmount: number;
  /** Recorded toward target (clamped to >= 0). */
  remaining: number;
  /** Last future date covered when ahead (else null). */
  coveredUntilDate: string | null;
  /** Number of future days covered when ahead (0 otherwise). */
  coveredDays: number;
}

const MONEY_EPSILON = 0.005;

export function moneyStatusFor(
  revisions: SavingPlanRevision[],
  recordedDeposits: number,
  todayKey: string,
  pauses: SavingPlanPause[] = [],
): MoneyStatus {
  const active = activeRevisionAt(revisions, todayKey);
  const sortedAsc = [...revisions].sort((a, b) => {
    const dateCmp = a.effective_from_date.localeCompare(b.effective_from_date);
    if (dateCmp !== 0) return dateCmp;
    return a.created_at.localeCompare(b.created_at);
  });
  const firstStart = sortedAsc[0]?.effective_from_date ?? null;

  const target = Number(active?.target_amount ?? sortedAsc[0]?.target_amount ?? 0);
  const expectedToday = plannedAmountForDate(revisions, todayKey, pauses);
  const expectedCumulative = plannedCumulativeThroughDate(revisions, todayKey, 4000, pauses);
  const delta = recordedDeposits - expectedCumulative;

  let state: MoneyState;
  if (!firstStart || todayKey < firstStart) {
    state = 'not_started';
  } else if (Math.abs(delta) < MONEY_EPSILON) {
    state = 'on_track';
  } else {
    state = delta > 0 ? 'ahead' : 'behind';
  }

  let coveredUntilDate: string | null = null;
  let coveredDays = 0;
  if (state === 'ahead') {
    let cumul = expectedCumulative;
    let cursor = todayKey;
    let lastCoveredKey: string | null = null;
    for (let i = 0; i < 1825; i++) {
      const next = addDays(cursor, 1);
      const nextAmt = plannedAmountForDate(revisions, next, pauses);
      if (nextAmt <= 0) {
        if (pauses.length > 0 && isPausedOnDate(pauses, next)) {
          cursor = next; // advance past paused day without counting
          continue;
        }
        const revAtNext = activeRevisionAt(revisions, next);
        const end = revAtNext ? revisionEndKey(revAtNext, pauses) : null;
        if (!revAtNext || (end && next > end)) break;
        cursor = next;
        continue;
      }
      if (cumul + nextAmt > recordedDeposits + MONEY_EPSILON) break;
      cumul += nextAmt;
      cursor = next;
      coveredDays++;
      lastCoveredKey = cursor;
    }
    coveredUntilDate = lastCoveredKey;
  }

  const remaining = Math.max(0, target - recordedDeposits);

  return {
    state,
    expectedToday,
    expectedCumulative,
    recordedDeposits,
    delta,
    targetAmount: target,
    remaining,
    coveredUntilDate,
    coveredDays,
  };
}

// ── Projected completion ──────────────────────────────────────

/**
 * First future Bangkok date where the recorded total plus planned
 * future amounts reach target. Returns `today` if already met,
 * `null` if the plan can't reach target within the horizon.
 */
export function projectedCompletionDate(
  revisions: SavingPlanRevision[],
  recordedDeposits: number,
  todayKey: string,
  horizonDays = 3650,
  pauses: SavingPlanPause[] = [],
): string | null {
  if (revisions.length === 0) return null;
  // Pick the target from the active revision at `todayKey`. When
  // `todayKey` precedes every revision (preview projection from
  // before the plan starts), fall back to the earliest revision
  // so we still resolve a valid target and don't short-circuit
  // with a 0 target.
  const sortedAsc = [...revisions].sort((a, b) => {
    const dateCmp = a.effective_from_date.localeCompare(b.effective_from_date);
    if (dateCmp !== 0) return dateCmp;
    return a.created_at.localeCompare(b.created_at);
  });
  const targetSource = activeRevisionAt(revisions, todayKey) ?? sortedAsc[0];
  const target = Number(targetSource.target_amount ?? 0);
  if (!Number.isFinite(target) || target <= 0) return null;
  if (recordedDeposits + MONEY_EPSILON >= target) return todayKey;

  let cumul = recordedDeposits;
  let cursor = todayKey;
  for (let i = 0; i < horizonDays; i++) {
    cursor = addDays(cursor, 1);
    const amt = plannedAmountForDate(revisions, cursor, pauses);
    if (amt <= 0) {
      const revAt = activeRevisionAt(revisions, cursor);
      // Before the first revision starts the walk hasn't entered
      // the plan yet — keep advancing instead of bailing.
      if (!revAt && cursor < sortedAsc[0].effective_from_date) continue;
      const end = revAt ? revisionEndKey(revAt, pauses) : null;
      if (!revAt || (end && cursor > end)) return null;
      continue;
    }
    cumul += amt;
    if (cumul + MONEY_EPSILON >= target) return cursor;
  }
  return null;
}

// ── Habit status ──────────────────────────────────────────────

export type HabitState =
  | 'no_deposits_yet'
  | 'active'
  | 'at_risk'
  | 'stale'
  | 'plan_paused';

export interface HabitStatus {
  state: HabitState;
  lastDepositDateKey: string | null;
  daysSinceLastDeposit: number | null;
  hasDepositedToday: boolean;
  streak: number;
}

function streakFromDayKeys(depositDayKeys: string[], todayKey: string): number {
  const days = new Set(depositDayKeys.filter(k => k <= todayKey));
  if (days.size === 0) return 0;
  let cursor = todayKey;
  if (!days.has(cursor)) {
    cursor = addDays(cursor, -1);
    if (!days.has(cursor)) return 0;
  }
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/**
 * Deposit-only habit status. Plan cadence widens the windows so
 * weekly/monthly plans don't immediately flip to "at risk" after
 * one day without a deposit.
 *
 * Pass `isPaused = true` when today is a paused day; the state will
 * be 'plan_paused' instead of 'stale' or 'at_risk'.
 */
export function habitStatusFromDeposits(
  ruleType: SavingPlanRuleType | null,
  depositDayKeys: string[],
  todayKey: string,
  isPaused = false,
): HabitStatus {
  if (depositDayKeys.length === 0) {
    return {
      state: isPaused ? 'plan_paused' : 'no_deposits_yet',
      lastDepositDateKey: null,
      daysSinceLastDeposit: null,
      hasDepositedToday: false,
      streak: 0,
    };
  }
  const sorted = [...depositDayKeys].sort();
  const lastKey = sorted[sorted.length - 1];
  const since = Math.max(0, daysBetween(lastKey, todayKey));
  const hasToday = lastKey === todayKey;
  const streak = streakFromDayKeys(depositDayKeys, todayKey);

  let state: HabitState;
  if (isPaused) {
    state = 'plan_paused';
  } else if (ruleType === 'fixed_weekly') {
    state = since <= 6 ? 'active' : since <= 9 ? 'at_risk' : 'stale';
  } else if (ruleType === 'fixed_monthly') {
    state = since <= 30 ? 'active' : since <= 37 ? 'at_risk' : 'stale';
  } else {
    state = since === 0 ? 'active' : since === 1 ? 'at_risk' : 'stale';
  }

  return {
    state,
    lastDepositDateKey: lastKey,
    daysSinceLastDeposit: since,
    hasDepositedToday: hasToday,
    streak,
  };
}

// ── Display helpers ───────────────────────────────────────────

export const RULE_TYPE_LABEL: Record<SavingPlanRuleType, string> = {
  fixed_daily: 'Fixed daily',
  fixed_weekly: 'Fixed weekly',
  fixed_monthly: 'Fixed monthly',
  increasing_daily: 'Increasing daily',
  increasing_daily_capped: 'Increasing daily (capped)',
};

export const MONEY_STATE_LABEL: Record<MoneyState, string> = {
  ahead: 'Ahead',
  behind: 'Behind',
  on_track: 'On track',
  not_started: 'Not started',
};

export const HABIT_STATE_LABEL: Record<HabitState, string> = {
  no_deposits_yet: 'No deposits yet',
  active: 'Active',
  at_risk: 'At risk',
  stale: 'Stale',
  plan_paused: 'Plan paused',
};

/** "May 28" — short human-readable date for Bangkok day keys. */
export function shortDateLabel(dateKey: string): string {
  const { y, m, d } = parseKey(dateKey);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  });
}
