import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { SavingsLog } from '../types';

type RawProfile = { display_name: string } | { display_name: string }[] | null;

function extractDisplayName(profiles: RawProfile): string | undefined {
  if (!profiles) return undefined;
  if (Array.isArray(profiles)) return profiles[0]?.display_name;
  return profiles.display_name;
}

const LIMIT = 100;

export function useLogs(limit = 30) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SavingsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cooldown = useRef(false);

  async function fetchLogs() {
    const { data, error: err } = await supabase
      .from('savings_logs')
      .select('id, user_id, amount, note, created_at, profiles!savings_logs_user_id_fkey(display_name)')
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    if (err) { setError(err.message); return; }
    setLogs((data ?? []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      amount: Number(row.amount),
      note: row.note,
      created_at: row.created_at,
      display_name: extractDisplayName(row.profiles as RawProfile),
    })));
  }

  useEffect(() => {
    fetchLogs().then(() => setLoading(false));

    const channel = supabase
      .channel('public:savings_logs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_logs' },
        payload => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as SavingsLog;
            setLogs(prev => {
              // Replace optimistic temp row if id matches, otherwise prepend
              const exists = prev.some(l => l.id === row.id);
              if (exists) {
                return prev.map(l => l.id === row.id
                  ? { ...l, ...row, amount: Number(row.amount) }
                  : l
                );
              }
              return [{ ...row, amount: Number(row.amount) }, ...prev].slice(0, LIMIT);
            });
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as SavingsLog;
            setLogs(prev => prev.map(l =>
              l.id === row.id ? { ...l, ...row, amount: Number(row.amount) } : l
            ));
          }
          if (payload.eventType === 'DELETE') {
            setLogs(prev => prev.filter(l => l.id !== payload.old.id));
          }
        }
      )
      .on('system', {}, evt => {
        // Re-fetch on reconnect to fill any gaps missed during disconnect
        if ((evt as { status?: string }).status === 'SUBSCRIBED') fetchLogs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  async function insert(amount: number, note?: string): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };
    if (cooldown.current) return {};
    cooldown.current = true;
    setTimeout(() => { cooldown.current = false; }, 300);

    const tempId = crypto.randomUUID();
    const tempLog: SavingsLog = {
      id: tempId,
      user_id: user.id,
      amount,
      note: note ?? null,
      created_at: new Date().toISOString(),
      display_name: undefined,
    };

    setLogs(prev => [tempLog, ...prev]);

    const { error: err } = await supabase
      .from('savings_logs')
      .insert({ id: tempId, user_id: user.id, amount, note: note ?? null });

    if (err) {
      setLogs(prev => prev.filter(l => l.id !== tempId));
      return { error: err.message };
    }
    // Realtime echo will replace the temp row automatically via the subscription
    return {};
  }

  return { logs: logs.slice(0, limit), setLogs, loading, error, insert };
}
