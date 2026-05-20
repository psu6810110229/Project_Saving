import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface UseRoomOtherMemberIdsResult {
  memberIds: string[];
  loading: boolean;
}

interface RawMemberRow {
  user_id: string;
  joined_at: string;
}

/**
 * Returns the user_ids of every current room member except the caller,
 * sorted by `joined_at asc` so the order is stable and independent of
 * leaderboard rank.
 *
 * Null-input contract: if either `roomId` or `myUserId` is missing, the
 * hook MUST return `{ memberIds: [], loading: false }` and issue NO
 * query. Fetching `room_members` without a known caller id would
 * surface every member (including the eventual caller) as "other".
 *
 * Note: today's legacy `partnerEntry` derivation in DataContext picks
 * the first non-self leaderboard entry, which is non-deterministic at
 * N ≥ 3 because leaderboard ordering depends on saved amount. The
 * single-partner UI surface is intentionally legacy and is replaced by
 * an N-aware list in slice S4 of the multi-user-rooms audit.
 */
export function useRoomOtherMemberIds(
  roomId: string | null,
  myUserId: string | null | undefined,
): UseRoomOtherMemberIdsResult {
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roomId || !myUserId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMemberIds([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setMemberIds([]);
    setLoading(true);

    async function fetchOtherMembers() {
      // Step 1: direct select. Gated by room_members RLS (migration 0012).
      const { data: directRows, error: directErr } = await supabase
        .from('room_members')
        .select('user_id, joined_at')
        .eq('room_id', roomId);

      if (cancelled) return;

      let rows: RawMemberRow[] = (directRows ?? []) as RawMemberRow[];

      // Step 2: if RLS visibility is incomplete in this environment the
      // direct select can return only the caller's own row. Fall back
      // to the security-definer RPC (migration 0016) which returns
      // every member regardless of policy.
      if (rows.length <= 1) {
        const { data: rpcRows, error: rpcErr } = await supabase.rpc(
          'room_members_for_room',
          { p_room_id: roomId },
        );
        if (cancelled) return;
        if (!rpcErr && rpcRows) {
          const rpcMembers = (rpcRows as RawMemberRow[]).filter(
            r => r && typeof r.user_id === 'string',
          );
          if (rpcMembers.length > rows.length) {
            rows = rpcMembers;
          }
        } else if (rpcErr && directErr && typeof console !== 'undefined') {
          console.warn('[useRoomOtherMemberIds] both direct and RPC reads failed', {
            direct: directErr.message,
            rpc: rpcErr.message,
          });
        }
      }

      if (cancelled) return;

      const sorted = [...rows].sort((a, b) => {
        const ja = a.joined_at ?? '';
        const jb = b.joined_at ?? '';
        if (ja === jb) return 0;
        return ja < jb ? -1 : 1;
      });

      const others = sorted
        .map(r => r.user_id)
        .filter(uid => uid && uid !== myUserId);

      setMemberIds(others);
      setLoading(false);
    }

    void fetchOtherMembers();

    return () => {
      cancelled = true;
    };
  }, [roomId, myUserId]);

  return { memberIds, loading };
}
