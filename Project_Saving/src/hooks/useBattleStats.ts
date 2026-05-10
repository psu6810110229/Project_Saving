import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { calcStreak, localDateKey, APP_TZ } from '../lib/streak';
import type { SavingsLog } from '../types';

export interface PlayerStat {
  userId: string;
  displayName: string;
  saved: number;
  target: number | null;
  percent: number;
  isLeader: boolean;
  streak: number;
  hasLoggedToday: boolean;
}

export interface BattleStats {
  players: [PlayerStat, PlayerStat] | null;
  gapAmount: number;
  leaderName: string | null;
  loading: boolean;
}

interface RawProfile { id: string; display_name: string; }
interface RawGoal { user_id: string; target_amount: string | number; }

export function useBattleStats(logs: SavingsLog[]): BattleStats {
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

  return useMemo(() => {
    if (loading || profiles.length < 2) {
      return { players: null, gapAmount: 0, leaderName: null, loading };
    }

    const stats: PlayerStat[] = profiles.map(p => {
      const userLogs = logs.filter(l => l.user_id === p.id);
      const saved = userLogs.reduce((sum, l) => sum + l.amount, 0);
      const goal = goals.find(g => g.user_id === p.id);
      const target = goal ? Number(goal.target_amount) : null;
      const percent = target && target > 0
        ? Math.min(100, Math.round((saved / target) * 100))
        : 0;
      const streak = calcStreak(userLogs, today);
      const hasLoggedToday = userLogs.some(l => localDateKey(l.created_at) === today);
      return { userId: p.id, displayName: p.display_name, saved, target, percent, isLeader: false, streak, hasLoggedToday };
    });

    const [a, b] = stats;
    const gapAmount = Math.abs(a.saved - b.saved);
    let leaderName: string | null = null;

    if (a.saved > b.saved) { a.isLeader = true; leaderName = a.displayName; }
    else if (b.saved > a.saved) { b.isLeader = true; leaderName = b.displayName; }

    return { players: [a, b] as [PlayerStat, PlayerStat], gapAmount, leaderName, loading: false };
  }, [profiles, goals, logs, loading, today]);
}
