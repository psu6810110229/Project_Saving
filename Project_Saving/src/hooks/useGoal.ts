import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Goal } from '../types';

interface SaveValues {
  target_amount: number;
  start_date: string;
  end_date: string;
}

export function useGoal() {
  const { user } = useAuth();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setGoal(null); setLoading(false); return; }
    supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setGoal(data ? { ...data, target_amount: Number(data.target_amount) } : null);
        setLoading(false);
      });
  }, [user]);

  async function save(values: SaveValues): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };
    const { error: err } = await supabase
      .from('goals')
      .upsert({ user_id: user.id, ...values, updated_at: new Date().toISOString() });
    if (err) return { error: err.message };
    setGoal({ user_id: user.id, ...values, updated_at: new Date().toISOString() });
    return {};
  }

  return { goal, loading, error, save };
}
