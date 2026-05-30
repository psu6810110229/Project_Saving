import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { BalanceAllocation } from '../types';

const LIMIT = 200;

interface RawAllocationRow {
  id: string;
  room_id: string;
  user_id: string;
  destination_bucket_id: string;
  amount: string | number;
  client_request_id: string;
  created_at: string;
}

function normalize(row: RawAllocationRow): BalanceAllocation {
  return {
    id: row.id,
    room_id: row.room_id,
    user_id: row.user_id,
    destination_bucket_id: row.destination_bucket_id,
    amount: Number(row.amount),
    client_request_id: row.client_request_id,
    created_at: row.created_at,
  };
}

export interface UseBalanceAllocationsResult {
  allocations: BalanceAllocation[];
  loading: boolean;
  error: string | null;
  upsertAllocation: (allocation: BalanceAllocation) => void;
  /** Re-pull the ledger from the server (after an allocate / write-down). */
  refetch: () => Promise<void>;
}

/**
 * Read-only access to the current user's balance allocations in a room.
 *
 * Allocations move unallocated reconcile surplus into the owner's own
 * buckets. They are owner-only at the RLS layer
 * (`balance_allocations_select_own`, migration 0078), so this hook
 * returns the caller's own allocations only — exactly what
 * {@link bucketSaved} needs to render allocation-aware balances for own
 * buckets. Partner bucket balances stay deposit-only.
 *
 * Mirrors {@link useBucketTransfers}: append-only ledger with a realtime
 * insert subscription scoped to the active room.
 */
export function useBalanceAllocations(roomId: string | null): UseBalanceAllocationsResult {
  const { user } = useAuth();
  const userId = user?.id;
  const [allocations, setAllocations] = useState<BalanceAllocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsertAllocation = useCallback((allocation: BalanceAllocation) => {
    setAllocations(prev => {
      const existing = prev.find(a => a.id === allocation.id);
      if (existing) {
        return prev.map(a => a.id === allocation.id ? allocation : a);
      }
      return [allocation, ...prev].slice(0, LIMIT);
    });
  }, []);

  // Authoritative re-pull. Exposed as `refetch` and used after writes so
  // bucket balances update immediately without depending on the realtime
  // subscription (which requires the table to be in the publication).
  const fetchAllocations = useCallback(async () => {
    if (!roomId || !userId) {
      setAllocations([]);
      setLoading(false);
      setError(null);
      return;
    }
    const { data, error: err } = await supabase
      .from('balance_allocations')
      .select('id, room_id, user_id, destination_bucket_id, amount, client_request_id, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setAllocations(((data ?? []) as RawAllocationRow[]).map(normalize));
    setError(null);
    setLoading(false);
  }, [roomId, userId]);

  useEffect(() => {
    if (!roomId || !userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAllocations([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    void fetchAllocations();

    const channelId = `balance-allocations:${roomId}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'balance_allocations', filter: `room_id=eq.${roomId}` },
        payload => {
          if (cancelled) return;
          if (payload.eventType === 'INSERT') {
            const row = payload.new as RawAllocationRow;
            // RLS already scopes selects to user_id = auth.uid(), but
            // realtime payloads can include rows that would have been
            // filtered on read. Drop anything not owned by the caller.
            if (row.user_id !== userId) return;
            upsertAllocation(normalize(row));
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as RawAllocationRow;
            if (row.user_id !== userId) return;
            setAllocations(prev => prev.map(a => a.id === row.id ? normalize(row) : a));
          }
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string };
            if (!oldRow?.id) return;
            setAllocations(prev => prev.filter(a => a.id !== oldRow.id));
          }
        },
      )
      .on('system', {}, evt => {
        if ((evt as { status?: string }).status === 'SUBSCRIBED') void fetchAllocations();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, upsertAllocation, userId, fetchAllocations]);

  return { allocations, loading, error, upsertAllocation, refetch: fetchAllocations };
}
