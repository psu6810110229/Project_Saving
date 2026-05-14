import { useCallback, useEffect, useState } from 'react';
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

  const fetchGoal = useCallback(async () => {
    if (!user || !roomId) {
      setGoal(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('room_id', roomId)
      .maybeSingle();

    if (err) setError(err.message);
    else setGoal(data ? { ...data, target_amount: Number(data.target_amount) } : null);
    setLoading(false);
  }, [user, roomId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGoal();

    if (!user || !roomId) return;

    const channel = supabase.channel(`goal:${roomId}-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals', filter: `room_id=eq.${roomId}` },
        payload => {
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<Goal>;
          if (row.user_id !== user.id) return;
          void fetchGoal();
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchGoal, roomId, user]);

  async function save(values: SaveValues): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };
    if (!roomId) return { error: 'No active room' };
    const { error: err } = await supabase
      .from('goals')
      .upsert(
        { user_id: user.id, room_id: roomId, ...values, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,room_id' }
      );
    if (err) return { error: goalSaveErrorMessage(err.message) };
    setGoal({ user_id: user.id, room_id: roomId, ...values, updated_at: new Date().toISOString() });
    return {};
  }

  async function saveRoomGoal(values: Omit<SaveValues, 'start_date'>): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };
    if (!roomId) return { error: 'No active room' };

    const { error: err } = await supabase.rpc('update_room_goal', {
      p_room_id: roomId,
      p_target_amount: values.target_amount,
      p_end_date: values.end_date,
    });
    if (err) return { error: err.message };

    const nextGoal: Goal = {
      user_id: user.id,
      room_id: roomId,
      target_amount: values.target_amount,
      start_date: goal?.start_date ?? new Date().toISOString().slice(0, 10),
      end_date: values.end_date,
      updated_at: new Date().toISOString(),
    };
    setGoal(nextGoal);
    return {};
  }

  return { goal, loading, error, save, saveRoomGoal, refetch: fetchGoal };
}

function goalSaveErrorMessage(message: string): string {
  if (message.toLowerCase().includes('bucket targets exceed new goal target')) {
    return 'Main goal cannot be lower than existing bucket targets.';
  }
  return message;
}
