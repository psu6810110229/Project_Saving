import type { Bucket, BucketTransfer, SavingsLog, SavingRuleType } from '../types';
import { addDays, daysBetween, todayBangkokKey } from './savingPlan';
import { localDateKey } from './streak';
import { calcBucketFocusStates } from './bucketFocus';

export type StreakGranularity = 'day' | 'week' | 'month';

export interface PeriodAwareStreakResult {
  streak: number;
  unit: StreakGranularity;
  trackable: boolean;
  hasMetCurrentPeriod: boolean;
  hasLoggedToday: boolean;
  lastDepositDateKey: string | null;
  focusBucketIds: string[];
}

interface PeriodWindow {
  start: string;
  end: string;
}

const TRACKABLE_RULES = new Set<SavingRuleType>([
  'fixed_daily',
  'fixed_weekly',
  'fixed_monthly',
  'increasing_daily',
  'increasing_daily_capped',
]);

function ruleGranularity(rule: SavingRuleType | null | undefined): StreakGranularity | null {
  switch (rule) {
    case 'fixed_daily':
    case 'increasing_daily':
    case 'increasing_daily_capped':
      return 'day';
    case 'fixed_weekly':
      return 'week';
    case 'fixed_monthly':
      return 'month';
    default:
      return null;
  }
}

function finestGranularity(rules: SavingRuleType[]): StreakGranularity {
  if (rules.some(rule => ruleGranularity(rule) === 'day')) return 'day';
  if (rules.some(rule => ruleGranularity(rule) === 'week')) return 'week';
  return 'month';
}

function weekWindow(dateKey: string): PeriodWindow {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay();
  const isoDow = dow === 0 ? 7 : dow;
  const start = addDays(dateKey, 1 - isoDow);
  return { start, end: addDays(start, 6) };
}

