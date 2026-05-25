import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useRoom } from './useRoom';
import { generateInviteCode } from '../lib/inviteCode';
import { notifyRoomJoined, notifyRoomLeft } from '../lib/notifyEvents';
import { useI18n } from '../i18n/useI18n';
import type { ProjectCategory, Room } from '../types';
import { ROOM_NAME_MAX_LENGTH } from '../lib/roomName';

interface CreateRoomValues {
  name: string;
  target_amount: number;
  end_date: string;
  category: ProjectCategory;
}

interface ActionResult {
  error?: string;
  roomId?: string;
  /**
   * Set when a write was rejected because the caller already owns
   * an active project as a creator. The UI uses this to surface a
   * confirmation dialog ("archive current and continue?").
   */
  conflict?: { existingRoomId: string; existingName: string };
}

interface ActiveRoomRow {
  id: string;
  name: string;
  invite_code: string;
  category: ProjectCategory;
  end_date: string;
  created_at: string;
}

interface UpdateRoomValues {
  end_date: string;
}

const ROOM_FETCH_TIMEOUT_MS = 12_000;

export function useRooms() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { copy } = useI18n();
  const { rooms: currentRooms, setRooms, activeRoomId, setActiveRoomId } = useRoom();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchRooms(options: { showLoading?: boolean } = {}) {
    if (!userId) { setLoading(false); return; }
    const showLoading = options.showLoading ?? currentRooms.length === 0;
    if (showLoading) setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ROOM_FETCH_TIMEOUT_MS);

    const { data, error: err } = await supabase
      .from('room_members')
      .select('rooms(*)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })
      .abortSignal(controller.signal);

    window.clearTimeout(timeoutId);

    if (err) {
      setError(err.name === 'AbortError' ? 'Could not load projects. Check your connection and refresh.' : err.message);
      setLoading(false);
      return;
    }

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

  /**
   * Returns the caller's existing active room (created_by = user)
   * if any. Used by the Create Project flow to decide whether to
   * prompt the user to archive their current room first.
   */
  async function fetchActiveRoomForCreator(): Promise<ActiveRoomRow | null> {
    if (!userId) return null;
    const { data, error: rpcError } = await supabase
      .rpc('active_room_for_creator');
    if (rpcError) return null;
    const row = (data ?? [])[0];
    return row ? (row as ActiveRoomRow) : null;
  }

  async function createRoom(values: CreateRoomValues, options: { archiveExisting?: boolean } = {}): Promise<ActionResult> {
    if (!userId) return { error: 'Not authenticated' };
    const trimmedName = values.name.trim();
    if (trimmedName === '') return { error: 'name required' };
    if (trimmedName.length > ROOM_NAME_MAX_LENGTH) return { error: 'name too long' };
    if (/[\p{Cc}]/u.test(values.name)) return { error: 'name contains control characters' };

    if (!options.archiveExisting) {
      const existing = await fetchActiveRoomForCreator();
      if (existing) {
        return { conflict: { existingRoomId: existing.id, existingName: existing.name } };
      }
    }

    const roomId = crypto.randomUUID();
    const startDate = new Date().toISOString().slice(0, 10);
    const room: Room = {
      id: roomId,
      name: trimmedName,
      invite_code: generateInviteCode(),
      end_date: values.end_date,
      created_by: userId,
      created_at: new Date().toISOString(),
      category: values.category,
      archived_at: null,
      target_amount: values.target_amount,
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
        target_amount: values.target_amount,
      });
    if (roomError) return { error: roomError.message };

    const { error: memberError } = await supabase
      .from('room_members')
      .insert({ room_id: room.id, user_id: userId });
    if (memberError) return { error: memberError.message };

    const { error: goalError } = await supabase
      .from('goals')
      .upsert(
        {
          user_id: userId,
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
    if (!userId) return { error: 'Not authenticated' };
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length < 6) return { error: 'Enter the full invite code' };

    const { data, error: joinError } = await supabase.rpc('join_room_by_code', { code: cleaned });
    if (joinError) return { error: joinError.message };

    // Migration 0023 returns rows of { room_id, status }; older deploys
    // returned a bare uuid. Handle both shapes so the client keeps
    // working through the migration window.
    const first = Array.isArray(data) ? data[0] : null;
    const roomId = first?.room_id ?? (typeof data === 'string' ? data : null);
    const status = first?.status ?? null;

    if (status === 'not_found' || !roomId) return { error: 'No project found for that code' };
    if (status === 'full') return { error: copy.joinProject.roomFullError };

    // Ensure the joiner has their own goals row so the dashboard
    // can render TotalVault / HeadToHead targets for them. The RPC
    // (migration 0017) mirrors the room creator's goal and is a
    // no-op if the joiner already has a goal for this room.
    const { error: bootstrapError } = await supabase.rpc('bootstrap_joiner_goal', { p_room_id: roomId });
    if (bootstrapError && typeof console !== 'undefined') {
      console.warn('[useRooms] bootstrap_joiner_goal failed', bootstrapError);
    }

    setActiveRoomId(roomId);
    await fetchRooms();
    // Fire-and-forget: tell the existing room creator that we joined.
    notifyRoomJoined(roomId);
    return { roomId };
  }

  async function archiveRoom(roomId: string): Promise<ActionResult> {
    if (!userId) return { error: 'Not authenticated' };
    // Use the security-definer RPC introduced in migration 0020 so the
    // creator check is enforced server-side (a member joiner cannot
    // archive a project they did not create).
    const { error: archiveError } = await supabase
      .rpc('archive_room', { p_room_id: roomId });
    if (archiveError) return { error: archiveError.message };

    const nextRooms = currentRooms.filter(room => room.id !== roomId);
    setRooms(nextRooms);
    setActiveRoomId(nextRooms[0]?.id ?? null);
    return { roomId };
  }

  /**
   * Lets a joiner walk away from a project they didn't create. RLS
   * (`room_members_delete_self` in migration 0002) allows a member to
   * delete their own row; the room itself + the creator's membership
   * are untouched, so the creator can keep working solo or invite a
   * new partner. The leaver's goals / savings_logs rows stay in the
   * DB but become invisible to them via the existing `select` policies.
   */
  async function leaveRoom(roomId: string): Promise<ActionResult> {
    if (!userId) return { error: 'Not authenticated' };
    // Notify BEFORE the membership row is deleted — otherwise the
    // server-side `_other_room_member()` lookup loses context. The
    // call resolves quietly on failure so the leave still proceeds.
    await notifyRoomLeft(roomId);
    const { error: leaveError } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (leaveError) return { error: leaveError.message };

    const nextRooms = currentRooms.filter(room => room.id !== roomId);
    setRooms(nextRooms);
    setActiveRoomId(nextRooms[0]?.id ?? null);
    return { roomId };
  }

  /**
   * Returns rooms the caller is a member of that are currently
   * archived. Kept separate from `fetchRooms` so the dashboard's
   * active-rooms list stays unaffected; the Archived Projects page
   * owns this state locally.
   */
  async function fetchArchivedRooms(): Promise<Room[]> {
    if (!userId) return [];
    const { data, error: err } = await supabase
      .from('room_members')
      .select('rooms(*)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true });
    if (err) return [];
    return (data ?? [])
      .map((row: { rooms: Room | Room[] | null }) => {
        const r = row.rooms;
        return Array.isArray(r) ? r[0] : r;
      })
      .filter((room): room is Room => room !== null && Boolean(room.archived_at));
  }

  async function restoreRoom(roomId: string): Promise<ActionResult> {
    if (!userId) return { error: 'Not authenticated' };
    const { error: restoreError } = await supabase
      .rpc('restore_room', { p_room_id: roomId });
    if (restoreError) return { error: restoreError.message };
    await fetchRooms();
    setActiveRoomId(roomId);
    return { roomId };
  }

  async function renameRoom(roomId: string, name: string): Promise<ActionResult> {
    if (!userId) return { error: 'Not authenticated' };
    const trimmed = name.trim();
    if (trimmed === '') return { error: 'name required' };
    if (trimmed.length > ROOM_NAME_MAX_LENGTH) return { error: 'name too long' };
    if (/[\p{Cc}]/u.test(name)) return { error: 'name contains control characters' };

    const { data, error: rpcError } = await supabase
      .rpc('rename_room', { p_room_id: roomId, p_name: trimmed });
    if (rpcError) return { error: rpcError.message };

    const accepted = typeof data === 'string' && data.trim() ? data : trimmed;
    setRooms(prev => prev.map(room => (
      room.id === roomId ? { ...room, name: accepted } : room
    )));
    return { roomId };
  }

  async function updateRoom(roomId: string, values: UpdateRoomValues): Promise<ActionResult> {
    if (!userId) return { error: 'Not authenticated' };

    const { error: updateError } = await supabase
      .from('rooms')
      .update({ end_date: values.end_date })
      .eq('id', roomId);
    if (updateError) return { error: updateError.message };

    setRooms(currentRooms.map(room => (
      room.id === roomId ? { ...room, end_date: values.end_date } : room
    )));
    return { roomId };
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRooms({ showLoading: currentRooms.length === 0 });
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, error, refetch: fetchRooms, createRoom, joinRoomByCode, archiveRoom, leaveRoom, restoreRoom, updateRoom, renameRoom, fetchActiveRoomForCreator, fetchArchivedRooms };
}
