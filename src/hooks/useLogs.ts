import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { evaluateSmartEventsAfterDeposit, notifyPartnerDeposit } from '../lib/notifyEvents';
import { useAuth } from './useAuth';
import type { SavingsLog } from '../types';
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

export function useLogs(limit = 30, roomId: string | null = null) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SavingsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cooldown = useRef(false);

  async function fetchLogs() {
    if (!roomId) { setLogs([]); setLoading(false); return; }
    const { data, error: err } = await supabase.rpc('room_savings_logs_for_room', {
      p_room_id: roomId,
    });
    if (err) { setError(err.message); return; }
    setLogs(((data ?? []) as RawRoomLogRow[]).map(row => {
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
              return [{ ...row, amount: Number(row.amount) }, ...prev];
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
    // Fire-and-forget partner notification + smart-event checks.
    // Both helpers swallow errors; the deposit flow must succeed
    // even if notification creation fails.
    notifyPartnerDeposit(tempId);
    evaluateSmartEventsAfterDeposit(tempId);
    return {};
  }

  /**
   * Batch insert for split deposits (sprint 7): write several positive
   * `savings_logs` rows in one operation so a single saved amount can be
   * spread across buckets. All-or-nothing — on failure every optimistic row
   * is rolled back and nothing is persisted (no partial split). Each row gets
   * a stable UUID up front so notification + smart-event side effects fire
   * per inserted log and realtime de-dupes against the optimistic rows.
   */
  async function insertBatch(
    rows: Array<{ amount: number; bucketId: string; note?: string; slipUrl?: string | null }>,
  ): Promise<{ error?: string; ids?: string[] }> {
    if (!user) return { error: 'Not authenticated' };
    if (!roomId) return { error: 'No active room' };
    if (rows.length === 0) return { error: 'No rows to insert' };
    if (rows.some(row => !row.bucketId)) return { error: 'No bucket selected' };
    if (rows.some(row => !(row.amount > 0))) return { error: 'Invalid amount' };

    const createdAt = new Date().toISOString();
    const prepared = rows.map(row => ({
      id: crypto.randomUUID(),
      user_id: user.id,
      room_id: roomId,
      bucket_id: row.bucketId,
      amount: row.amount,
      note: row.note ?? null,
      slip_url: row.slipUrl ?? null,
    }));

    const tempLogs: SavingsLog[] = prepared.map(row => ({
      id: row.id,
      user_id: row.user_id,
      room_id: row.room_id,
      amount: row.amount,
      note: row.note,
      created_at: createdAt,
      display_name: undefined,
      bucket_id: row.bucket_id,
      slip_url: row.slip_url,
    }));

    setLogs(prev => [...tempLogs, ...prev]);

    const { error: err } = await supabase.from('savings_logs').insert(prepared);
    if (err) {
      const tempIds = new Set<string>(prepared.map(row => row.id));
      setLogs(prev => prev.filter(l => !tempIds.has(l.id)));
      return { error: err.message };
    }

    // Per-row side effects (each swallows its own errors). Multiple rows can
    // mean multiple partner notifications — grouping is a separate sprint.
    for (const row of prepared) {
      notifyPartnerDeposit(row.id);
      evaluateSmartEventsAfterDeposit(row.id);
    }
    return { ids: prepared.map(row => row.id) };
  }

  return {
    allLogs: logs,
    logs: logs.slice(0, limit),
    setLogs,
    loading,
    error,
    insert,
    insertBatch,
    refetch: fetchLogs,
  };
}
