import type { Bucket, BucketFocusState, BucketIntentSettings, BucketTransfer, SavingsLog } from '../types';
import { BUCKET_CATEGORY_META } from './bucketCategories';
import { bucketSaved } from './buckets';
import { calcBucketFocusStates } from './bucketFocus';

export type BucketIntentStatus = 'focus' | 'next' | 'done';
export type BucketIntentSource = 'manual' | 'behavior' | 'category_order' | 'deadline' | 'none';

export interface BucketIntentResult {
  focusBucketId: string | null;
  nextBucketId: string | null;
  doneBucketIds: Set<string>;
  focusStates: Map<string, BucketFocusState>;
  confidence: {
    focus: number;
    next: number;
  };
  source: {
    focus: BucketIntentSource;
    next: BucketIntentSource;
  };
}

export interface BucketIntentInput {
  buckets: Bucket[];
  logs: SavingsLog[];
  transfers?: BucketTransfer[];
  currentUserId?: string;
  settings?: BucketIntentSettings | null;
}

const EMPTY: BucketIntentResult = {
  focusBucketId: null,
  nextBucketId: null,
  doneBucketIds: new Set<string>(),
  focusStates: new Map<string, BucketFocusState>(),
  confidence: { focus: 0, next: 0 },
  source: { focus: 'none', next: 'none' },
};

export function computeBucketIntent(input: BucketIntentInput): BucketIntentResult {
  const { buckets, logs, transfers = [], currentUserId, settings } = input;

  const active = buckets.filter(b => b.archived_at == null);
  if (active.length === 0) return EMPTY;

  const hasAnyDeadline = active.some(b => b.deadline);

  if (hasAnyDeadline) {
    return computeDeadlineAwareIntent(active, logs, transfers, settings);
  }

  return computeLegacyIntent(active, logs, transfers, currentUserId, settings);
}

function computeDeadlineAwareIntent(
  active: Bucket[],
  logs: SavingsLog[],
  transfers: BucketTransfer[],
  settings?: BucketIntentSettings | null,
): BucketIntentResult {
  const focusStates = calcBucketFocusStates(active, logs, undefined, transfers);

  const withoutDeadline = active.filter(b => !b.deadline);

  for (const b of withoutDeadline) {
    const saved = bucketSaved(b.id, logs, transfers);
    if (b.target_amount > 0 && saved >= b.target_amount) {
      focusStates.set(b.id, 'done');
    } else if (!focusStates.has(b.id)) {
      focusStates.set(b.id, 'queued');
    }
  }

  const doneIds = new Set<string>();
  let focusBucketId: string | null = null;
  let nextBucketId: string | null = null;

  for (const [id, state] of focusStates) {
    if (state === 'done') doneIds.add(id);
    if (state === 'focus' || state === 'overdue') {
      if (!focusBucketId) focusBucketId = id;
    }
    if (state === 'next' && !nextBucketId) nextBucketId = id;
  }

  if (settings?.manual_next_bucket_id) {
    const manualId = settings.manual_next_bucket_id;
    if (focusStates.has(manualId) && !doneIds.has(manualId) && manualId !== focusBucketId) {
      nextBucketId = manualId;
    }
  }

  return {
    focusBucketId,
    nextBucketId,
    doneBucketIds: doneIds,
    focusStates,
    confidence: { focus: 100, next: nextBucketId ? 100 : 0 },
    source: { focus: 'deadline', next: nextBucketId ? 'deadline' : 'none' },
  };
}

function computeLegacyIntent(
  active: Bucket[],
  logs: SavingsLog[],
  transfers: BucketTransfer[],
  currentUserId?: string,
  settings?: BucketIntentSettings | null,
): BucketIntentResult {
  const activeIds = new Set(active.map(b => b.id));

  const doneIds = new Set<string>();
  for (const b of active) {
    if (b.target_amount > 0 && bucketSaved(b.id, logs, transfers) >= b.target_amount) {
      doneIds.add(b.id);
    }
  }

  const focusResult = computeFocus(active, doneIds, logs, currentUserId);
  const nextResult = computeNext(active, doneIds, focusResult.id, activeIds, settings);

  const focusStates = new Map<string, BucketFocusState>();
  for (const b of active) {
    if (doneIds.has(b.id)) {
      focusStates.set(b.id, 'done');
    } else if (b.id === focusResult.id) {
      focusStates.set(b.id, 'focus');
    } else if (b.id === nextResult.id) {
      focusStates.set(b.id, 'next');
    } else {
      focusStates.set(b.id, 'queued');
    }
  }

  return {
    focusBucketId: focusResult.id,
    nextBucketId: nextResult.id,
    doneBucketIds: doneIds,
    focusStates,
    confidence: {
      focus: focusResult.confidence,
      next: nextResult.confidence,
    },
    source: {
      focus: focusResult.source,
      next: nextResult.source,
    },
  };
}

