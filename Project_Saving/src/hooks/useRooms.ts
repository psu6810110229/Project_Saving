import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useRoom } from '../components/RoomContext/RoomContext';
import type { Room } from '../types';

export function useRooms() {
  const { user } = useAuth();
  const { setRooms, activeRoomId, setActiveRoomId } = useRoom();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchRooms() {
    if (!user) { setLoading(false); return; }

    const { data, error: err } = await supabase
      .from('room_members')
      .select('rooms(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true });

    if (err) { setError(err.message); setLoading(false); return; }

    const rooms: Room[] = (data ?? [])
      .map((row: { rooms: Room | Room[] | null }) => {
        const r = row.rooms;
        return Array.isArray(r) ? r[0] : r;
      })
      .filter(Boolean) as Room[];

    setRooms(rooms);

    // Auto-select first room if nothing persisted
    if (!activeRoomId && rooms.length > 0) {
      setActiveRoomId(rooms[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchRooms();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, error, refetch: fetchRooms };
}
