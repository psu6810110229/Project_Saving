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
  /** Recorded Deposits: sum of positive savings_logs assigned to buckets. */
  saved: number;
  target: number | null;
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

export function useLeaderboard(
  logs: SavingsLog[],
  myUserId: string | undefined,
  roomId: string | null = null,
  // SPRINT1-003: per the "self only, partner raw" decision, freeze
  // data is plumbed in only for the current user. Partner streaks
  // continue to use the raw chain via `calcStreak`.
  currentUserFrozenDates: ReadonlySet<string> = EMPTY_FROZEN_DATES,
): LeaderboardState {
  const [profiles, setProfiles] = useState<RawProfile[]>([]);
  const [goals, setGoals] = useState<RawGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(() => localDateKey(new Date().toISOString(), APP_TZ));

  useEffect(() => {
    if (!roomId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfiles([]);
      setGoals([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchLeaderboardData() {
      // Step 1: get user_ids for this room. The direct select is gated by
      // room_members RLS (fixed in migration 0012). If the policy is missing
      // in this environment the joiner only sees their own row, which would
      // collapse the dashboard to a single tile. Fall back to a security-
      // definer RPC (migration 0016) that returns every member's profile
      // so the dashboard renders both players regardless.
      const { data: memberRows } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', roomId);

      if (cancelled) return;

      let userIds = (memberRows ?? []).map((r: { user_id: string }) => r.user_id);

      if (userIds.length <= 1) {
        const { data: rpcRows } = await supabase.rpc('room_members_for_room', { p_room_id: roomId });
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
      const [{ data: p }, { data: g }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url, theme_color')
          .in('id', userIds),
        supabase
          .from('goals')
          .select('user_id, target_amount')
          .eq('room_id', roomId),
      ]);

      if (cancelled) return;
      setProfiles((p ?? []) as RawProfile[]);
      setGoals(g ?? []);
      setLoading(false);
    }

    void fetchLeaderboardData();

    const channelId = `leaderboard-goals:${roomId}-${Math.random().toString(36).slice(2, 9)}`;
    const goalChannel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals', filter: `room_id=eq.${roomId}` },
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
      supabase.removeChannel(goalChannel);
    };
  }, [roomId]);

  return useMemo((): LeaderboardState => {
    if (loading) return { entries: [], loading: true };

    const raw = profiles.map(p => {
      const userLogs = logs.filter(l => l.user_id === p.id);
      const saved = userLogs.reduce((sum, l) => sum + l.amount, 0);
      const goal = goals.find(g => g.user_id === p.id);
      const target = goal ? Number(goal.target_amount) : null;
      const rawPercent = target && target > 0 ? (saved / target) * 100 : 0;
      const percent = target && target > 0 ? Math.min(100, Math.round(rawPercent)) : 0;
      const hasGoal = target !== null && target > 0;
      const isYou = p.id === myUserId;
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
      percent: p.percent,
      streak: p.streak,
      hasLoggedToday: p.hasLoggedToday,
      isYou: p.isYou,
    }));

    return { entries, loading: false };
  }, [profiles, goals, logs, loading, today, myUserId, currentUserFrozenDates]);
}
