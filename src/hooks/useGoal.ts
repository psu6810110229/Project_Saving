import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { notifyGoalChanged } from '../lib/notifyEvents';
import { useAuth } from './useAuth';
import type { Goal } from '../types';

interface SaveRoomGoalValues {
  target_amount: number;
  end_date: string;
}

interface SaveMemberGoalValues {
  target_amount: number;
}

interface RoomGoalState {
  target_amount: number | null;
  end_date: string | null;
}

export function useGoal(roomId: string | null = null) {
  const { user } = useAuth();
  // `personalGoal` is the caller's `goals` row (their personal sub-goal).
  const [personalGoal, setPersonalGoal] = useState<Goal | null>(null);
  const [roomGoal, setRoomGoal] = useState<RoomGoalState>({ target_amount: null, end_date: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoal = useCallback(async () => {
    if (!user || !roomId) {
      setPersonalGoal(null);
      setRoomGoal({ target_amount: null, end_date: null });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [{ data: personalData, error: personalErr }, { data: roomData, error: roomErr }] = await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('room_id', roomId)
        .maybeSingle(),
      supabase
        .from('rooms')
        .select('target_amount, end_date')
        .eq('id', roomId)
        .maybeSingle(),
    ]);

    const err = personalErr ?? roomErr;
    if (err) setError(err.message);
    setPersonalGoal(personalData ? { ...personalData, target_amount: Number(personalData.target_amount) } : null);
    setRoomGoal({
      target_amount: roomData?.target_amount !== null && roomData?.target_amount !== undefined
        ? Number(roomData.target_amount)
        : null,
      end_date: roomData?.end_date ?? null,
    });
    setLoading(false);
  }, [user, roomId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGoal();

    if (!user || !roomId) return;

    const channelId = `goal:${roomId}-${user.id}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals', filter: `room_id=eq.${roomId}` },
        payload => {
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<Goal>;
          if (row.user_id !== user.id) return;
          void fetchGoal();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => { void fetchGoal(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchGoal, roomId, user]);

  async function saveRoomGoal(values: SaveRoomGoalValues): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };
    if (!roomId) return { error: 'No active room' };

    const { error: err } = await supabase.rpc('update_room_goal', {
      p_room_id: roomId,
      p_target_amount: values.target_amount,
      p_end_date: values.end_date,
    });
    if (err) return { error: err.message };

    setRoomGoal({ target_amount: values.target_amount, end_date: values.end_date });
    notifyGoalChanged(roomId);
    return {};
  }

  async function saveMemberGoal(values: SaveMemberGoalValues): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };
    if (!roomId) return { error: 'No active room' };

    const { error: err } = await supabase.rpc('update_member_goal', {
      p_room_id: roomId,
      p_target_amount: values.target_amount,
    });
    if (err) return { error: personalGoalSaveErrorMessage(err.message) };

    await fetchGoal();
    return {};
  }

  return {
    // Canonical fields (Task 37).
    roomGoal,
    personalGoal,
    roomGoalTarget: roomGoal.target_amount,
    personalGoalTarget: personalGoal?.target_amount ?? null,
    roomGoalEndDate: roomGoal.end_date,
    // Back-compat alias: `goal` was the caller's personal goal row.
    goal: personalGoal,
    loading,
    error,
    saveRoomGoal,
    saveMemberGoal,
    refetch: fetchGoal,
  };
}

function personalGoalSaveErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('cannot be less than your bucket target total')) {
    return 'Personal sub-goal cannot be lower than your existing bucket targets.';
  }
  if (lower.includes('cannot exceed room goal')) {
    return 'Personal sub-goal cannot exceed the room goal.';
  }
  if (lower.includes('room goal not set')) {
    return 'The room goal has not been set yet.';
  }
  return message;
}
