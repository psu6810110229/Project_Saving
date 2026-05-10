import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { calcStreak, localDateKey, APP_TZ } from '../lib/streak';
import type { SavingsLog } from '../types';

export interface LeaderboardEntry {
  rank: number;          // 1-based, 1 = leader
  userId: string;
  displayName: string;
  saved: number;
  target: number | null;
  percent: number;       // 0..100 clamped for display; raw value used for sort
  streak: number;
  hasLoggedToday: boolean;
  isYou: boolean;        // userId === current auth user
}

export interface LeaderboardState {
  entries: LeaderboardEntry[];
  loading: boolean;
}

interface RawProfile { id: string; display_name: string; }
interface RawGoal { user_id: string; target_amount: string | number; }

export function useLeaderboard(logs: SavingsLog[], myUserId: string | undefined): LeaderboardState {
  const [profiles, setProfiles] = useState<RawProfile[]>([]);
  const [goals, setGoals] = useState<RawGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(() => localDateKey(new Date().toISOString(), APP_TZ));

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id, display_name'),
      supabase.from('goals').select('user_id, target_amount'),
    ]).then(([{ data: p }, { data: g }]) => {
      setProfiles(p ?? []);
      setGoals(g ?? []);
      setLoading(false);
    });

    const id = setInterval(() => {
      const current = localDateKey(new Date().toISOString(), APP_TZ);
      setToday(prev => prev !== current ? current : prev);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return useMemo((): LeaderboardState => {
    if (loading) return { entries: [], loading: true };

    // Build raw stats for every profile
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
      return {
        userId: p.id,
        displayName: p.display_name,
        saved,
        target,
        _rawPercent: rawPercent,
        percent,
        hasGoal,
        streak,
        hasLoggedToday,
        isYou: p.id === myUserId,
      };
    });

    // Sort: players with a goal first (by percent desc), then saved desc, then name asc.
    // Players without a goal go to the bottom (percent stays 0).
    const sorted = [...raw].sort((a, b) => {
      // No-goal players sink to the bottom
      if (a.hasGoal && !b.hasGoal) return -1;
      if (!a.hasGoal && b.hasGoal) return 1;
      // Both have goal or both don't: sort by rawPercent desc
      if (b._rawPercent !== a._rawPercent) return b._rawPercent - a._rawPercent;
      // Tie-break 1: saved desc
      if (b.saved !== a.saved) return b.saved - a.saved;
      // Tie-break 2: displayName asc (deterministic)
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
