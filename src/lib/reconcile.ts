import type { BalanceAdjustmentReason, BucketCategory } from '../types';
import { formatCurrency } from './format';

export interface ReasonOption {
  id: BalanceAdjustmentReason;
  label: string;
  description?: string;
}

/**
 * Reasons offered when the actual balance differs from the app
 * balance. Ordering is meant to lead with the most common cases.
 */
export const RECONCILE_REASONS: ReasonOption[] = [
  { id: 'forgot_to_log',    label: 'Forgot to log',     description: 'Money saved but not added to the app yet.' },
  { id: 'over_recorded',    label: 'Recorded too much', description: 'A deposit was entered larger than it really was.' },
  { id: 'miscounted',       label: 'Miscounted',        description: 'Cash or storage was counted wrong.' },
  { id: 'spent_or_used',    label: 'Spent/used already', description: 'Some money has already been spent or moved out.' },
  { id: 'opening_balance',  label: 'Opening balance',   description: 'Bringing in a balance from before this project.' },
  { id: 'other',            label: 'Other',             description: 'A different reason from the list.' },
];

const REASON_LABEL_MAP: Record<BalanceAdjustmentReason, string> = RECONCILE_REASONS
  .reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {} as Record<BalanceAdjustmentReason, string>);

export function reasonLabel(reason: BalanceAdjustmentReason | null | undefined): string {
  if (!reason) return '';
  return REASON_LABEL_MAP[reason] ?? 'Other';
}

/** Signed currency string like "+฿500" or "-฿120". Zero returns "฿0". */
export function formatSignedCurrency(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return formatCurrency(0);
  const sign = amount > 0 ? '+' : '-';
  return `${sign}${formatCurrency(Math.abs(amount))}`;
}

/** Directional label like "ปรับเพิ่ม ฿564" or "Adjusted down ฿537". */
export function formatDirectionalAdjustment(
  amount: number,
  upLabel: string,
  downLabel: string,
): string {
  if (!Number.isFinite(amount) || amount === 0) return formatCurrency(0);
  const dir = amount > 0 ? upLabel : downLabel;
  return `${dir} ${formatCurrency(Math.abs(amount))}`;
}

/**
 * A bucket considered for a shortfall write-down (plan 56 slice 4b).
 * `balance` is the bucket's current displayed balance (deposits +
 * transfers + signed allocations) and is never trimmed below zero.
 */
export interface ShortfallBucket {
  id: string;
  category?: BucketCategory;
  deadline?: string | null;
  balance: number;
}

/** One bucket's positive trim magnitude in a spill plan. */
export interface ShortfallTrim {
  bucketId: string;
  amount: number;
}

/**
 * Order buckets least-urgent-first for a shortfall write-down: the
 * `buffer` category comes first, then the farthest deadline (a missing
 * deadline counts as least urgent). Trimming the least pressing bucket
 * first protects the user's urgent / near-term goals.
 */
export function shortfallBucketOrder<T extends ShortfallBucket>(buckets: T[]): T[] {
  const farFuture = Number.POSITIVE_INFINITY;
  return [...buckets].sort((a, b) => {
    const aBuffer = a.category === 'buffer' ? 0 : 1;
    const bBuffer = b.category === 'buffer' ? 0 : 1;
    if (aBuffer !== bBuffer) return aBuffer - bBuffer;
    const aTime = a.deadline ? new Date(a.deadline).getTime() : farFuture;
    const bTime = b.deadline ? new Date(b.deadline).getTime() : farFuture;
    return bTime - aTime; // farthest deadline (least urgent) first
  });
}

/**
 * Smart default bucket for a shortfall write-down — the first
 * least-urgent bucket that actually holds money. `null` when no bucket
 * has a positive balance.
 */
export function smartShortfallBucketId(buckets: ShortfallBucket[]): string | null {
  const ordered = shortfallBucketOrder(buckets.filter(b => b.balance > 0.005));
  return ordered[0]?.id ?? null;
}

/**
 * Auto-spill plan: trim `shortfall` across buckets, starting from
 * `startBucketId`, then continuing in least-urgent order. Each bucket is
 * trimmed by at most its balance (never negative). Returns the per-bucket
 * positive trim magnitudes (2 dp); the sum equals `shortfall` whenever the
 * buckets together hold enough (always true: bucketTotal ≥ shortfall).
 */
export function shortfallSpillPlan(
  buckets: ShortfallBucket[],
  shortfall: number,
  startBucketId: string | null,
): ShortfallTrim[] {
  let remainingCents = Math.round(shortfall * 100);
  if (remainingCents <= 0) return [];

  const ordered = shortfallBucketOrder(buckets.filter(b => b.balance > 0.005));
  const start = startBucketId ? ordered.find(b => b.id === startBucketId) : undefined;
  const sequence = start ? [start, ...ordered.filter(b => b.id !== start.id)] : ordered;

  const plan: ShortfallTrim[] = [];
  for (const bucket of sequence) {
    if (remainingCents <= 0) break;
    const balanceCents = Math.round(bucket.balance * 100);
    const trimCents = Math.min(balanceCents, remainingCents);
    if (trimCents <= 0) continue;
    plan.push({ bucketId: bucket.id, amount: trimCents / 100 });
    remainingCents -= trimCents;
  }
  return plan;
}

/** Whole days between two ISO timestamps. Returns 0 if same day. */
export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Whether the user has recorded at least one deposit after their latest
 * manual balance check. When there has never been a manual check, any
 * existing deposit means the user still has money in-app that has not yet
 * been manually confirmed against the real account/cash balance.
 */
export function hasDepositsAfterCheck(
  logs: Array<{ user_id: string; created_at: string }>,
  userId: string | undefined,
  checkedAt: string | null | undefined,
): boolean {
  if (!userId) return false;

  let latestDepositMs = Number.NEGATIVE_INFINITY;
  for (const log of logs) {
    if (log.user_id !== userId) continue;
    const createdAtMs = Date.parse(log.created_at);
    if (Number.isFinite(createdAtMs) && createdAtMs > latestDepositMs) {
      latestDepositMs = createdAtMs;
    }
  }

  if (!Number.isFinite(latestDepositMs)) return false;
  if (!checkedAt) return true;

  const checkedAtMs = Date.parse(checkedAt);
  if (!Number.isFinite(checkedAtMs)) return true;
  return latestDepositMs > checkedAtMs;
}
