import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Goal } from '../types';

interface SaveValues {
  target_amount: number;
  start_date: string;
  end_date: string;
}

export function useGoal(roomId: string | null = null) {
  const { user } = useAuth();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !roomId) { setGoal(null); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('room_id', roomId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setGoal(data ? { ...data, target_amount: Number(data.target_amount) } : null);
        setLoading(false);
      });
  }, [user, roomId]);

  async function save(values: SaveValues): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };
    if (!roomId) return { error: 'No active room' };
    const { error: err } = await supabase
      .from('goals')
      .upsert(
        { user_id: user.id, room_id: roomId, ...values, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,room_id' }
      );
    if (err) return { error: err.message };
    setGoal({ user_id: user.id, room_id: roomId, ...values, updated_at: new Date().toISOString() });
    return {};
  }

  return { goal, loading, error, save };
}
