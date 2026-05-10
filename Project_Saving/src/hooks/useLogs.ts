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

export function useLogs(limit = 30) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SavingsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cooldown = useRef(false);

  useEffect(() => {
    supabase
      .from('savings_logs')
      .select('id, user_id, amount, note, created_at, profiles(display_name)')
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); }
        else {
          setLogs((data ?? []).map(row => ({
            id: row.id,
            user_id: row.user_id,
            amount: Number(row.amount),
            note: row.note,
            created_at: row.created_at,
            display_name: extractDisplayName(row.profiles as RawProfile),
          })));
        }
        setLoading(false);
      });
  }, [limit]);

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

    const { data, error: err } = await supabase
      .from('savings_logs')
      .insert({ id: tempId, user_id: user.id, amount, note: note ?? null })
      .select('id, user_id, amount, note, created_at, profiles(display_name)')
      .single();

    if (err) {
      setLogs(prev => prev.filter(l => l.id !== tempId));
      return { error: err.message };
    }

    const confirmed: SavingsLog = {
      id: data.id,
      user_id: data.user_id,
      amount: Number(data.amount),
      note: data.note,
      created_at: data.created_at,
      display_name: extractDisplayName(data.profiles as RawProfile),
    };
    setLogs(prev => prev.map(l => l.id === tempId ? confirmed : l));
    return {};
  }

  return { logs, setLogs, loading, error, insert };
}
