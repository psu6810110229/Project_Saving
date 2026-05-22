import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

/** Bucket-scoped event keys served by this hook. */
export type BucketActivityEventKey = 'bucket_transfer_created' | 'bucket_removed';

/**
 * One row from `public.activity_events` filtered to bucket transfer /
 * remove events. Server-written via the RPCs in migration 0059; RLS in
 * 0058 restricts SELECT to room members so partners read the same
 * sanitized payload the actor wrote. Transfer notes are never present
 * here — owners read the raw text from `bucket_transfers`.
 */
export interface BucketActivityEvent {
  id: string;
  room_id: string;
  actor_user_id: string | null;
  event_key: BucketActivityEventKey;
  source_table: string | null;
  source_id: string | null;
  bucket_id: string | null;
  target_bucket_id: string | null;
  amount: number | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface UseBucketActivityEventsResult {
  events: BucketActivityEvent[];
  loading: boolean;
  error: string | null;
}

const LIMIT = 100;

interface RawRow {
  id: string;
  room_id: string;
  actor_user_id: string | null;
  event_key: string;
  source_table: string | null;
  source_id: string | null;
  bucket_id: string | null;
  target_bucket_id: string | null;
  amount: string | number | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

function normalize(row: RawRow): BucketActivityEvent {
  return {
    id: row.id,
    room_id: row.room_id,
    actor_user_id: row.actor_user_id,
    event_key: row.event_key as BucketActivityEventKey,
    source_table: row.source_table,
    source_id: row.source_id,
    bucket_id: row.bucket_id,
    target_bucket_id: row.target_bucket_id,
    amount: row.amount == null ? null : Number(row.amount),
    payload: row.payload ?? {},
    created_at: row.created_at,
  };
}

/**
 * Returns recent bucket transfer and remove activity for the active
 * room. Realtime subscribes to inserts on `activity_events` so the
 * Dashboard feed and the History modal update without a full refetch
 * after a transfer or archive lands.
 */
export function useBucketActivityEvents(roomId: string | null): UseBucketActivityEventsResult {
  const { user } = useAuth();
  const userId = user?.id;
  const [events, setEvents] = useState<BucketActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvents([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchEvents() {
      const { data, error: err } = await supabase
        .from('activity_events')
        .select('id, room_id, actor_user_id, event_key, source_table, source_id, bucket_id, target_bucket_id, amount, payload, created_at')
        .eq('room_id', roomId)
        .in('event_key', ['bucket_transfer_created', 'bucket_removed'])
        .order('created_at', { ascending: false })
        .limit(LIMIT);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setEvents(((data ?? []) as RawRow[]).map(normalize));
      setError(null);
      setLoading(false);
    }

    setLoading(true);
    void fetchEvents();

    const channelId = `activity-events:${roomId}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_events', filter: `room_id=eq.${roomId}` },
        payload => {
          if (cancelled) return;
          const row = payload.new as RawRow;
          if (row.event_key !== 'bucket_transfer_created' && row.event_key !== 'bucket_removed') return;
          setEvents(prev => {
            if (prev.some(e => e.id === row.id)) return prev;
            return [normalize(row), ...prev].slice(0, LIMIT);
          });
        },
      )
      .on('system', {}, evt => {
        if ((evt as { status?: string }).status === 'SUBSCRIBED') void fetchEvents();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  return { events, loading, error };
}
