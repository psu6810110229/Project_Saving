import type {
  Bucket,
  BucketPauseState,
  BucketPlanPause,
  BucketPlanRevision,
  ResumePressureReason,
  ResumePreview,
  SavingRuleType,
} from '../types';
import { addDays, daysBetween } from './savingPlan';

export const RESUME_PRESSURE_DAILY_THRESHOLD = 300;
export const RESUME_PRESSURE_MULTIPLIER = 2;

export interface BucketRuleSnapshot {
  target_amount?: number | null;
  deadline?: string | null;
  saving_rule_type?: SavingRuleType | null;
  saving_rule_amount?: number | null;
  saving_rule_start_amount?: number | null;
  saving_rule_increment?: number | null;
  saving_rule_cap?: number | null;
}

export interface ResumePressureInput {
  requiredDailyEquivalent: number | null;
  previousDailyEquivalent?: number | null;
  dailyThreshold?: number;
  multiplierThreshold?: number;
}

export interface ResumePreviewInput {
  bucket: Pick<Bucket, 'id' | 'target_amount' | 'deadline'>;
  currentBalance: number;
  resumeDate: string;
  ruleSnapshot?: BucketRuleSnapshot | BucketPlanRevision | null;
  previousDailyEquivalent?: number | null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function pauseIntervalContainsDate(pause: BucketPlanPause, dateKey: string): boolean {
  return dateKey >= pause.paused_from
    && (pause.resumed_from === null || dateKey < pause.resumed_from);
}

export function isBucketPausedOnDate(
  pauses: BucketPlanPause[],
  bucketId: string,
  dateKey: string,
): boolean {
  return pauses.some(pause => (
    pause.bucket_id === bucketId && pauseIntervalContainsDate(pause, dateKey)
  ));
}

export function openPauseForBucket(
  pauses: BucketPlanPause[],
  bucketId: string,
): BucketPlanPause | null {
  return pauses.find(pause => (
    pause.bucket_id === bucketId && pause.resumed_from === null
  )) ?? null;
}

export function pauseForBucketOnDate(
  pauses: BucketPlanPause[],
  bucketId: string,
  dateKey: string,
): BucketPlanPause | null {
  return pauses.find(pause => (
    pause.bucket_id === bucketId && pauseIntervalContainsDate(pause, dateKey)
  )) ?? null;
}

export function pausedDaysInRange(
  pauses: BucketPlanPause[],
  bucketId: string,
  startKey: string,
  endKey: string,
): number {
  if (endKey < startKey) return 0;
  const rangeEndExclusive = addDays(endKey, 1);
  let total = 0;
  for (const pause of pauses) {
    if (pause.bucket_id !== bucketId) continue;
    const overlapStart = pause.paused_from > startKey ? pause.paused_from : startKey;
    const pauseEndExclusive = pause.resumed_from ?? rangeEndExclusive;
    const overlapEndExclusive = pauseEndExclusive < rangeEndExclusive ? pauseEndExclusive : rangeEndExclusive;
    if (overlapEndExclusive <= overlapStart) continue;
    total += daysBetween(overlapStart, overlapEndExclusive);
  }
  return total;
}

export function bucketPauseStateForDate(
  bucket: Pick<Bucket, 'id'>,
  pauses: BucketPlanPause[],
  dateKey: string,
): BucketPauseState {
  const pauseForDate = pauseForBucketOnDate(pauses, bucket.id, dateKey);
  return {
    bucketId: bucket.id,
    dateKey,
    isPaused: pauseForDate !== null,
    openPause: openPauseForBucket(pauses, bucket.id),
    pauseForDate,
  };
}

export function dailyEquivalentForRule(
  ruleSnapshot: BucketRuleSnapshot | BucketPlanRevision | null | undefined,
): number | null {
  if (!ruleSnapshot) return null;
  const rule = ruleSnapshot.saving_rule_type;
  switch (rule) {
    case 'fixed_daily':
      return roundMoney(Number(ruleSnapshot.saving_rule_amount ?? 0));
    case 'fixed_weekly':
      return roundMoney(Number(ruleSnapshot.saving_rule_amount ?? 0) / 7);
    case 'fixed_monthly':
      return roundMoney(Number(ruleSnapshot.saving_rule_amount ?? 0) / 30);
    case 'increasing_daily':
    case 'increasing_daily_capped':
      return roundMoney(Number(ruleSnapshot.saving_rule_start_amount ?? 0));
    default:
      return null;
  }
}

export function classifyResumePressure({
  requiredDailyEquivalent,
  previousDailyEquivalent,
  dailyThreshold = RESUME_PRESSURE_DAILY_THRESHOLD,
  multiplierThreshold = RESUME_PRESSURE_MULTIPLIER,
}: ResumePressureInput): ResumePressureReason[] {
  if (requiredDailyEquivalent === null || !Number.isFinite(requiredDailyEquivalent)) {
    return [];
  }

  const reasons: ResumePressureReason[] = [];
  if (requiredDailyEquivalent >= dailyThreshold) {
    reasons.push('daily_threshold');
  }
  if (
    previousDailyEquivalent !== null
    && previousDailyEquivalent !== undefined
    && previousDailyEquivalent > 0
    && requiredDailyEquivalent > previousDailyEquivalent * multiplierThreshold
  ) {
    reasons.push('multiplier_threshold');
  }
  return reasons;
}

export function previewResumePlan({
  bucket,
  currentBalance,
  resumeDate,
  ruleSnapshot,
  previousDailyEquivalent,
}: ResumePreviewInput): ResumePreview {
  const targetAmount = Number(ruleSnapshot?.target_amount ?? bucket.target_amount ?? 0);
  const deadline = ruleSnapshot?.deadline ?? bucket.deadline ?? null;
  const remainingAmount = roundMoney(Math.max(0, targetAmount - currentBalance));
  const remainingDays = deadline ? Math.max(0, daysBetween(resumeDate, deadline)) : null;
  const pressureDays = remainingDays === null ? null : Math.max(1, remainingDays);
  const requiredDailyEquivalent = pressureDays === null
    ? null
    : roundMoney(remainingAmount / pressureDays);
  const ruleDailyEquivalent = dailyEquivalentForRule(ruleSnapshot);
  const resolvedPreviousDailyEquivalent = previousDailyEquivalent ?? ruleDailyEquivalent;
  const pressureReasons = classifyResumePressure({
    requiredDailyEquivalent,
    previousDailyEquivalent: resolvedPreviousDailyEquivalent,
  });

  return {
    bucketId: bucket.id,
    resumeDate,
    targetAmount,
    currentBalance: roundMoney(currentBalance),
    remainingAmount,
    deadline,
    remainingDays,
    requiredDailyEquivalent,
    previousDailyEquivalent: resolvedPreviousDailyEquivalent ?? null,
    ruleDailyEquivalent,
    pressureReasons,
    pressure: pressureReasons.length > 0 ? 'high' : 'normal',
  };
}
