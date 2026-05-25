import type { Bucket, BucketCategory, SavingsLog } from '../types';
import { BUCKET_CATEGORY_ORDER, normalizeBucketCategory } from './bucketCategories';
import { lastSevenDateKeys } from './dashboardStats';
import { localDateKey } from './streak';

export type MomentumPurposeScope =
  | { kind: 'all' }
  | { kind: 'categories'; categories: BucketCategory[] }
  | { kind: 'category'; category: BucketCategory }
  | { kind: 'bucket'; bucketId: string; parentCategory: BucketCategory };

export type MomentumPurposeMode = 'room' | 'me' | 'compare';

export interface MomentumDayMarker {
  categories: BucketCategory[];
  bucketIds: string[];
  bucketNames: string[];
}

interface PurposeMarkerOptions {
  revealBucketNamesForUserId?: string | null;
}

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

export function purposeDailyMarkers(
  logs: SavingsLog[],
  scope: MomentumPurposeScope,
  visibleBucketsById: Map<string, Bucket>,
  userId?: string,
  today?: Date,
  options?: PurposeMarkerOptions,
): MomentumDayMarker[] {
  const filtered = filterLogsByPurpose(logs, scope, visibleBucketsById);
  const keys = lastSevenDateKeys(today);
  return keys.map(key => {
    const categories = new Set<BucketCategory>();
    const buckets = new Map<string, string>();

    for (const log of filtered) {
      if (userId && log.user_id !== userId) continue;
      if (localDateKey(log.created_at) !== key) continue;
      if (!log.bucket_id) continue;

      const bucket = visibleBucketsById.get(log.bucket_id);
      if (!bucket) continue;
      categories.add(normalizeBucketCategory(bucket.category));
      if (
        !options
        || options.revealBucketNamesForUserId === undefined
        || log.user_id === options.revealBucketNamesForUserId
      ) {
        buckets.set(bucket.id, bucket.name);
      }
    }

    return {
      categories: BUCKET_CATEGORY_ORDER.filter(cat => categories.has(cat)),
      bucketIds: Array.from(buckets.keys()),
      bucketNames: Array.from(buckets.values()),
    };
  });
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
  if (scope.kind === 'categories') {
    const categories = new Set(scope.categories);
    return logs.filter(log => {
      if (!log.bucket_id) return false;
      const bucket = visibleBucketsById.get(log.bucket_id);
      if (!bucket) return false;
      return categories.has(normalizeBucketCategory(bucket.category));
    });
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

export function availablePurposeCategoriesForMode(
  mode: MomentumPurposeMode,
  userBuckets: Bucket[],
  allVisibleBuckets: Bucket[],
  logs: SavingsLog[],
  visibleBucketsById: Map<string, Bucket>,
  compareMemberId?: string | null,
  userId?: string,
  today?: Date,
): BucketCategory[] {
  if (mode === 'room') {
    return availablePurposeCategories(allVisibleBuckets);
  }
  if (mode === 'me') {
    return availablePurposeCategories(userBuckets);
  }

  const keys = new Set(lastSevenDateKeys(today));
  const seen = new Set<BucketCategory>();
  for (const log of logs) {
    if (!log.bucket_id) continue;
    if (!keys.has(localDateKey(log.created_at))) continue;
    if (log.user_id !== userId && log.user_id !== compareMemberId) continue;

    const bucket = visibleBucketsById.get(log.bucket_id);
    if (!bucket || bucket.archived_at) continue;
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

export function bucketsForCategoryByOwner(
  buckets: Bucket[],
  category: BucketCategory,
  userId: string | undefined,
): Bucket[] {
  return bucketsForCategory(buckets, category)
    .filter(bucket => !userId || bucket.user_id === userId);
}

export function activeBucketIdsInWindow(
  logs: SavingsLog[],
  today?: Date,
): Set<string> {
  const keys = new Set(lastSevenDateKeys(today));
  const ids = new Set<string>();
  for (const log of logs) {
    if (log.bucket_id && keys.has(localDateKey(log.created_at))) {
      ids.add(log.bucket_id);
    }
  }
  return ids;
}
