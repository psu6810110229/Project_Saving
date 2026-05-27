import type { Bucket, BucketPace, BucketTransfer, PaceStatus, SavingsLog } from '../types';
import { addDays, daysBetween, todayBangkokKey } from './savingPlan';
import { bucketSaved } from './buckets';

interface DepositPoint {
  dateKey: string;
  cumulativeAmount: number;
}

function depositTimeline(
  bucketId: string,
  logs: SavingsLog[],
  transfers?: BucketTransfer[],
): DepositPoint[] {
  const relevant = logs.filter(l => l.bucket_id === bucketId && l.amount > 0);
  relevant.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const dayMap = new Map<string, number>();
  for (const l of relevant) {
    const key = l.created_at.slice(0, 10);
    dayMap.set(key, (dayMap.get(key) ?? 0) + l.amount);
  }

  if (transfers) {
    for (const t of transfers) {
      const key = t.created_at.slice(0, 10);
      if (t.destination_bucket_id === bucketId) {
        dayMap.set(key, (dayMap.get(key) ?? 0) + t.amount);
      }
      if (t.source_bucket_id === bucketId) {
        dayMap.set(key, (dayMap.get(key) ?? 0) - t.amount);
      }
    }
  }

  const sorted = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  let cumul = 0;
  return sorted.map(([dateKey, amount]) => {
    cumul += amount;
    return { dateKey, cumulativeAmount: cumul };
  });
}

function weightedVelocity(timeline: DepositPoint[], today: string): number | null {
  if (timeline.length < 3) return null;

  const recent = timeline.slice(-10);
  const firstKey = recent[0].dateKey;
  const span = daysBetween(firstKey, today);
  if (span <= 0) return null;

  const totalRecent = recent[recent.length - 1].cumulativeAmount - (recent.length > 1 ? recent[0].cumulativeAmount : 0);

  const recentWeight = 0.7;
  const overallWeight = 0.3;
  const recentVelocity = totalRecent / span;

  const allFirst = timeline[0].dateKey;
  const allSpan = daysBetween(allFirst, today);
  const overallVelocity = allSpan > 0 ? timeline[timeline.length - 1].cumulativeAmount / allSpan : 0;

  return recentVelocity * recentWeight + overallVelocity * overallWeight;
}

function classifyPace(
  percentSaved: number,
  percentExpected: number,
  percentTimeElapsed: number,
): PaceStatus {
  const diff = percentSaved - percentExpected;
  if (diff >= 10) return 'ahead';
  if (diff >= -10) return 'on_track';
  if (percentTimeElapsed > 70 && percentSaved < 30) return 'critical';
  return 'behind';
}

export function calcBucketPace(
  bucket: Bucket,
  logs: SavingsLog[],
  today?: string,
  transfers?: BucketTransfer[],
): BucketPace {
  const todayKey = today ?? todayBangkokKey();
  const deadline = bucket.deadline;
  const target = bucket.target_amount;
  const saved = bucketSaved(bucket.id, logs, transfers);
  const percentSaved = target > 0 ? (saved / target) * 100 : 0;

  if (!deadline) {
    return {
      status: 'on_track',
      percentSaved,
      percentExpected: 0,
      remainingAmount: Math.max(0, target - saved),
      remainingDays: 0,
      requiredPerDay: null,
      requiredPerPeriod: null,
      projectedCompletionDate: null,
    };
  }

  const remainingDays = daysBetween(todayKey, deadline);
  const remainingAmount = Math.max(0, target - saved);

  const createdKey = bucket.created_at.slice(0, 10);
  const totalDays = daysBetween(createdKey, deadline);
  const elapsedDays = daysBetween(createdKey, todayKey);
  const percentTimeElapsed = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 100;
  const percentExpected = totalDays > 0 ? Math.min(100, (elapsedDays / totalDays) * 100) : 100;

  if (saved >= target) {
    return {
      status: 'ahead',
      percentSaved: Math.min(100, percentSaved),
      percentExpected,
      remainingAmount: 0,
      remainingDays,
      requiredPerDay: null,
      requiredPerPeriod: null,
      projectedCompletionDate: null,
    };
  }

  const requiredPerDay = remainingDays > 0 ? remainingAmount / remainingDays : null;
  let requiredPerPeriod: number | null = null;
  const rule = bucket.saving_rule_type;
  if (rule === 'fixed_weekly' && remainingDays > 0) {
    requiredPerPeriod = remainingAmount / Math.max(1, remainingDays / 7);
  } else if (rule === 'fixed_monthly' && remainingDays > 0) {
    requiredPerPeriod = remainingAmount / Math.max(1, remainingDays / 30);
  }

  let projectedCompletionDate: string | null = null;
  const timeline = depositTimeline(bucket.id, logs, transfers);
  const velocity = weightedVelocity(timeline, todayKey);
  if (velocity && velocity > 0 && remainingAmount > 0) {
    const daysToComplete = Math.ceil(remainingAmount / velocity);
    projectedCompletionDate = addDays(todayKey, daysToComplete);
  } else if (remainingAmount <= 0) {
    projectedCompletionDate = todayKey;
  }

  const status = classifyPace(percentSaved, percentExpected, percentTimeElapsed);

  return {
    status,
    percentSaved: Math.min(100, percentSaved),
    percentExpected,
    remainingAmount,
    remainingDays,
    requiredPerDay,
    requiredPerPeriod,
    projectedCompletionDate,
  };
}
