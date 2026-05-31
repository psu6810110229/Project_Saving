import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { calcStreak, calcStreakWithFreezes, localDateKey, APP_TZ } from '../lib/streak';
import type { ProfileTheme, SavingsLog } from '../types';

const EMPTY_FROZEN_DATES: ReadonlySet<string> = new Set<string>();

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  themeColor?: ProfileTheme;
  /**
   * Saved amount that drives the percent, rank, and room total. For other
   * members this is Recorded Deposits (sum of positive savings_logs). For
   * the current user it is their Verified Balance (recorded deposits +
   * reconcile adjustments) when available, so the leaderboard stays
   * consistent with Check Balance.
   */
  saved: number;
  /**
   * Member's personal sub-goal (`goals.target_amount`). Task 37
   * relabel: this is no longer the shared room goal; it is the
   * member's personal sub-goal under `rooms.target_amount`.
   * `personalGoalTarget` is the canonical alias.
   */
  target: number | null;
  /** Alias for `target`; preferred for new callers under Task 37. */
  personalGoalTarget: number | null;
  percent: number;
  streak: number;
  hasLoggedToday: boolean;
  isYou: boolean;
}

export interface LeaderboardState {
  entries: LeaderboardEntry[];
  loading: boolean;
}

interface RawProfile { id: string; display_name: string; avatar_url?: string | null; theme_color?: ProfileTheme; }
interface RawGoal { user_id: string; target_amount: string | number; }
interface RawLeaderboardLog { user_id: string; amount: string | number; created_at: string; }

const ROOM_LOGS_PAGE_SIZE = 1000;

async function fetchAllRoomLogs(roomId: string): Promise<Array<Pick<SavingsLog, 'amount' | 'created_at' | 'user_id'>>> {
  const rows: Array<Pick<SavingsLog, 'amount' | 'created_at' | 'user_id'>> = [];
  let from = 0;

  while (true) {
    const to = from + ROOM_LOGS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('savings_logs')
      .select('user_id, amount, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const batch = ((data ?? []) as RawLeaderboardLog[]).map(row => ({
      user_id: row.user_id,
      amount: Number(row.amount),
      created_at: row.created_at,
    }));

    rows.push(...batch);

    if (batch.length < ROOM_LOGS_PAGE_SIZE) {
      return rows;
    }

    from += ROOM_LOGS_PAGE_SIZE;
  }
}

