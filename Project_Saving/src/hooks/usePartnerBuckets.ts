import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Bucket } from '../types';

export interface UsePartnerBucketsResult {
  buckets: Bucket[];
  loading: boolean;
}

/**
 * Fetches the partner's bucket plan for the active room (read-only).
 * Requires migration 0019 which extends the buckets SELECT policy to
 * any co-member of the same room. Without 0019 the result will simply
 * be an empty list (RLS-filtered), so the segmented Partner tab will
 * render an empty state instead of throwing.
 *
 * Edits are NOT allowed from this hook — INSERT/UPDATE/DELETE policies
 * on buckets remain scoped to the owning user, so the Dashboard's
 * Partner tab is render-only by construction.
 */
export function usePartnerBuckets(roomId: string | null, partnerUserId: string | null | undefined): UsePartnerBucketsResult {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!roomId || !partnerUserId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBuckets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('buckets')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', partnerUserId)
      .order('position', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setBuckets((data ?? []) as Bucket[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, partnerUserId]);

  return { buckets, loading };
}
