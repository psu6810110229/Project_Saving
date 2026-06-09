import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { calcStreak, calcStreakWithFreezes, localDateKey, APP_TZ } from '../lib/streak';
import { calcPeriodAwareStreak } from '../lib/streakCalculation';
import type { Bucket, BucketPlanPause, BucketTransfer, ProfileTheme, SavingsLog } from '../types';

const EMPTY_FROZEN_DATES: ReadonlySet<string> = new Set<string>();

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  themeColor?: ProfileTheme;
  /**
   * Saved amount that drives the percent, rank, and room total. For other
   * members this is the room-visible bucket balance
   * (logs + allocations + net transfers). For the current user it is
   * their Verified Balance when available, so the leaderboard stays
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

interface RawProfile { id: string; display_name: string; avatar_url?: string | null; }
interface RawGoal { user_id: string; target_amount: string | number; }
interface RawLeaderboardLog { user_id: string; amount: string | number; created_at: string; bucket_id: string | null; }
interface RawRoomMemberRow { user_id: string; }
interface RawVisibleBalanceRow { user_id: string; total: string | number; }
interface RawMemberThemeRow { user_id: string; theme_color: ProfileTheme | null; }

async function fetchAllRoomLogs(roomId: string): Promise<Array<Pick<SavingsLog, 'amount' | 'created_at' | 'user_id' | 'bucket_id'>>> {
  const { data, error } = await supabase.rpc('room_savings_logs_for_room', {
    p_room_id: roomId,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as RawLeaderboardLog[]).map(row => ({
    user_id: row.user_id,
    amount: Number(row.amount),
    created_at: row.created_at,
    bucket_id: row.bucket_id ?? undefined,
  }));
}

async function fetchRoomMemberVisibleBalances(roomId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('room_member_visible_balances', {
    p_room_id: roomId,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as RawVisibleBalanceRow[];
  return new Map(rows.map(row => [row.user_id, Number(row.total)]));
}

export function useLeaderboard(
  myUserId: string | undefined,
  roomId: string | null = null,
  // SPRINT1-003: per the "self only, partner raw" decision, freeze
  // data is plumbed in only for the current user. Partner streaks
  // continue to use the raw chain via `calcStreak`.
  currentUserFrozenDates: ReadonlySet<string> = EMPTY_FROZEN_DATES,
  // Current user's current app ledger total (recorded deposits +
  // reconcile adjustments) from `current_reconciled_balance`. When
  // provided, it replaces the current user's Recorded Deposits as the
  // leaderboard `saved` value. Other members keep recorded deposits
  // because their private balance-check data is not exposed.
  currentUserVerifiedBalance: number | null = null,
  currentUserBuckets: Bucket[] = [],
  currentUserTransfers: BucketTransfer[] = [],
  currentUserBucketPauses: BucketPlanPause[] = [],
): LeaderboardState {
  const [profiles, setProfiles] = useState<RawProfile[]>([]);
  const [goals, setGoals] = useState<RawGoal[]>([]);
  const [roomLogs, setRoomLogs] = useState<Pick<SavingsLog, 'amount' | 'created_at' | 'user_id' | 'bucket_id'>[]>([]);
  const [visibleBalancesByUserId, setVisibleBalancesByUserId] = useState<Map<string, number>>(new Map());
  const [themeByUserId, setThemeByUserId] = useState<Map<string, ProfileTheme | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(() => localDateKey(new Date().toISOString(), APP_TZ));

  useEffect(() => {
    if (!roomId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfiles([]);
      setGoals([]);
      setRoomLogs([]);
      setVisibleBalancesByUserId(new Map());
      setThemeByUserId(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchLeaderboardData() {
      const activeRoomId = roomId;
      if (!activeRoomId) return;
      // Step 1: get user_ids for this room. Compare the direct RLS-gated read
      // with the security-definer RPC and keep whichever returns more rows.
      // Some environments partially expose `room_members` (for example only a
      // subset of co-members), which would otherwise collapse the leaderboard.
      const [{ data: memberRows, error: memberRowsError }, { data: rpcRows, error: rpcError }] = await Promise.all([
        supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', activeRoomId),
        supabase.rpc('room_members_for_room', { p_room_id: activeRoomId }),
      ]);

      if (cancelled) return;

      const directUserIds = ((memberRows ?? []) as RawRoomMemberRow[]).map(row => row.user_id);
      const rpcUserIds = ((rpcRows ?? []) as RawRoomMemberRow[]).map(row => row.user_id);

      let userIds = directUserIds;
      if (rpcUserIds.length > directUserIds.length) {
        if (typeof console !== 'undefined') {
          console.warn('[useLeaderboard] direct room_members returned fewer rows than RPC; falling back', { direct: directUserIds.length, rpc: rpcUserIds.length });
        }
        userIds = rpcUserIds;
      } else if (directUserIds.length === 0 && rpcError && memberRowsError && typeof console !== 'undefined') {
        console.warn('[useLeaderboard] both direct and RPC member reads failed', {
          direct: memberRowsError.message,
          rpc: rpcError.message,
        });
      }

      if (cancelled) return;

      if (userIds.length === 0) {
        setProfiles([]);
        setGoals([]);
        setVisibleBalancesByUserId(new Map());
        setThemeByUserId(new Map());
        setLoading(false);
        return;
      }

      // Step 2: fetch profiles + goals in parallel.
      const [{ data: p }, { data: g }, l, visibleBalances, { data: themedMembers, error: themedMembersError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds),
        supabase
          .from('goals')
          .select('user_id, target_amount')
          .eq('room_id', activeRoomId),
        fetchAllRoomLogs(activeRoomId),
        fetchRoomMemberVisibleBalances(activeRoomId),
        supabase.rpc('room_members_for_room', { p_room_id: activeRoomId }),
      ]);

      if (cancelled) return;
      setProfiles((p ?? []) as RawProfile[]);
      setGoals(g ?? []);
      setRoomLogs(l);
      setVisibleBalancesByUserId(visibleBalances);
      if (themedMembersError && typeof console !== 'undefined') {
        console.warn('[useLeaderboard] room_members_for_room theme fetch failed', themedMembersError.message);
      }
      const themeRows = (themedMembers ?? []) as RawMemberThemeRow[];
      setThemeByUserId(new Map(themeRows.map(row => [row.user_id, row.theme_color])));
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bucket_transfers', filter: `room_id=eq.${roomId}` },
        () => { void fetchLeaderboardData(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'balance_allocations', filter: `room_id=eq.${roomId}` },
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
      // The current user's card/%/rank reflect their private Verified
      // Balance when available. Other members use the room-visible bucket
      // balance summary from the aggregate RPC. Streak/"logged today"
      // stay on recorded deposits since they measure the saving habit,
      // not the bucket balance.
      const saved = isYou && currentUserVerifiedBalance !== null
        ? currentUserVerifiedBalance
        : (visibleBalancesByUserId.get(p.id) ?? recordedSaved);
      const goal = goals.find(g => g.user_id === p.id);
      const target = goal ? Number(goal.target_amount) : null;
      const rawPercent = target && target > 0 ? (saved / target) * 100 : 0;
      const percent = target && target > 0 ? Math.min(100, Math.round(rawPercent)) : 0;
      const hasGoal = target !== null && target > 0;
      const currentUserHasBucketPlan = isYou && currentUserBuckets.some(bucket => bucket.deadline && bucket.saving_rule_type);
      const bucketStreak = currentUserHasBucketPlan
        ? calcPeriodAwareStreak(
            currentUserBuckets,
            userLogs as SavingsLog[],
            today,
            currentUserFrozenDates,
            currentUserTransfers,
            currentUserBucketPauses,
          )
        : null;
      const streak = bucketStreak
        ? bucketStreak.streak
        : isYou
          ? calcStreakWithFreezes(userLogs, today, currentUserFrozenDates)
          : calcStreak(userLogs, today);
      const hasLoggedToday = bucketStreak
        ? bucketStreak.hasLoggedToday
        : userLogs.some(l => localDateKey(l.created_at) === today);
      return { userId: p.id, displayName: p.display_name, avatarUrl: p.avatar_url, themeColor: themeByUserId.get(p.id) ?? undefined, saved, target, _rawPercent: rawPercent, percent, hasGoal, streak, hasLoggedToday, isYou };
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
  }, [profiles, goals, roomLogs, loading, today, myUserId, currentUserFrozenDates, currentUserVerifiedBalance, currentUserBuckets, currentUserTransfers, currentUserBucketPauses, visibleBalancesByUserId, themeByUserId]);
}
