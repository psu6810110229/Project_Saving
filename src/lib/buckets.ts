import type { Bucket, BucketTransfer, SavingsLog } from '../types';

type BucketNameCandidate = {
  id?: string;
  name: string;
};

export function sumTargets(buckets: Pick<Bucket, 'target_amount'>[]): number {
  return buckets.reduce((s, b) => s + b.target_amount, 0);
}

export function normalizeBucketNameForUniqueness(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function hasDuplicateBucketName<T extends BucketNameCandidate>(
  buckets: T[],
  name: string,
  ignoreId?: string,
): boolean {
  const normalizedName = normalizeBucketNameForUniqueness(name);
  if (!normalizedName) return false;

  return buckets.some(bucket => {
    if (ignoreId && bucket.id === ignoreId) return false;
    return normalizeBucketNameForUniqueness(bucket.name) === normalizedName;
  });
}

export function findDuplicateBucketName<T extends BucketNameCandidate>(buckets: T[]): string | null {
  const seen = new Set<string>();

  for (const bucket of buckets) {
    const normalizedName = normalizeBucketNameForUniqueness(bucket.name);
    if (!normalizedName) continue;
    if (seen.has(normalizedName)) return bucket.name.trim();
    seen.add(normalizedName);
  }

  return null;
}

export function shouldAutofillBucketName(
  currentName: string,
  defaultNames: Record<string, string>,
): boolean {
  const normalizedCurrent = currentName.trim();
  if (!normalizedCurrent) return true;
  return Object.values(defaultNames).some(defaultName => defaultName.trim() === normalizedCurrent);
}

export interface BucketValidation {
  ok: boolean;
  /** 'match' | 'under' | 'over' */
  state: 'match' | 'under' | 'over';
  diff: number;
  reason?: string;
}

export function validateBuckets(
  buckets: Pick<Bucket, 'target_amount'>[],
  goalTarget: number,
): BucketValidation {
  const total = sumTargets(buckets);
  const diff = goalTarget - total;
  if (diff === 0) return { ok: true, state: 'match', diff: 0 };
  if (diff > 0) return { ok: true, state: 'under', diff, reason: `฿${diff.toLocaleString()} unallocated` };
  return { ok: false, state: 'over', diff, reason: `Over by ฿${Math.abs(diff).toLocaleString()}` };
}

/**
 * Saved amount for a bucket. Mirrors the SQL `bucket_balance` helper
 * (migration 0059):
 *   deposits + incoming transfers − outgoing transfers
 *
 * Transfers are owner-only (RLS `bucket_transfers_select_own`), so this
 * helper only produces a transfer-aware total when the caller has a
 * visible transfer list — i.e. for the current user's own buckets.
 * For partner-owned buckets, callers should omit `transfers` and the
 * legacy deposit-only sum is returned.
 */
export function bucketSaved(
  bucketId: string,
  logs: SavingsLog[],
  transfers?: BucketTransfer[],
): number {
  const deposits = logs.filter(l => l.bucket_id === bucketId).reduce((s, l) => s + l.amount, 0);
  if (!transfers || transfers.length === 0) return deposits;
  let incoming = 0;
  let outgoing = 0;
  for (const t of transfers) {
    if (t.destination_bucket_id === bucketId) incoming += t.amount;
    if (t.source_bucket_id === bucketId) outgoing += t.amount;
  }
  return deposits + incoming - outgoing;
}

export function bucketPercent(
  bucket: Bucket,
  logs: SavingsLog[],
  transfers?: BucketTransfer[],
): number {
  if (bucket.target_amount <= 0) return 0;
  return Math.min(100, (bucketSaved(bucket.id, logs, transfers) / bucket.target_amount) * 100);
}
