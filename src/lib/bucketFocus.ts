import type { Bucket, BucketFocusState, BucketTransfer, SavingsLog } from '../types';
import { daysBetween, todayBangkokKey } from './savingPlan';
import { bucketSaved } from './buckets';

export function calcBucketFocusStates(
  buckets: Bucket[],
  logs: SavingsLog[],
  today?: string,
  transfers?: BucketTransfer[],
): Map<string, BucketFocusState> {
  const todayKey = today ?? todayBangkokKey();
  const result = new Map<string, BucketFocusState>();

  const active = buckets.filter(b => b.archived_at == null);
  if (active.length === 0) return result;

  const withDeadline: Bucket[] = [];
  const done: Bucket[] = [];
  const overdue: Bucket[] = [];

  for (const b of active) {
    if (!b.deadline) continue;
    const saved = bucketSaved(b.id, logs, transfers);
    if (saved >= b.target_amount) {
      done.push(b);
      continue;
    }
    const daysLeft = daysBetween(todayKey, b.deadline);
    if (daysLeft < 0) {
      overdue.push(b);
    } else {
      withDeadline.push(b);
    }
  }

  for (const b of done) {
    result.set(b.id, 'done');
  }

  for (const b of overdue) {
    result.set(b.id, 'focus');
  }

  withDeadline.sort((a, b) => a.deadline!.localeCompare(b.deadline!));

  let focusCount = overdue.length;
  const MAX_FOCUS = 2;

  if (focusCount < MAX_FOCUS && withDeadline.length > 0) {
    const first = withDeadline[0];
    result.set(first.id, 'focus');
    focusCount++;

    if (focusCount < MAX_FOCUS && withDeadline.length > 1) {
      const second = withDeadline[1];
      const daysToSecond = daysBetween(todayKey, second.deadline!);
      const saved = bucketSaved(second.id, logs, transfers);
      const pctSaved = second.target_amount > 0 ? (saved / second.target_amount) * 100 : 100;

      const totalDays = daysBetween(second.created_at.slice(0, 10), second.deadline!);
      const elapsed = daysBetween(second.created_at.slice(0, 10), todayKey);
      const pctExpected = totalDays > 0 ? (elapsed / totalDays) * 100 : 100;
      const isBehind = pctSaved < pctExpected - 10;

      if (daysToSecond <= 30 && isBehind) {
        result.set(second.id, 'focus');
      }
    }
  }

  let nextAssigned = false;
  for (const b of withDeadline) {
    if (result.has(b.id)) continue;
    if (!nextAssigned) {
      result.set(b.id, 'next');
      nextAssigned = true;
    } else {
      result.set(b.id, 'queued');
    }
  }

  return result;
}
