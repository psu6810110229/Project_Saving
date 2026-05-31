import { useEffect } from 'react';
import { useSharedData } from './useSharedData';
import { useStreak } from './useStreak';
import { useRoom } from './useRoom';
import { useAuth } from './useAuth';
import { writeWidgetSnapshot } from '../lib/widgetSnapshot';

/**
 * Writes a display-only snapshot (saved / goal / % / streak) to native storage
 * whenever the dashboard numbers change, so the Android home-screen widget can
 * render without hitting Supabase. No-op on the web (the writer guards on
 * `Capacitor.isNativePlatform()`).
 *
 * Mount once inside the DataProvider subtree (where `useSharedData` is valid).
 */
export function useWidgetSync(): void {
  const { reconcile, goal, logs, buckets, bucketTransfers, streakFreeze } = useSharedData();
  const { activeRoom } = useRoom();
  const { user } = useAuth();

  // Same inputs the dashboard/leaderboard use, so the widget streak matches.
  const streak = useStreak(
    user?.id,
    logs.allLogs,
    streakFreeze.frozenDates,
    buckets.buckets,
    bucketTransfers.transfers,
  );

  const saved = reconcile.appBalance ?? 0;
  const target = goal.personalGoalTarget ?? 0;
  const progressPct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const roomName = activeRoom?.name ?? 'GO-OUT';

  useEffect(() => {
    void writeWidgetSnapshot({
      roomName,
      saved,
      goal: target,
      progressPct,
      streak: streak.streak,
      streakUnit: streak.unit,
      hasLoggedToday: streak.hasLoggedToday,
      updatedAt: new Date().toISOString(),
    });
  }, [
    roomName,
    saved,
    target,
    progressPct,
    streak.streak,
    streak.unit,
    streak.hasLoggedToday,
  ]);
}