export function useLeaderboard(
  myUserId: string | undefined,
  roomId: string | null = null,
  // SPRINT1-003: per the "self only, partner raw" decision, freeze
  // data is plumbed in only for the current user. Partner streaks
  // continue to use the raw chain via `calcStreak`.
  currentUserFrozenDates: ReadonlySet<string> = EMPTY_FROZEN_DATES,
  // Current user's Verified Balance (recorded deposits + reconcile
  // adjustments) from `current_reconciled_balance`. When provided, it
  // replaces the current user's Recorded Deposits as the leaderboard
  // `saved` value so the %, rank, and room total match Check Balance.
  // Other members' verified balance is private, so they stay on recorded.
  currentUserVerifiedBalance: number | null = null,
): LeaderboardState {
  const [profiles, setProfiles] = useState<RawProfile[]>([]);
  const [goals, setGoals] = useState<RawGoal[]>([]);
  const [roomLogs, setRoomLogs] = useState<Pick<SavingsLog, 'amount' | 'created_at' | 'user_id'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(() => localDateKey(new Date().toISOString(), APP_TZ));

  useEffect(() => {
    if (!roomId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfiles([]);
      setGoals([]);
      setRoomLogs([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchLeaderboardData() {
      const activeRoomId = roomId;
      if (!activeRoomId) return;
      // Step 1: get user_ids for this room. The direct select is gated by
      // room_members RLS (fixed in migration 0012). If the policy is missing
      // in this environment the joiner only sees their own row, which would
      // collapse the dashboard to a single tile. Fall back to a security-
      // definer RPC (migration 0016) that returns every member's profile
      // so the dashboard renders both players regardless.
      const { data: memberRows } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', activeRoomId);

      if (cancelled) return;

      let userIds = (memberRows ?? []).map((r: { user_id: string }) => r.user_id);

      if (userIds.length <= 1) {
        const { data: rpcRows } = await supabase.rpc('room_members_for_room', { p_room_id: activeRoomId });
        const rpcUserIds = (rpcRows ?? []).map((r: { user_id: string }) => r.user_id);
        if (rpcUserIds.length > userIds.length) {
          if (typeof console !== 'undefined') {
            console.warn('[useLeaderboard] direct room_members returned fewer rows than RPC; falling back', { direct: userIds.length, rpc: rpcUserIds.length });
          }
          userIds = rpcUserIds;
        }
      }

      if (cancelled) return;

      if (userIds.length === 0) {
        setProfiles([]);
        setGoals([]);
        setLoading(false);
        return;
      }

      // Step 2: fetch profiles + goals in parallel.
      const [{ data: p }, { data: g }, l] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url, theme_color')
          .in('id', userIds),
        supabase
          .from('goals')
          .select('user_id, target_amount')
          .eq('room_id', activeRoomId),
        fetchAllRoomLogs(activeRoomId),
      ]);

      if (cancelled) return;
      setProfiles((p ?? []) as RawProfile[]);
      setGoals(g ?? []);
      setRoomLogs(l);
      setLoading(false);
    }

    void fetchLeaderboardData();

    const channelId = `leaderboard:${roomId}-${Math.random().toString(36).slice(2, 9)}`;
    const roomChannel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_logs', filter: `room_id=eq.${roomId}` },
        () => { void fetchLeaderboardData(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals', filter: `room_id=eq.${roomId}` },
        () => { void fetchLeaderboardData(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
        () => { void fetchLeaderboardData(); },
      )
      .subscribe();

    const id = setInterval(() => {
      const current = localDateKey(new Date().toISOString(), APP_TZ);
      setToday(prev => prev !== current ? current : prev);
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      supabase.removeChannel(roomChannel);
    };
  }, [roomId]);

  return useMemo((): LeaderboardState => {
    if (loading) return { entries: [], loading: true };

    const raw = profiles.map(p => {
      const userLogs = roomLogs.filter(l => l.user_id === p.id);
      const isYou = p.id === myUserId;
      const recordedSaved = userLogs.reduce((sum, l) => sum + l.amount, 0);
      // The current user's card/%/rank reflect Verified Balance (recorded +
      // reconcile adjustments) when available; everyone else stays on
      // Recorded Deposits. Streak/"logged today" below remain on recorded
      // deposits since they measure the saving habit, not the balance.
      const saved = isYou && currentUserVerifiedBalance !== null
        ? currentUserVerifiedBalance
        : recordedSaved;
      const goal = goals.find(g => g.user_id === p.id);
      const target = goal ? Number(goal.target_amount) : null;
      const rawPercent = target && target > 0 ? (saved / target) * 100 : 0;
      const percent = target && target > 0 ? Math.min(100, Math.round(rawPercent)) : 0;
      const hasGoal = target !== null && target > 0;
      const streak = isYou
        ? calcStreakWithFreezes(userLogs, today, currentUserFrozenDates)
        : calcStreak(userLogs, today);
      const hasLoggedToday = userLogs.some(l => localDateKey(l.created_at) === today);
      return { userId: p.id, displayName: p.display_name, avatarUrl: p.avatar_url, themeColor: p.theme_color, saved, target, _rawPercent: rawPercent, percent, hasGoal, streak, hasLoggedToday, isYou };
    });

    const sorted = [...raw].sort((a, b) => {
      if (b.saved !== a.saved) return b.saved - a.saved;
      if (b._rawPercent !== a._rawPercent) return b._rawPercent - a._rawPercent;
      return a.displayName.localeCompare(b.displayName);
    });

    const entries: LeaderboardEntry[] = sorted.map((p, i) => ({
      rank: i + 1,
      userId: p.userId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      themeColor: p.themeColor,
      saved: p.saved,
      target: p.target,
      personalGoalTarget: p.target,
      percent: p.percent,
      streak: p.streak,
      hasLoggedToday: p.hasLoggedToday,
      isYou: p.isYou,
    }));

    return { entries, loading: false };
  }, [profiles, goals, roomLogs, loading, today, myUserId, currentUserFrozenDates, currentUserVerifiedBalance]);
}
