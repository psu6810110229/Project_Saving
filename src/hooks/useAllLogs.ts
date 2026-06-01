import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { SavingsLog } from '../types';

const CAP = 500;
type RawRoomLogRow = {
  id: string;
  user_id: string;
  amount: string | number;
  note: string | null;
  created_at: string;
  room_id: string;
  bucket_id: string | null;
  slip_url: string | null;
  display_name?: string | null;
  bucket_name?: string | null;
};

export function useAllLogs(roomId: string | null = null) {
  const [logs, setLogs] = useState<SavingsLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchLogs() {
    if (!roomId) { setLogs([]); setLoading(false); return; }
    const { data, error } = await supabase.rpc('room_savings_logs_for_room', {
      p_room_id: roomId,
    });

    if (error) return;
    setLogs(((data ?? []) as RawRoomLogRow[]).slice(0, CAP).map(row => {
      return {
        id: row.id,
        user_id: row.user_id,
        room_id: row.room_id,
        amount: Number(row.amount),
        note: row.note,
        created_at: row.created_at,
        display_name: row.display_name ?? undefined,
        bucket_id: row.bucket_id ?? undefined,
        bucket_name: row.bucket_name ?? undefined,
        slip_url: row.slip_url,
      };
    }));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchLogs().then(() => setLoading(false));

    if (!roomId) return;

    const channelId = `all-logs-popup:${roomId}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_logs', filter: `room_id=eq.${roomId}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as SavingsLog;
            setLogs(prev => {
              const exists = prev.some(l => l.id === row.id);
              if (exists) return prev.map(l => l.id === row.id ? { ...l, ...row, amount: Number(row.amount) } : l);
              return [{ ...row, amount: Number(row.amount) }, ...prev].slice(0, CAP);
            });
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as SavingsLog;
            setLogs(prev => prev.map(l => l.id === row.id ? { ...l, ...row, amount: Number(row.amount) } : l));
          }
          if (payload.eventType === 'DELETE') {
            setLogs(prev => prev.filter(l => l.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { logs, loading };
}
