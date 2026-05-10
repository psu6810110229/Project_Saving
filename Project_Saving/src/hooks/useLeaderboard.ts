import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { calcStreak, localDateKey, APP_TZ } from '../lib/streak';
import type { SavingsLog } from '../types';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
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

interface RawProfile { id: string; display_name: string; }
interface RawGoal { user_id: string; target_amount: string | number; }

export function useLeaderboard(
  logs: SavingsLog[],
  myUserId: string | undefined,
  roomId: string | null = null,
): LeaderboardState {
  const [profiles, setProfiles] = useState<RawProfile[]>([]);
  const [goals, setGoals] = useState<RawGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(() => localDateKey(new Date().toISOString(), APP_TZ));

  useEffect(() => {
    if (!roomId) {
      setProfiles([]);
      setGoals([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Step 1: get user_ids for this room
    // (room_members.user_id → auth.users, NOT profiles, so we can't FK-join directly)
    supabase
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .then(({ data: memberRows }) => {
        const userIds = (memberRows ?? []).map((r: { user_id: string }) => r.user_id);
        if (userIds.length === 0) {
          setProfiles([]);
          setGoals([]);
          setLoading(false);
          return;
        }

        // Step 2: fetch profiles + goals in parallel
        Promise.all([
          supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds),
          supabase
            .from('goals')
            .select('user_id, target_amount')
            .eq('room_id', roomId),
        ]).then(([{ data: p }, { data: g }]) => {
          setProfiles((p ?? []) as RawProfile[]);
          setGoals(g ?? []);
          setLoading(false);
        });
      });

    const id = setInterval(() => {
      const current = localDateKey(new Date().toISOString(), APP_TZ);
      setToday(prev => prev !== current ? current : prev);
    }, 30_000);
    return () => clearInterval(id);
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
      const streak = calcStreak(userLogs, today);
      const hasLoggedToday = userLogs.some(l => localDateKey(l.created_at) === today);
      return { userId: p.id, displayName: p.display_name, saved, target, _rawPercent: rawPercent, percent, hasGoal, streak, hasLoggedToday, isYou: p.id === myUserId };
    });

    const sorted = [...raw].sort((a, b) => {
      if (a.hasGoal && !b.hasGoal) return -1;
      if (!a.hasGoal && b.hasGoal) return 1;
      if (b._rawPercent !== a._rawPercent) return b._rawPercent - a._rawPercent;
      if (b.saved !== a.saved) return b.saved - a.saved;
      return a.displayName.localeCompare(b.displayName);
    });

    const entries: LeaderboardEntry[] = sorted.map((p, i) => ({
      rank: i + 1,
      userId: p.userId,
      displayName: p.displayName,
      saved: p.saved,
      target: p.target,
      percent: p.percent,
      streak: p.streak,
      hasLoggedToday: p.hasLoggedToday,
      isYou: p.isYou,
    }));

    return { entries, loading: false };
  }, [profiles, goals, logs, loading, today, myUserId]);
}
