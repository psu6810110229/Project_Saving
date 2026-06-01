import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { type ThemeSwatch } from '../lib/theme';

/**
 * Reads the active room's member list via the security-definer RPC
 * `room_members_for_room` (migration 0016). Promoted from a page-local
 * helper in `ManageProject.tsx` so both Manage Project and the Member
 * Detail page can consume it without duplicating the logic.
 *
 * Room-switch reset semantics:
 * - `roomId` change resets `members` to `[]` synchronously *during
 *   render* so the previous room's members can never flash on the
 *   screen under the new room's title, even on a slow network.
 * - In-flight RPC responses for a stale `roomId` are dropped via a
 *   `cancelled` flag.
 * - On error after a room switch (post-reset, `members.length === 0`),
 *   we keep `members` as `[]` and surface the error string — never
 *   bleed stale identities into a new room.
 * - On a same-room refetch error (forward-looking; v1 fetches only
 *   on `roomId` change), keep the prior `members` and surface the
 *   error inline so the user is not stranded.
 */

export interface RoomMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  themeColor: ThemeSwatch | null;
  joinedAt: string | null;
}

export interface UseRoomMembersResult {
  members: RoomMember[];
  loading: boolean;
  error: string | null;
}

interface RawMemberRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  theme_color: string | null;
  joined_at: string | null;
}

function toThemeSwatch(value: string | null | undefined): ThemeSwatch | null {
  if (
    value === 'terracotta'
    || value === 'slate'
    || value === 'teal'
    || value === 'gold'
    || value === 'leaf'
    || value === 'coral'
    || value === 'indigo'
  ) return value;
  return null;
}

export function useRoomMembers(roomId: string | null): UseRoomMembersResult {
  const [state, setState] = useState<UseRoomMembersResult>(() => ({
    members: [],
    loading: roomId !== null,
    error: null,
  }));
  const [trackedRoomId, setTrackedRoomId] = useState<string | null>(roomId);

  if (trackedRoomId !== roomId) {
    setTrackedRoomId(roomId);
    setState({
      members: [],
      loading: roomId !== null,
      error: null,
    });
  }

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    async function fetchMembers() {
      const { data, error } = await supabase.rpc('room_members_for_room', { p_room_id: roomId });
      if (cancelled) return;

      if (error) {
        setState(prev => ({
          members: prev.members,
          loading: false,
          error: error.message,
        }));
        return;
      }

      const rows = (data ?? []) as RawMemberRow[];
      const members: RoomMember[] = rows
        .filter(r => r && typeof r.user_id === 'string')
        .map(r => ({
          userId: r.user_id,
          displayName: r.display_name && r.display_name.trim().length > 0
            ? r.display_name
            : '—',
          avatarUrl: r.avatar_url,
          themeColor: toThemeSwatch(r.theme_color),
          joinedAt: r.joined_at,
        }))
        .sort((a, b) => {
          const ja = a.joinedAt ?? '';
          const jb = b.joinedAt ?? '';
          if (ja === jb) return 0;
          return ja < jb ? -1 : 1;
        });

      if (members.length === 0 && typeof console !== 'undefined') {
        console.warn('[useRoomMembers] empty member list with no error', { roomId });
      }

      setState({ members, loading: false, error: null });
    }

    void fetchMembers();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  return state;
}

export interface UseRoomMemberResult {
  member: RoomMember | null;
  loading: boolean;
  error: string | null;
}

/**
 * Thin selector over `useRoomMembers`. Returns the single member
 * matching `userId` from the active room's list, or `null` if not
 * present. Does not issue a separate fetch — mirrors `useRoomMembers`
 * loading/error semantics.
 */
export function useRoomMember(
  roomId: string | null,
  userId: string | null,
): UseRoomMemberResult {
  const { members, loading, error } = useRoomMembers(roomId);
  const member = useMemo(
    () => (userId ? (members.find(m => m.userId === userId) ?? null) : null),
    [members, userId],
  );
  return { member, loading, error };
}
