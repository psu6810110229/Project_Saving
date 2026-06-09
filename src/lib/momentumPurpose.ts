import type { BalanceAllocation, Bucket, BucketCategory, BucketTransfer, RoomVisibleMomentumFlow, SavingsLog } from '../types';
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
  positiveAmount?: number;
  negativeAmount?: number;
  hasAdjustment?: boolean;
  hasNegativeAdjustment?: boolean;
  adjustmentAmount?: number;
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

export function purposeNetDailySeries(
  logs: SavingsLog[],
  scope: MomentumPurposeScope,
  visibleBucketsById: Map<string, Bucket>,
  userId: string | undefined,
  transfers: BucketTransfer[] = [],
  allocations: BalanceAllocation[] = [],
  today?: Date,
): number[] {
  const keys = lastSevenDateKeys(today);
  const indexByKey = new Map(keys.map((key, index) => [key, index]));
  const series = keys.map(() => 0);

  for (const log of logs) {
    if (userId && log.user_id !== userId) continue;
    if (!bucketMatchesScope(log.bucket_id, scope, visibleBucketsById)) continue;
    const index = indexByKey.get(localDateKey(log.created_at));
    if (index === undefined) continue;
    series[index] += log.amount;
  }

  for (const transfer of transfers) {
    if (userId && transfer.user_id !== userId) continue;
    const index = indexByKey.get(localDateKey(transfer.created_at));
    if (index === undefined) continue;
    if (bucketMatchesScope(transfer.destination_bucket_id, scope, visibleBucketsById)) {
      series[index] += transfer.amount;
    }
    if (bucketMatchesScope(transfer.source_bucket_id, scope, visibleBucketsById)) {
      series[index] -= transfer.amount;
    }
  }

  for (const allocation of allocations) {
    if (userId && allocation.user_id !== userId) continue;
    if (!bucketMatchesScope(allocation.destination_bucket_id, scope, visibleBucketsById)) continue;
    const index = indexByKey.get(localDateKey(allocation.created_at));
    if (index === undefined) continue;
    series[index] += allocation.amount;
  }

  return series.map(amount => Math.round(amount * 100) / 100);
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
    const marker: MomentumDayMarker = {
      categories: [],
      bucketIds: [],
      bucketNames: [],
    };

    for (const log of filtered) {
      if (userId && log.user_id !== userId) continue;
      if (localDateKey(log.created_at) !== key) continue;
      if (!log.bucket_id) continue;

      addSignedAmountToMarker(marker, log.amount);
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

    marker.categories = BUCKET_CATEGORY_ORDER.filter(cat => categories.has(cat));
    marker.bucketIds = Array.from(buckets.keys());
    marker.bucketNames = Array.from(buckets.values());
    return marker;
  });
}

export function purposeNetDailyMarkers(
  logs: SavingsLog[],
  scope: MomentumPurposeScope,
  visibleBucketsById: Map<string, Bucket>,
  userId: string | undefined,
  transfers: BucketTransfer[] = [],
  allocations: BalanceAllocation[] = [],
  today?: Date,
  options?: PurposeMarkerOptions,
): MomentumDayMarker[] {
  const markers = purposeDailyMarkers(logs, scope, visibleBucketsById, userId, today, options);
  const keys = lastSevenDateKeys(today);
  const indexByKey = new Map(keys.map((key, index) => [key, index]));

  for (const transfer of transfers) {
    if (userId && transfer.user_id !== userId) continue;
    const index = indexByKey.get(localDateKey(transfer.created_at));
    if (index === undefined) continue;

    addBucketToMarker(markers[index], transfer.destination_bucket_id, scope, visibleBucketsById, options, transfer.user_id);
    if (bucketMatchesScope(transfer.destination_bucket_id, scope, visibleBucketsById)) {
      addSignedAmountToMarker(markers[index], transfer.amount);
    }
    addBucketToMarker(markers[index], transfer.source_bucket_id, scope, visibleBucketsById, options, transfer.user_id);
    if (bucketMatchesScope(transfer.source_bucket_id, scope, visibleBucketsById)) {
      addSignedAmountToMarker(markers[index], -transfer.amount);
    }
  }

  for (const allocation of allocations) {
    if (userId && allocation.user_id !== userId) continue;
    if (!bucketMatchesScope(allocation.destination_bucket_id, scope, visibleBucketsById)) continue;
    const index = indexByKey.get(localDateKey(allocation.created_at));
    if (index === undefined) continue;

    const marker = markers[index];
    addSignedAmountToMarker(marker, allocation.amount);
    marker.hasAdjustment = true;
    marker.hasNegativeAdjustment = marker.hasNegativeAdjustment || allocation.amount < 0;
    marker.adjustmentAmount = Math.round(((marker.adjustmentAmount ?? 0) + allocation.amount) * 100) / 100;
    addBucketToMarker(marker, allocation.destination_bucket_id, scope, visibleBucketsById, options, allocation.user_id);
  }

  return markers;
}