interface FocusResult {
  id: string | null;
  confidence: number;
  source: BucketIntentSource;
}

function computeFocus(
  active: Bucket[],
  doneIds: Set<string>,
  logs: SavingsLog[],
  currentUserId?: string,
): FocusResult {
  const none: FocusResult = { id: null, confidence: 0, source: 'none' };

  const candidates = active.filter(b => !doneIds.has(b.id));
  if (candidates.length === 0) return none;

  const ownRecent = logs
    .filter(
      l =>
        l.user_id === currentUserId &&
        l.amount > 0 &&
        l.bucket_id != null &&
        active.some(b => b.id === l.bucket_id),
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  if (ownRecent.length < 2) return none;

  const last5 = ownRecent.slice(0, 5);
  const totalAmountLast10 = ownRecent.reduce((s, l) => s + l.amount, 0);
  const latestBucketId = ownRecent[0]?.bucket_id;

  let bestId: string | null = null;
  let bestScore = -Infinity;

  for (const c of candidates) {
    const countIn5 = last5.filter(l => l.bucket_id === c.id).length;
    const amountIn10 = ownRecent.filter(l => l.bucket_id === c.id).reduce((s, l) => s + l.amount, 0);

    let score = 0;
    score += (countIn5 / last5.length) * 60;
    score += totalAmountLast10 > 0 ? (amountIn10 / totalAmountLast10) * 20 : 0;
    if (latestBucketId === c.id) score += 10;
    if ((c.category_confidence ?? 100) >= 80) score += 5;
    if ((c.category_confidence ?? 100) < 70) score -= 15;
    if (c.category === 'other') score -= 20;

    if (score > bestScore) {
      bestScore = score;
      bestId = c.id;
    }
  }

  if (bestId == null || bestScore < 65) return none;

  return {
    id: bestId,
    confidence: Math.round(Math.min(100, bestScore)),
    source: 'behavior',
  };
}

interface NextResult {
  id: string | null;
  confidence: number;
  source: BucketIntentSource;
}

function computeNext(
  active: Bucket[],
  doneIds: Set<string>,
  focusBucketId: string | null,
  activeIds: Set<string>,
  settings?: BucketIntentSettings | null,
): NextResult {
  const none: NextResult = { id: null, confidence: 0, source: 'none' };

  if (
    settings?.manual_next_bucket_id &&
    activeIds.has(settings.manual_next_bucket_id) &&
    !doneIds.has(settings.manual_next_bucket_id) &&
    settings.manual_next_bucket_id !== focusBucketId
  ) {
    return {
      id: settings.manual_next_bucket_id,
      confidence: 100,
      source: 'manual',
    };
  }

  const hasFocus = focusBucketId != null;
  const hasDone = doneIds.size > 0;
  if (!hasFocus && !hasDone) return none;

  const candidates = active.filter(
    b => !doneIds.has(b.id) && b.id !== focusBucketId && (b.category_confidence ?? 100) >= 70,
  );
  if (candidates.length === 0) return none;

  candidates.sort((a, b) => {
    const metaA = BUCKET_CATEGORY_META[a.category ?? 'other'];
    const metaB = BUCKET_CATEGORY_META[b.category ?? 'other'];
    const prioA = metaA?.defaultPriority ?? 80;
    const prioB = metaB?.defaultPriority ?? 80;
    if (prioA !== prioB) return prioA - prioB;
    if (a.position !== b.position) return a.position - b.position;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return {
    id: candidates[0].id,
    confidence: 70,
    source: 'category_order',
  };
}
