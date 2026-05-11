import type { Bucket, SavingsLog } from '../types';

export function sumTargets(buckets: Pick<Bucket, 'target_amount'>[]): number {
  return buckets.reduce((s, b) => s + b.target_amount, 0);
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

export function bucketSaved(bucketId: string, logs: SavingsLog[]): number {
  return logs.filter(l => l.bucket_id === bucketId).reduce((s, l) => s + l.amount, 0);
}

export function bucketPercent(bucket: Bucket, logs: SavingsLog[]): number {
  if (bucket.target_amount <= 0) return 0;
  return Math.min(100, (bucketSaved(bucket.id, logs) / bucket.target_amount) * 100);
}
