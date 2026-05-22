import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { BucketTransfer } from '../types';

const LIMIT = 200;

interface RawTransferRow {
  id: string;
  room_id: string;
  user_id: string;
  source_bucket_id: string;
  destination_bucket_id: string;
  amount: string | number;
  note: string | null;
  client_request_id: string;
  created_at: string;
}

function normalize(row: RawTransferRow): BucketTransfer {
  return {
    id: row.id,
    room_id: row.room_id,
    user_id: row.user_id,
    source_bucket_id: row.source_bucket_id,
    destination_bucket_id: row.destination_bucket_id,
    amount: Number(row.amount),
    note: row.note,
    client_request_id: row.client_request_id,
    created_at: row.created_at,
  };
}

export interface UseBucketTransfersResult {
  transfers: BucketTransfer[];
  loading: boolean;
  error: string | null;
  upsertTransfer: (transfer: BucketTransfer) => void;
}

/**
 * Read-only access to the current user's bucket transfers in a room.
 *
 * Transfers are owner-only at the RLS layer (`bucket_transfers_select_own`,
 * migration 0058), so this hook returns the caller's own transfers only —
 * which is exactly what is needed to compute transfer-aware balances for
 * own buckets via {@link bucketSaved}. Partner bucket balances continue
 * to display deposit-only totals because partner transfers are not
 * visible to co-members in this slice.
 *
 * Realtime: subscribes to inserts on `bucket_transfers` filtered to the
 * active room. Transfers are append-only so update/delete events should
 * not occur from normal app flows, but the channel is still wired
 * defensively to refetch on any change.
 */
export function useBucketTransfers(roomId: string | null): UseBucketTransfersResult {
  const { user } = useAuth();
  const userId = user?.id;
  const [transfers, setTransfers] = useState<BucketTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsertTransfer = useCallback((transfer: BucketTransfer) => {
    setTransfers(prev => {
      const existing = prev.find(t => t.id === transfer.id);
      if (existing) {
        return prev.map(t => t.id === transfer.id ? transfer : t);
      }
      return [transfer, ...prev].slice(0, LIMIT);
    });
  }, []);

  useEffect(() => {
    if (!roomId || !userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTransfers([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchTransfers() {
      const { data, error: err } = await supabase
        .from('bucket_transfers')
        .select('id, room_id, user_id, source_bucket_id, destination_bucket_id, amount, note, client_request_id, created_at')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(LIMIT);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setTransfers(((data ?? []) as RawTransferRow[]).map(normalize));
      setError(null);
      setLoading(false);
    }

    setLoading(true);
    void fetchTransfers();

    const channelId = `bucket-transfers:${roomId}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bucket_transfers', filter: `room_id=eq.${roomId}` },
        payload => {
          if (cancelled) return;
          if (payload.eventType === 'INSERT') {
            const row = payload.new as RawTransferRow;
            // RLS already scopes selects to user_id = auth.uid(), but
            // realtime payloads can include rows that would have been
            // filtered on read. Drop anything not owned by the caller.
            if (row.user_id !== userId) return;
            upsertTransfer(normalize(row));
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as RawTransferRow;
            if (row.user_id !== userId) return;
            setTransfers(prev => prev.map(t => t.id === row.id ? normalize(row) : t));
          }
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string };
            if (!oldRow?.id) return;
            setTransfers(prev => prev.filter(t => t.id !== oldRow.id));
          }
        },
      )
      .on('system', {}, evt => {
        if ((evt as { status?: string }).status === 'SUBSCRIBED') void fetchTransfers();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, upsertTransfer, userId]);

  return { transfers, loading, error, upsertTransfer };
}
