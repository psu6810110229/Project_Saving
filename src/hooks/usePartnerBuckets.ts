import { useMemo } from 'react';
import type { Bucket } from '../types';
import { useRoomMembersBuckets } from './useRoomMembersBuckets';

export interface UsePartnerBucketsResult {
  buckets: Bucket[];
  loading: boolean;
}

/**
 * Backward-compatible wrapper preserving today's single-partner shape.
 *
 * Delegates to {@link useRoomMembersBuckets} with a one-element id
 * array so the 2-user case exercises the same code path as the N-user
 * case. The N-aware list surface replaces this wrapper in slice S4 of
 * the multi-user-rooms audit.
 *
 * Returns the partner's buckets sorted by `position asc`, matching the
 * pre-task contract byte-for-byte.
 */
export function usePartnerBuckets(
  roomId: string | null,
  partnerUserId: string | null | undefined,
): UsePartnerBucketsResult {
  const ids = useMemo(
    () => (partnerUserId ? [partnerUserId] : []),
    [partnerUserId],
  );
  const { bucketsByUser, loading } = useRoomMembersBuckets(roomId, ids);
  const buckets = partnerUserId ? (bucketsByUser[partnerUserId] ?? []) : [];
  return { buckets, loading };
}