export function purposeVisibleFlowDailySeries(
  flows: RoomVisibleMomentumFlow[],
  scope: MomentumPurposeScope,
  visibleBucketsById: Map<string, Bucket>,
  userId?: string,
  today?: Date,
): number[] {
  const keys = lastSevenDateKeys(today);
  const indexByKey = new Map(keys.map((key, index) => [key, index]));
  const series = keys.map(() => 0);

  for (const flow of flows) {
    if (userId && flow.user_id !== userId) continue;
    if (!visibleFlowMatchesScope(flow, scope, visibleBucketsById)) continue;
    const index = indexByKey.get(flow.date_key);
    if (index === undefined) continue;
    series[index] += flow.amount;
  }

  return series.map(amount => Math.round(amount * 100) / 100);
}

export function purposeVisibleFlowDailyMarkers(
  flows: RoomVisibleMomentumFlow[],
  scope: MomentumPurposeScope,
  visibleBucketsById: Map<string, Bucket>,
  userId?: string,
  today?: Date,
  options?: PurposeMarkerOptions,
): MomentumDayMarker[] {
  const keys = lastSevenDateKeys(today);
  const indexByKey = new Map(keys.map((key, index) => [key, index]));
  const markers: MomentumDayMarker[] = keys.map(() => ({
    categories: [] as BucketCategory[],
    bucketIds: [] as string[],
    bucketNames: [] as string[],
  }));

  for (const flow of flows) {
    if (userId && flow.user_id !== userId) continue;
    if (!visibleFlowMatchesScope(flow, scope, visibleBucketsById)) continue;
    const index = indexByKey.get(flow.date_key);
    if (index === undefined) continue;

    const marker = markers[index];
    if (flow.event_kind === 'allocation') {
      marker.hasAdjustment = true;
      marker.hasNegativeAdjustment = marker.hasNegativeAdjustment || flow.amount < 0;
      marker.adjustmentAmount = Math.round(((marker.adjustmentAmount ?? 0) + flow.amount) * 100) / 100;
    }
    addSignedAmountToMarker(marker, flow.amount);
    if (flow.bucket_id) {
      addBucketToMarker(marker, flow.bucket_id, scope, visibleBucketsById, options, flow.user_id);
    }
  }

  return markers;
}

function addSignedAmountToMarker(marker: MomentumDayMarker, amount: number) {
  if (amount > 0) {
    marker.positiveAmount = Math.round(((marker.positiveAmount ?? 0) + amount) * 100) / 100;
  } else if (amount < 0) {
    marker.negativeAmount = Math.round(((marker.negativeAmount ?? 0) + amount) * 100) / 100;
  }
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

function bucketMatchesScope(
  bucketId: string | null | undefined,
  scope: MomentumPurposeScope,
  visibleBucketsById: Map<string, Bucket>,
): boolean {
  if (scope.kind === 'all') return true;
  if (!bucketId) return false;
  if (scope.kind === 'bucket') return bucketId === scope.bucketId;

  const bucket = visibleBucketsById.get(bucketId);
  if (!bucket) return false;
  const category = normalizeBucketCategory(bucket.category);
  if (scope.kind === 'categories') return scope.categories.includes(category);
  return category === scope.category;
}

function visibleFlowMatchesScope(
  flow: Pick<RoomVisibleMomentumFlow, 'bucket_id'>,
  scope: MomentumPurposeScope,
  visibleBucketsById: Map<string, Bucket>,
): boolean {
  if (scope.kind === 'all') return true;
  return bucketMatchesScope(flow.bucket_id, scope, visibleBucketsById);
}

function addBucketToMarker(
  marker: MomentumDayMarker,
  bucketId: string,
  scope: MomentumPurposeScope,
  visibleBucketsById: Map<string, Bucket>,
  options: PurposeMarkerOptions | undefined,
  ownerUserId: string,
) {
  if (!bucketMatchesScope(bucketId, scope, visibleBucketsById)) return;
  const bucket = visibleBucketsById.get(bucketId);
  if (!bucket) return;

  if (!marker.categories.includes(normalizeBucketCategory(bucket.category))) {
    marker.categories = BUCKET_CATEGORY_ORDER.filter(cat => (
      cat === normalizeBucketCategory(bucket.category) || marker.categories.includes(cat)
    ));
  }

  if (
    !options
    || options.revealBucketNamesForUserId === undefined
    || ownerUserId === options.revealBucketNamesForUserId
  ) {
    if (!marker.bucketIds.includes(bucket.id)) marker.bucketIds.push(bucket.id);
    if (!marker.bucketNames.includes(bucket.name)) marker.bucketNames.push(bucket.name);
  }
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

export function availablePurposeCategoriesForModeFromFlows(
  mode: MomentumPurposeMode,
  userBuckets: Bucket[],
  allVisibleBuckets: Bucket[],
  flows: RoomVisibleMomentumFlow[],
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
  for (const flow of flows) {
    if (!flow.bucket_id) continue;
    if (!keys.has(flow.date_key)) continue;
    if (flow.user_id !== userId && flow.user_id !== compareMemberId) continue;

    const bucket = visibleBucketsById.get(flow.bucket_id);
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
