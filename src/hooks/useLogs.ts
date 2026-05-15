import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { notifyPartnerDeposit } from '../lib/notifyEvents';
import { useAuth } from './useAuth';
import type { SavingsLog } from '../types';

type RawProfile = { display_name: string } | { display_name: string }[] | null;

function extractDisplayName(profiles: RawProfile): string | undefined {
  if (!profiles) return undefined;
  if (Array.isArray(profiles)) return profiles[0]?.display_name;
  return profiles.display_name;
}

const LIMIT = 100;

export function useLogs(limit = 30, roomId: string | null = null) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SavingsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cooldown = useRef(false);

  async function fetchLogs() {
    if (!roomId) { setLogs([]); setLoading(false); return; }
    const query = supabase
      .from('savings_logs')
      .select('id, user_id, amount, note, created_at, room_id, bucket_id, slip_url, profiles!savings_logs_user_id_fkey(display_name), buckets(name)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    const { data, error: err } = await query;
    if (err) { setError(err.message); return; }
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
        slip_url: row.slip_url,
      };
    }));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchLogs().then(() => setLoading(false));

    if (!roomId) return;

    const channelId = `logs:${roomId}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_logs', filter: `room_id=eq.${roomId}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as SavingsLog;
            setLogs(prev => {
              const exists = prev.some(l => l.id === row.id);
              if (exists) {
                return prev.map(l => l.id === row.id ? { ...l, ...row, amount: Number(row.amount) } : l);
              }
              return [{ ...row, amount: Number(row.amount) }, ...prev].slice(0, LIMIT);
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
      .on('system', {}, evt => {
        if ((evt as { status?: string }).status === 'SUBSCRIBED') fetchLogs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function insert(amount: number, bucketId: string, note?: string, slipUrl?: string | null): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };
    if (!roomId) return { error: 'No active room' };
    if (!bucketId) return { error: 'No bucket selected' };
    if (cooldown.current) return {};
    cooldown.current = true;
    setTimeout(() => { cooldown.current = false; }, 300);

    const tempId = crypto.randomUUID();
    const tempLog: SavingsLog = {
      id: tempId,
      user_id: user.id,
      room_id: roomId,
      amount,
      note: note ?? null,
      created_at: new Date().toISOString(),
      display_name: undefined,
      bucket_id: bucketId,
      slip_url: slipUrl ?? null,
    };

    setLogs(prev => [tempLog, ...prev]);

    const { error: err } = await supabase
      .from('savings_logs')
      .insert({ id: tempId, user_id: user.id, room_id: roomId, bucket_id: bucketId, amount, note: note ?? null, slip_url: slipUrl ?? null });

    if (err) {
      setLogs(prev => prev.filter(l => l.id !== tempId));
      return { error: err.message };
    }
    // Fire-and-forget partner notification. The deposit flow must
    // succeed even if notification creation fails.
    notifyPartnerDeposit(tempId);
    return {};
  }

  return { logs: logs.slice(0, limit), setLogs, loading, error, insert };
}
