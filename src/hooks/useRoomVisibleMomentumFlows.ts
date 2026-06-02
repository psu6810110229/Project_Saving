import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { RoomVisibleMomentumFlow } from '../types';

interface RawRoomVisibleMomentumFlowRow {
  user_id: string;
  bucket_id: string | null;
  date_key: string;
  amount: string | number;
  event_kind: RoomVisibleMomentumFlow['event_kind'];
}

export interface UseRoomVisibleMomentumFlowsResult {
  flows: RoomVisibleMomentumFlow[];
  loading: boolean;
  error: string | null;
  addOptimisticFlow: (flow: RoomVisibleMomentumFlow) => void;
  refetch: () => Promise<void>;
}

/**
 * Room-visible daily bucket movements for Team momentum charts.
 *
 * Data comes from the sanitized `room_visible_momentum_flows` RPC, which
 * aggregates deposits, transfers, and balance allocations into simple
 * per-day per-bucket rows without exposing raw private ledger details.
 */
export function useRoomVisibleMomentumFlows(roomId: string | null): UseRoomVisibleMomentumFlowsResult {
  const [flows, setFlows] = useState<RoomVisibleMomentumFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addOptimisticFlow = useCallback((flow: RoomVisibleMomentumFlow) => {
    setFlows(prev => {
      const index = prev.findIndex(item => (
        item.user_id === flow.user_id
        && item.bucket_id === flow.bucket_id
        && item.date_key === flow.date_key
        && item.event_kind === flow.event_kind
      ));
      if (index === -1) return [flow, ...prev];
      return prev.map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, amount: Math.round((item.amount + flow.amount) * 100) / 100 }
          : item
      ));
    });
  }, []);

  const fetchFlows = useCallback(async () => {
    if (!roomId) {
      setFlows([]);
      setLoading(false);
      setError(null);
      return;
    }

    const { data, error: err } = await supabase.rpc('room_visible_momentum_flows', {
      p_room_id: roomId,
      p_days: 7,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setFlows(((data ?? []) as RawRoomVisibleMomentumFlowRow[]).map(row => ({
      user_id: row.user_id,
      bucket_id: row.bucket_id,
      date_key: row.date_key,
      amount: Number(row.amount),
      event_kind: row.event_kind,
    })));
    setError(null);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFlows([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    void fetchFlows();

    const channelId = `room-visible-momentum:${roomId}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_logs', filter: `room_id=eq.${roomId}` },
        () => { if (!cancelled) void fetchFlows(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bucket_transfers', filter: `room_id=eq.${roomId}` },
        () => { if (!cancelled) void fetchFlows(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'balance_allocations', filter: `room_id=eq.${roomId}` },
        () => { if (!cancelled) void fetchFlows(); },
      )
      .on('system', {}, evt => {
        if ((evt as { status?: string }).status === 'SUBSCRIBED' && !cancelled) {
          void fetchFlows();
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [fetchFlows, roomId]);

  return { flows, loading, error, addOptimisticFlow, refetch: fetchFlows };
}
