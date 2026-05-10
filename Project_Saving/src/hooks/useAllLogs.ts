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

export function useAllLogs() {
  const [logs, setLogs] = useState<SavingsLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchLogs() {
    const { data, error } = await supabase
      .from('savings_logs')
      .select('id, user_id, amount, note, created_at, profiles!savings_logs_user_id_fkey(display_name)')
      .order('created_at', { ascending: false })
      .limit(CAP);

    if (error) return;
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
      .channel('all-logs-popup')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_logs' },
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { logs, loading };
}
