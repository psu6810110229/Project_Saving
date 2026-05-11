import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useRoom } from './useRoom';
import { generateInviteCode } from '../lib/inviteCode';
import type { ProjectCategory, Room } from '../types';

interface CreateRoomValues {
  name: string;
  target_amount: number;
  end_date: string;
  category: ProjectCategory;
}

interface ActionResult {
  error?: string;
  roomId?: string;
}

export function useRooms() {
  const { user } = useAuth();
  const { rooms: currentRooms, setRooms, activeRoomId, setActiveRoomId } = useRoom();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchRooms() {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);

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
      .filter((room): room is Room => room !== null && !room.archived_at);

    setRooms(rooms);

    // Auto-select first room if nothing persisted
    if (!activeRoomId && rooms.length > 0) {
      setActiveRoomId(rooms[0].id);
    }

    setLoading(false);
  }

  async function createRoom(values: CreateRoomValues): Promise<ActionResult> {
    if (!user) return { error: 'Not authenticated' };

    const roomId = crypto.randomUUID();
    const startDate = new Date().toISOString().slice(0, 10);
    const room: Room = {
      id: roomId,
      name: values.name.trim(),
      invite_code: generateInviteCode(),
      end_date: values.end_date,
      created_by: user.id,
      created_at: new Date().toISOString(),
      category: values.category,
      archived_at: null,
    };

    const { error: roomError } = await supabase
      .from('rooms')
      .insert({
        id: room.id,
        name: room.name,
        invite_code: room.invite_code,
        end_date: room.end_date,
        created_by: room.created_by,
        category: room.category,
      });
    if (roomError) return { error: roomError.message };

    const { error: memberError } = await supabase
      .from('room_members')
      .insert({ room_id: room.id, user_id: user.id });
    if (memberError) return { error: memberError.message };

    const { error: goalError } = await supabase
      .from('goals')
      .upsert(
        {
          user_id: user.id,
          room_id: room.id,
          target_amount: values.target_amount,
          start_date: startDate,
          end_date: values.end_date,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,room_id' },
      );
    if (goalError) return { error: goalError.message };

    setRooms([room, ...currentRooms]);
    setActiveRoomId(room.id);
    return { roomId: room.id };
  }

  async function joinRoomByCode(code: string): Promise<ActionResult> {
    if (!user) return { error: 'Not authenticated' };
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length < 6) return { error: 'Enter the full invite code' };

    const { data, error: joinError } = await supabase.rpc('join_room_by_code', { code: cleaned });
    if (joinError) return { error: joinError.message };
    if (!data) return { error: 'No project found for that code' };

    setActiveRoomId(data);
    await fetchRooms();
    return { roomId: data };
  }

  async function archiveRoom(roomId: string): Promise<ActionResult> {
    if (!user) return { error: 'Not authenticated' };
    const { error: archiveError } = await supabase
      .from('rooms')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', roomId);
    if (archiveError) return { error: archiveError.message };

    const nextRooms = currentRooms.filter(room => room.id !== roomId);
    setRooms(nextRooms);
    setActiveRoomId(nextRooms[0]?.id ?? null);
    return { roomId };
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRooms();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, error, refetch: fetchRooms, createRoom, joinRoomByCode, archiveRoom };
}
