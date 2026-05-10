import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { SavingsLog } from '../types';

const CAP = 500;

type RawProfile = { display_name: string } | { display_name: string }[] | null;

function extractDisplayName(profiles: RawProfile): string | undefined {
  if (!profiles) return undefined;
  if (Array.isArray(profiles)) return profiles[0]?.display_name;
  return profiles.display_name;
}

export function useAllLogs(roomId: string | null = null) {
  const [logs, setLogs] = useState<SavingsLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchLogs() {
    if (!roomId) { setLogs([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('savings_logs')
      .select('id, user_id, amount, note, created_at, room_id, bucket_id, profiles!savings_logs_user_id_fkey(display_name), buckets(name)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(CAP);

    if (error) return;
    setLogs((data ?? []).map(row => {
      const rawBucket = row.buckets as { name: string } | { name: string }[] | null;
      const bucket_name = Array.isArray(rawBucket) ? rawBucket[0]?.name : rawBucket?.name;
      return {
        id: row.id,
        user_id: row.user_id,
        room_id: row.room_id,
        amount: Number(row.amount),
        note: row.note,
        created_at: row.created_at,
        display_name: extractDisplayName(row.profiles as RawProfile),
        bucket_id: row.bucket_id ?? undefined,
        bucket_name,
      };
    }));
  }

  useEffect(() => {
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