function monthWindow(dateKey: string): PeriodWindow {
  const [y, m] = dateKey.split('-').map(Number);
  const end = new Date(Date.UTC(y, m, 0));
  const mm = String(m).padStart(2, '0');
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(end.getUTCDate()).padStart(2, '0')}`,
  };
}

function periodFor(dateKey: string, granularity: StreakGranularity): PeriodWindow {
  if (granularity === 'day') return { start: dateKey, end: dateKey };
  if (granularity === 'week') return weekWindow(dateKey);
  return monthWindow(dateKey);
}

function previousPeriod(period: PeriodWindow, granularity: StreakGranularity): PeriodWindow {
  return periodFor(addDays(period.start, -1), granularity);
}

function bucketCreatedKey(bucket: Bucket): string {
  return localDateKey(bucket.created_at);
}

/**
 * Anchor date for a bucket's saving schedule: the chosen start date when
 * set (migration 0081), otherwise the bucket's creation date. Used to
 * index increasing-daily amounts and to skip periods before the plan begins.
 */
function bucketScheduleStartKey(bucket: Bucket): string {
  return bucket.saving_rule_start_date ?? bucketCreatedKey(bucket);
}

function bucketCompletedKey(bucket: Bucket): string | null {
  return bucket.completed_at ? localDateKey(bucket.completed_at) : null;
}

function sumBucketActivityInRange(
  bucketId: string,
  logs: SavingsLog[],
  startKey: string,
  endKey: string,
  transfers?: BucketTransfer[],
): number {
  let total = 0;

  for (const log of logs) {
    if (log.bucket_id !== bucketId || log.amount <= 0) continue;
    const key = localDateKey(log.created_at);
    if (key >= startKey && key <= endKey) total += log.amount;
  }

  if (transfers) {
    for (const transfer of transfers) {
      const key = localDateKey(transfer.created_at);
      if (key < startKey || key > endKey) continue;
      if (transfer.destination_bucket_id === bucketId) total += transfer.amount;
      if (transfer.source_bucket_id === bucketId) total -= transfer.amount;
    }
  }

  return total;
}

function bucketSavedThrough(
  bucketId: string,
  logs: SavingsLog[],
  endKey: string,
  transfers?: BucketTransfer[],
): number {
  return sumBucketActivityInRange(bucketId, logs, '0000-01-01', endKey, transfers);
}

function increasingDailyAmount(bucket: Bucket, dateKey: string): number {
  const dayIndex = Math.max(0, daysBetween(bucketScheduleStartKey(bucket), dateKey));
  const start = bucket.saving_rule_start_amount ?? 0;
  const increment = bucket.saving_rule_increment ?? 0;
  const raw = start + dayIndex * increment;
  if (bucket.saving_rule_type === 'increasing_daily_capped') {
    return Math.min(raw, bucket.saving_rule_cap ?? Infinity);
  }
  return raw;
}

function requiredAmountForOwnPeriod(bucket: Bucket, ownPeriod: PeriodWindow): number {
  switch (bucket.saving_rule_type) {
    case 'fixed_daily':
      return bucket.saving_rule_amount ?? 0;
    case 'fixed_weekly':
    case 'fixed_monthly':
      return bucket.saving_rule_amount ?? 0;
    case 'increasing_daily':
    case 'increasing_daily_capped':
      return increasingDailyAmount(bucket, ownPeriod.end);
    default:
      return 0;
  }
}

function periodHasFrozenDate(period: PeriodWindow, frozenDates: ReadonlySet<string>): boolean {
  if (frozenDates.size === 0) return false;
  if (frozenDates.has(period.end)) return true;

  let cursor = period.start;
  for (let i = 0; i < 31 && cursor <= period.end; i++) {
    if (frozenDates.has(cursor)) return true;
    cursor = addDays(cursor, 1);
  }
  return false;
}

function bucketObligationMet(
  bucket: Bucket,
  period: PeriodWindow,
  todayKey: string,
  logs: SavingsLog[],
  transfers?: BucketTransfer[],
): boolean | null {
  const rule = bucket.saving_rule_type;
  const granularity = ruleGranularity(rule);
  if (!rule || !granularity) return null;
  // Skip periods before the schedule starts (created date, or a chosen
  // future start date for increasing-daily rules) — no obligation yet.
  if (bucketScheduleStartKey(bucket) > period.end) return null;

  const completedKey = bucketCompletedKey(bucket);
  if (completedKey && completedKey <= period.end) return true;
  if (bucketSavedThrough(bucket.id, logs, period.end, transfers) >= bucket.target_amount) return true;

  const ownPeriod = periodFor(period.end, granularity);
  const amountSaved = sumBucketActivityInRange(bucket.id, logs, ownPeriod.start, ownPeriod.end, transfers);
  const required = requiredAmountForOwnPeriod(bucket, ownPeriod);
  if (amountSaved + 0.005 >= required) return true;

  if (granularity !== 'day' && ownPeriod.end >= todayKey) {
    return true;
  }

  return false;
}

function periodMetForAllBuckets(
  buckets: Bucket[],
  period: PeriodWindow,
  todayKey: string,
  logs: SavingsLog[],
  frozenDates: ReadonlySet<string>,
  transfers?: BucketTransfer[],
): { met: boolean; applicable: boolean } {
  let applicable = false;

  for (const bucket of buckets) {
    const met = bucketObligationMet(bucket, period, todayKey, logs, transfers);
    if (met === null) continue;
    applicable = true;
    if (!met) {
      return {
        applicable,
        met: periodHasFrozenDate(period, frozenDates),
      };
    }
  }

  return { applicable, met: applicable };
}

function latestDepositDateForBuckets(bucketIds: Set<string>, logs: SavingsLog[], todayKey: string): string | null {
  let latest: string | null = null;
  for (const log of logs) {
    if (!log.bucket_id || !bucketIds.has(log.bucket_id) || log.amount <= 0) continue;
    const key = localDateKey(log.created_at);
    if (key > todayKey) continue;
    if (!latest || key > latest) latest = key;
  }
  return latest;
}

export function calcPeriodAwareStreak(
  buckets: Bucket[],
  logs: SavingsLog[],
  today?: string,
  frozenDates: ReadonlySet<string> = new Set(),
  transfers?: BucketTransfer[],
): PeriodAwareStreakResult {
  const todayKey = today ?? todayBangkokKey();
  const active = buckets.filter(bucket => bucket.archived_at == null);
  const focusStates = calcBucketFocusStates(active, logs, todayKey, transfers);
  const focusBuckets = active.filter(bucket => focusStates.get(bucket.id) === 'focus');
  const trackedBuckets = focusBuckets.filter(bucket => (
    bucket.saving_rule_type ? TRACKABLE_RULES.has(bucket.saving_rule_type) : false
  ));
  const focusBucketIds = focusBuckets.map(bucket => bucket.id);
  const trackedBucketIds = new Set(trackedBuckets.map(bucket => bucket.id));
  const lastDepositDateKey = latestDepositDateForBuckets(trackedBucketIds, logs, todayKey);
  const hasLoggedToday = lastDepositDateKey === todayKey;

  if (trackedBuckets.length === 0) {
    return {
      streak: 0,
      unit: 'day',
      trackable: false,
      hasMetCurrentPeriod: false,
      hasLoggedToday,
      lastDepositDateKey,
      focusBucketIds,
    };
  }

  const unit = finestGranularity(trackedBuckets.map(bucket => bucket.saving_rule_type as SavingRuleType));
  const currentPeriod = periodFor(todayKey, unit);
  const current = periodMetForAllBuckets(
    trackedBuckets,
    currentPeriod,
    todayKey,
    logs,
    frozenDates,
    transfers,
  );

  let cursor = currentPeriod;
  if (unit !== 'day' && current.applicable && !current.met && currentPeriod.end >= todayKey) {
    cursor = previousPeriod(currentPeriod, unit);
  }

  const maxPeriods = unit === 'day' ? 4000 : unit === 'week' ? 600 : 240;
  let streak = 0;
  for (let i = 0; i < maxPeriods; i++) {
    const result = periodMetForAllBuckets(trackedBuckets, cursor, todayKey, logs, frozenDates, transfers);
    if (!result.applicable) break;
    if (!result.met) break;
    streak += 1;
    cursor = previousPeriod(cursor, unit);
  }

  return {
    streak,
    unit,
    trackable: true,
    hasMetCurrentPeriod: current.applicable && current.met,
    hasLoggedToday,
    lastDepositDateKey,
    focusBucketIds,
  };
}
