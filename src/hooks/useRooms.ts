import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useRoom } from './useRoom';
import { generateInviteCode } from '../lib/inviteCode';
import { notifyRoomJoined, notifyRoomLeft } from '../lib/notifyEvents';
import { useI18n } from '../i18n/useI18n';
import type { CoverTint, ProjectCategory, Room, SavingRuleType } from '../types';
import { ROOM_NAME_MAX_LENGTH } from '../lib/roomName';
import { calcSuggestedRule } from '../lib/travelExpenseRules';

interface CreateRoomValues {
  name: string;
  target_amount: number;
  end_date: string;
  category: ProjectCategory;
  cover_image_url?: string | null;
}

interface ActionResult {
  error?: string;
  roomId?: string;
  inviteCode?: string;
  /** 'joined' for new members, 'rejoined' for returning members with prior data. */
  joinStatus?: 'joined' | 'rejoined';
  /**
   * Set when a write was rejected because the caller already owns
   * an active project as a creator. The UI uses this to surface a
   * confirmation dialog ("archive current and continue?").
   */
  conflict?: { existingRoomId: string; existingName: string };
}

export type RoomPreviewStatus = 'found' | 'already_member' | 'full' | 'not_found';

export interface RoomPreview {
  roomId: string;
  name: string;
  category: ProjectCategory;
  targetAmount: number;
  endDate: string | null;
  coverImageUrl: string | null;
  memberCount: number;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
  status: Exclude<RoomPreviewStatus, 'not_found'>;
}

/**
 * Result of looking up a room by invite code. A matched room carries
 * its metadata; `not_found` means the code was complete but matched no
 * active room (the UI shows an explicit "no project found" card). A
 * bare null means we didn't look up (short code) or the call errored.
 */
export type RoomPreviewResult = RoomPreview | { status: 'not_found' };

interface WizardExpense {
  category: string;
  nameEn: string;
  nameTh: string;
  targetAmount: number;
  deadline: string;
  priority: number;
  paymentType?: string;
  tipKey?: string | null;
  /** User-chosen saving rule from step 4 (overrides the auto suggestion). */
  savingRuleType?: SavingRuleType | null;
  savingRuleAmount?: number | null;
}

interface CreateRoomWithTemplatesValues {
  name: string;
  target_amount: number;
  end_date: string;
  category: ProjectCategory;
  cover_image_url?: string | null;
  expenses: WizardExpense[];
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

interface UpdateRoomCoverValues {
  cover_image_url: string | null;
}

interface UpdateMemberCoverValues extends UpdateRoomCoverValues {
  cover_tint?: CoverTint | null;
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

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError(copy.appLayout.connectionError);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ROOM_FETCH_TIMEOUT_MS);

