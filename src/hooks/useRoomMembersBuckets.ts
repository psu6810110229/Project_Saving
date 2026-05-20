import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Bucket } from '../types';

export interface UseRoomMembersBucketsResult {
  bucketsByUser: Record<string, Bucket[]>;
  allBuckets: Bucket[];
  loading: boolean;
}

const EMPTY_BUCKETS_BY_USER: Record<string, Bucket[]> = {};
const EMPTY_ALL_BUCKETS: Bucket[] = [];

function memberIdsKey(ids: string[]): string {
  if (ids.length === 0) return '';
  return [...ids].sort().join(',');
}

/**
 * N-safe fetcher for the read-only buckets of every other room member.
 * Returns one entry per id in `otherMemberIds` (empty array if the
 * member has no buckets) plus a flat `allBuckets` list preserving each
 * member's `position asc` order, concatenated in `otherMemberIds` order.
 *
 * Single query via `.in('user_id', otherMemberIds)` — total round-trip
 * cost is O(1) regardless of N. RLS already permits this read for any
 * co-member (migration 0019, `buckets_select_co_member`).
 */
export function useRoomMembersBuckets(
  roomId: string | null,
  otherMemberIds: string[],
): UseRoomMembersBucketsResult {
  const [bucketsByUser, setBucketsByUser] = useState<Record<string, Bucket[]>>(EMPTY_BUCKETS_BY_USER);
  const [allBuckets, setAllBuckets] = useState<Bucket[]>(EMPTY_ALL_BUCKETS);
  const [loading, setLoading] = useState(false);

  const idsKey = useMemo(() => memberIdsKey(otherMemberIds), [otherMemberIds]);

  useEffect(() => {
    if (!roomId || otherMemberIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBucketsByUser(EMPTY_BUCKETS_BY_USER);
      setAllBuckets(EMPTY_ALL_BUCKETS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Stale-data reset: clear before fetching so a room switch does
    // not briefly show the previous room's data.
    setBucketsByUser(EMPTY_BUCKETS_BY_USER);
    setAllBuckets(EMPTY_ALL_BUCKETS);
    setLoading(true);

    supabase
      .from('buckets')
      .select('*')
      .eq('room_id', roomId)
      .in('user_id', otherMemberIds)
      .order('position', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          if (typeof console !== 'undefined') {
            console.warn('[useRoomMembersBuckets] fetch failed', error.message);
          }
          // Inputs changed (we already reset above): leave maps empty.
          // No `error` field on this hook — matches today's
          // UsePartnerBucketsResult resilience shape.
          setLoading(false);
          return;
        }

        // Seed every requested id so consumers can write
        // `bucketsByUser[id].length` without an undefined check.
        const seeded: Record<string, Bucket[]> = {};
        for (const id of otherMemberIds) {
          seeded[id] = [];
        }

        const rows = (data ?? []) as Bucket[];
        for (const row of rows) {
          const arr = seeded[row.user_id];
          if (arr) arr.push(row);
          // Rows for ids not in otherMemberIds are dropped (defensive;
          // the .in() filter should already exclude them).
        }

        // Build allBuckets by iterating otherMemberIds (do NOT rely on
        // Object.values order to match input order).
        const flat: Bucket[] = [];
        for (const id of otherMemberIds) {
          const arr = seeded[id];
          if (arr) flat.push(...arr);
        }

        setBucketsByUser(seeded);
        setAllBuckets(flat);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // idsKey collapses content-equal arrays so a new array identity
    // with the same ids does not trigger a re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, idsKey]);

  return { bucketsByUser, allBuckets, loading };
}
