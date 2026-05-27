import type {
  Bucket,
  BucketCategory,
  BucketTransfer,
  DailySummaryItem,
  SavingRuleType,
  SavingsLog,
} from '../types';
import { addDays, daysBetween, todayBangkokKey } from './savingPlan';
import { calcBucketFocusStates } from './bucketFocus';

function weekEnd(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay();
  const isoDow = dow === 0 ? 7 : dow;
  return addDays(dateKey, 7 - isoDow);
}

function monthEnd(dateKey: string): string {
  const [y, m] = dateKey.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0));
  const dd = String(last.getUTCDate()).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function depositsInRange(
  bucketId: string,
  logs: SavingsLog[],
  startKey: string,
  endKey: string,
  transfers?: BucketTransfer[],
): number {
  let total = 0;
  for (const l of logs) {
    if (l.bucket_id !== bucketId || l.amount <= 0) continue;
    const key = l.created_at.slice(0, 10);
    if (key >= startKey && key <= endKey) total += l.amount;
  }
  if (transfers) {
    for (const t of transfers) {
      const key = t.created_at.slice(0, 10);
      if (key < startKey || key > endKey) continue;
      if (t.destination_bucket_id === bucketId) total += t.amount;
      if (t.source_bucket_id === bucketId) total -= t.amount;
    }
  }
  return total;
}

function amountForDay(bucket: Bucket, dayIndex: number): number {
  const rule = bucket.saving_rule_type;
  if (rule === 'increasing_daily' || rule === 'increasing_daily_capped') {
    const start = bucket.saving_rule_start_amount ?? 0;
    const inc = bucket.saving_rule_increment ?? 0;
    const raw = start + dayIndex * inc;
    if (rule === 'increasing_daily_capped') {
      const cap = bucket.saving_rule_cap ?? Infinity;
      return raw > cap ? cap : raw;
    }
    return raw;
  }
  return bucket.saving_rule_amount ?? 0;
}

export function calcDailySummary(
  buckets: Bucket[],
  logs: SavingsLog[],
  today?: string,
  transfers?: BucketTransfer[],
): DailySummaryItem[] {
  const todayKey = today ?? todayBangkokKey();
  const active = buckets.filter(b => b.archived_at == null);
  const focusStates = calcBucketFocusStates(active, logs, todayKey, transfers);
  const items: DailySummaryItem[] = [];

  for (const b of active) {
    const state = focusStates.get(b.id);
    if (!state || state === 'done' || state === 'queued') continue;

    const isFocus = state === 'focus' || state === 'overdue';
    const rule: SavingRuleType = b.saving_rule_type ?? 'flexible';
    const category: BucketCategory = b.category ?? 'other';

    let amountDue: number | null = null;
    let periodLabel = 'flexible';
    let periodDeadline: string | null = null;

    switch (rule) {
      case 'fixed_daily': {
        const todayDeposits = depositsInRange(b.id, logs, todayKey, todayKey, transfers);
        const daily = b.saving_rule_amount ?? 0;
        amountDue = Math.max(0, daily - todayDeposits);
        periodLabel = 'today';
        periodDeadline = todayKey;
        break;
      }
      case 'fixed_weekly': {
        const end = weekEnd(todayKey);
        const start = addDays(end, -6);
        const weekDeposits = depositsInRange(b.id, logs, start, end, transfers);
        const weekly = b.saving_rule_amount ?? 0;
        const remaining = weekly - weekDeposits;
        amountDue = remaining > 0 ? remaining : null;
        periodLabel = 'this week';
        periodDeadline = end;
        break;
      }
      case 'fixed_monthly': {
        const end = monthEnd(todayKey);
        const start = todayKey.slice(0, 8) + '01';
        const monthDeposits = depositsInRange(b.id, logs, start, end, transfers);
        const monthly = b.saving_rule_amount ?? 0;
        const remaining = monthly - monthDeposits;
        if (remaining > 0) {
          amountDue = remaining;
          if (b.reminder_day) {
            const mm = todayKey.slice(5, 7);
            const yy = todayKey.slice(0, 4);
            const reminderKey = `${yy}-${mm}-${String(b.reminder_day).padStart(2, '0')}`;
            const daysUntilReminder = daysBetween(todayKey, reminderKey);
            periodLabel = daysUntilReminder > 0
              ? `this month (${daysUntilReminder}d to reminder)`
              : 'this month';
          } else {
            periodLabel = 'this month';
          }
        } else {
          amountDue = null;
          periodLabel = 'this month';
        }
        periodDeadline = end;
        break;
      }
      case 'increasing_daily':
      case 'increasing_daily_capped': {
        if (b.deadline) {
          const startKey = b.created_at.slice(0, 10);
          const dayIndex = daysBetween(startKey, todayKey);
          const todayAmount = amountForDay(b, dayIndex);
          const todayDeposits = depositsInRange(b.id, logs, todayKey, todayKey, transfers);
          amountDue = Math.max(0, todayAmount - todayDeposits);
        }
        periodLabel = 'today';
        periodDeadline = todayKey;
        break;
      }
      case 'flexible':
      default: {
        amountDue = null;
        periodLabel = 'flexible';
        periodDeadline = null;
        break;
      }
    }

    items.push({
      bucketId: b.id,
      bucketName: b.name,
      category,
      ruleType: rule,
      amountDue,
      periodLabel,
      periodDeadline,
      isFocus,
    });
  }

  items.sort((a, b) => {
    if (a.isFocus !== b.isFocus) return a.isFocus ? -1 : 1;
    return 0;
  });

  return items;
}