    const { data, error: err } = await supabase
      .from('room_members')
      .select('cover_image_url, cover_tint, rooms(*)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })
      .abortSignal(controller.signal);

    window.clearTimeout(timeoutId);

    if (err) {
      setError(err.name === 'AbortError' ? copy.appLayout.connectionError : err.message);
      setLoading(false);
      return;
    }

    const rooms: Room[] = (data ?? [])
      .map((row: { cover_image_url: string | null; cover_tint: CoverTint | null; rooms: Room | Room[] | null }): Room | null => {
        const r = row.rooms;
        const room = Array.isArray(r) ? r[0] : r;
        return room
          ? { ...room, member_cover_image_url: row.cover_image_url, member_cover_tint: row.cover_tint }
          : null;
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
      cover_image_url: values.cover_image_url ?? null,
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
        cover_image_url: values.cover_image_url ?? null,
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
    return { roomId: room.id, inviteCode: room.invite_code };
  }

  async function createRoomWithTemplates(
    values: CreateRoomWithTemplatesValues,
    options: { archiveExisting?: boolean } = {},
  ): Promise<ActionResult> {
    const result = await createRoom(
      {
        name: values.name,
        target_amount: values.target_amount,
        end_date: values.end_date,
        category: values.category,
        cover_image_url: values.cover_image_url ?? null,
      },
      options,
    );
    if (result.error || result.conflict || !result.roomId || !userId) return result;

    const roomId = result.roomId;

    if (values.expenses.length > 0) {
      // Compute the suggested saving rule once per expense and reuse it
      // for both the shared template and the creator's own bucket so the
      // bucket isn't left deadline-only (no rule = no save-today amount).
      const withRules = values.expenses.map(e => {
        // Prefer the user's chosen rule (step-4 picker); otherwise fall back to
        // the auto suggestion so the bucket still gets a save-today amount.
        const fallback = calcSuggestedRule(e.targetAmount, e.deadline);
        const ruleType = e.savingRuleType ?? fallback.ruleType;
        const amount = e.savingRuleType != null ? e.savingRuleAmount ?? 0 : fallback.amount;
        return { e, rule: { ruleType, amount } };
      });

      const templates = withRules.map(({ e, rule }) => ({
        room_id: roomId,
        category: e.category,
        name: e.nameEn,
        target_amount: e.targetAmount,
        payment_type: e.paymentType ?? 'flexible',
        deadline: e.deadline,
        suggested_rule_type: rule.ruleType,
        suggested_rule_amount: rule.amount > 0 ? rule.amount : null,
        priority: e.priority,
        tip_key: e.tipKey ?? null,
        created_by: userId,
      }));

      const { error: tplError } = await supabase
        .from('expense_templates')
        .insert(templates);
      if (tplError) {
        console.warn('[useRooms] expense_templates insert failed', tplError);
      }

      const buckets = withRules.map(({ e, rule }, i) => ({
        user_id: userId,
        room_id: roomId,
        name: e.nameEn,
        target_amount: e.targetAmount,
        category: e.category,
        position: i,
        deadline: e.deadline,
        payment_type: e.paymentType ?? 'flexible',
        saving_rule_type: rule.ruleType,
        saving_rule_amount: rule.amount > 0 ? rule.amount : null,
      }));

      const { error: bucketError } = await supabase
        .from('buckets')
        .insert(buckets);
      if (bucketError) {
        console.warn('[useRooms] creator bucket creation failed', bucketError);
      }
    }

    return result;
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
    const joinStatus = status === 'rejoined' ? 'rejoined' as const : 'joined' as const;
    return { roomId, joinStatus };
  }

  /**
   * Read-only lookup of a room by its invite code, used to render a
   * real preview in the Join Project flow before the user commits.
   * Backed by the security-definer RPC `room_preview_by_code`
   * (migration 0077), which is the only way a non-member can see a
   * room's metadata under RLS. Returns null on error or empty code.
   */
  async function fetchRoomPreview(code: string): Promise<RoomPreviewResult | null> {
    if (!userId) return null;
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length < 6) return null;

    const { data, error: previewError } = await supabase
      .rpc('room_preview_by_code', { code: cleaned });
    if (previewError) {
      if (typeof console !== 'undefined') console.warn('[useRooms] room_preview_by_code failed', previewError);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : null;
    if (!row || row.status === 'not_found' || !row.room_id) return { status: 'not_found' };

    return {
      roomId: row.room_id,
      name: row.name,
      category: row.category as ProjectCategory,
      targetAmount: Number(row.target_amount ?? 0),
      endDate: row.end_date ?? null,
      coverImageUrl: row.cover_image_url ?? null,
      memberCount: Number(row.member_count ?? 0),
      creatorName: row.creator_name ?? null,
      creatorAvatarUrl: row.creator_avatar_url ?? null,
      status: row.status as Exclude<RoomPreviewStatus, 'not_found'>,
    };
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

  async function updateRoomCover(roomId: string, values: UpdateRoomCoverValues): Promise<ActionResult> {
    if (!userId) return { error: 'Not authenticated' };

    const { error: updateError } = await supabase
      .from('rooms')
      .update({ cover_image_url: values.cover_image_url })
      .eq('id', roomId);
    if (updateError) return { error: updateError.message };

    setRooms(prev => prev.map(room => (
      room.id === roomId ? { ...room, cover_image_url: values.cover_image_url } : room
    )));
    return { roomId };
  }

  async function updateMemberCover(roomId: string, values: UpdateMemberCoverValues): Promise<ActionResult> {
    if (!userId) return { error: 'Not authenticated' };

    const tint = values.cover_tint ?? null;
    const { error: updateError } = await supabase
      .from('room_members')
      .update({ cover_image_url: values.cover_image_url, cover_tint: tint })
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (updateError) return { error: updateError.message };

    setRooms(prev => prev.map(room => (
      room.id === roomId
        ? { ...room, member_cover_image_url: values.cover_image_url, member_cover_tint: tint }
        : room
    )));
    return { roomId };
  }

  async function transferOwnership(roomId: string, newOwnerId: string): Promise<ActionResult> {
    if (!userId) return { error: 'Not authenticated' };
    const { error: rpcError } = await supabase.rpc('transfer_room_ownership', {
      p_room_id: roomId,
      p_new_owner_id: newOwnerId,
    });
    if (rpcError) return { error: rpcError.message };

    setRooms(prev => prev.map(room => (
      room.id === roomId ? { ...room, created_by: newOwnerId } : room
    )));
    return { roomId };
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRooms({ showLoading: currentRooms.length === 0 });
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, error, refetch: fetchRooms, createRoom, createRoomWithTemplates, joinRoomByCode, fetchRoomPreview, archiveRoom, leaveRoom, restoreRoom, updateRoom, updateRoomCover, updateMemberCover, renameRoom, transferOwnership, fetchActiveRoomForCreator, fetchArchivedRooms };
}
