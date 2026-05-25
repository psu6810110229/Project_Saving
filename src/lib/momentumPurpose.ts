import type { Bucket, BucketCategory, SavingsLog } from '../types';
import { BUCKET_CATEGORY_ORDER, normalizeBucketCategory } from './bucketCategories';
import { lastSevenDateKeys } from './dashboardStats';
import { localDateKey } from './streak';

export type MomentumPurposeScope =
  | { kind: 'all' }
  | { kind: 'category'; category: BucketCategory }
  | { kind: 'bucket'; bucketId: string; parentCategory: BucketCategory };

export function purposeFilteredDailySeries(
  logs: SavingsLog[],
  scope: MomentumPurposeScope,
  visibleBucketsById: Map<string, Bucket>,
  userId?: string,
  today?: Date,
): number[] {
  const filtered = filterLogsByPurpose(logs, scope, visibleBucketsById);
  const keys = lastSevenDateKeys(today);
  return keys.map(key =>
    filtered
      .filter(log => (!userId || log.user_id === userId) && localDateKey(log.created_at) === key)
      .reduce((sum, log) => sum + log.amount, 0),
  );
}

function filterLogsByPurpose(
  logs: SavingsLog[],
  scope: MomentumPurposeScope,
  visibleBucketsById: Map<string, Bucket>,
): SavingsLog[] {
  if (scope.kind === 'all') return logs;
  if (scope.kind === 'bucket') {
    return logs.filter(log => log.bucket_id === scope.bucketId);
  }
  return logs.filter(log => {
    if (!log.bucket_id) return false;
    const bucket = visibleBucketsById.get(log.bucket_id);
    if (!bucket) return false;
    return normalizeBucketCategory(bucket.category) === scope.category;
  });
}

export function availablePurposeCategories(
  visibleBuckets: Bucket[],
): BucketCategory[] {
  const seen = new Set<BucketCategory>();
  for (const bucket of visibleBuckets) {
    if (bucket.archived_at) continue;
    seen.add(normalizeBucketCategory(bucket.category));
  }
  return BUCKET_CATEGORY_ORDER.filter(cat => seen.has(cat));
}

export function bucketsForCategory(
  visibleBuckets: Bucket[],
  category: BucketCategory,
): Bucket[] {
  return visibleBuckets
    .filter(b => !b.archived_at && normalizeBucketCategory(b.category) === category)
    .sort((a, b) => a.position - b.position);
}
