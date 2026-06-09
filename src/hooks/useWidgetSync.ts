import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useMemo } from 'react';
import { useSharedData } from './useSharedData';
import { useStreak } from './useStreak';
import { useRoom } from './useRoom';
import { useAuth } from './useAuth';
import { writeWidgetSnapshot, type WidgetMember, type WidgetSnapshot } from '../lib/widgetSnapshot';
import { calcDailySummary } from '../lib/bucketDailySummary';
import { todayBangkokKey } from '../lib/savingPlan';
import { bucketSaved } from '../lib/buckets';
import { themeSwatches, DEFAULT_THEME } from '../lib/theme';

/**
 * Writes a display-only widget snapshot to native storage whenever the
 * dashboard numbers change, so the Android home-screen widget can render
 * without hitting Supabase. No-op on the web (the writer guards on
 * `Capacitor.isNativePlatform()`).
 *
 * Mount once inside the DataProvider subtree (where `useSharedData` is valid).
 */
export function useWidgetSync(): void {
  const { reconcile, goal, logs, buckets, bucketPlanPauses, bucketTransfers, balanceAllocations, streakFreeze, leaderboard } = useSharedData();
  const { activeRoom } = useRoom();
  const { user } = useAuth();

  const streak = useStreak(
    user?.id,
    logs.allLogs,
    streakFreeze.frozenDates,
    buckets.buckets,
    bucketTransfers.transfers,
    bucketPlanPauses.pauses,
  );

  const saved = reconcile.appBalance ?? 0;
  const target = goal.personalGoalTarget ?? 0;
  const progressPct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const roomName = activeRoom?.name ?? 'GO-OUT';
  const todayKey = todayBangkokKey();

  const todaySummary = useMemo(
    () => calcDailySummary(buckets.buckets, logs.allLogs, todayKey, bucketTransfers.transfers, bucketPlanPauses.pauses),
    [buckets.buckets, logs.allLogs, todayKey, bucketTransfers.transfers, bucketPlanPauses.pauses],
  );

  const todayDue = useMemo(
    () => todaySummary.reduce((sum, item) => sum + (item.amountDue ?? 0), 0),
    [todaySummary],
  );

  const leadItem = todaySummary[0] ?? null;
  const todayState: WidgetSnapshot['todayState'] = todaySummary.length === 0
    ? 'no_plan'
    : todayDue > 0
      ? 'due'
      : 'done';
  const todayPeriod: WidgetSnapshot['todayPeriod'] = leadItem == null
    ? 'flex'
    : leadItem.ruleType === 'fixed_weekly'
      ? 'week'
      : leadItem.ruleType === 'fixed_monthly'
        ? 'month'
        : leadItem.ruleType === 'flexible'
          ? 'flex'
          : 'day';
  const leadBucket = leadItem == null
    ? null
    : buckets.buckets.find(bucket => bucket.id === leadItem.bucketId) ?? null;
  const leadBucketSaved = leadBucket == null
    ? 0
    : bucketSaved(leadBucket.id, logs.allLogs, bucketTransfers.transfers, balanceAllocations.allocations);
  const leadBucketTarget = leadBucket?.target_amount ?? 0;
  const leadBucketPct = leadBucketTarget > 0
    ? Math.max(0, Math.min(100, Math.round((leadBucketSaved / leadBucketTarget) * 100)))
    : 0;

  // Team-bars widget data. The leaderboard already provides every member's
  // room-visible saved amount, theme color, and high → low ordering, so we
  // only reshape it into the display-only snapshot form.
  const members = useMemo<WidgetMember[]>(
    () => leaderboard.entries.map(entry => ({
      name: entry.displayName,
      saved: Math.max(0, Math.round(entry.saved)),
      color: themeSwatches[entry.themeColor ?? DEFAULT_THEME],
      isYou: entry.isYou,
      avatarUrl: entry.avatarUrl ?? null,
      streak: entry.streak,
      loggedToday: entry.hasLoggedToday,
    })),
    [leaderboard.entries],
  );
  // Room total + goal must match the team page's "ทุกคนรวมกัน" card exactly
  // (src/pages/Team.tsx): sum every member's saved, and use the summed personal
  // sub-goals — falling back to the current user's personal target — rather than
  // the room-level rooms.target_amount.
  const youGoalTarget = leaderboard.entries.find(e => e.isYou)?.personalGoalTarget ?? null;
  const roomSaved = useMemo(
    () => leaderboard.entries.reduce((sum, entry) => sum + entry.saved, 0),
    [leaderboard.entries],
  );
  const roomGoal = useMemo(() => {
    const summedTargets = leaderboard.entries.reduce(
      (sum, entry) => sum + (entry.personalGoalTarget ?? 0),
      0,
    );
    return summedTargets > 0 ? summedTargets : (goal.personalGoalTarget ?? youGoalTarget ?? 0);
  }, [leaderboard.entries, goal.personalGoalTarget, youGoalTarget]);
  const roomProgressPct = roomGoal > 0
    ? Math.min(100, Math.round((roomSaved / roomGoal) * 100))
    : 0;

  const publishSnapshot = useCallback((reason: string) => {
    const snapshot: WidgetSnapshot = {
      roomName,
      saved,
      goal: target,
      progressPct,
      todayDue: Math.max(0, Math.round(todayDue)),
      todayState,
      todayPeriod,
      focusBucketName: leadItem?.bucketName ?? null,
      focusBucketCount: todaySummary.length,
      focusBucketSaved: Math.max(0, Math.round(leadBucketSaved)),
      focusBucketTarget: Math.max(0, Math.round(leadBucketTarget)),
      focusBucketPct: leadBucketPct,
      streak: streak.streak,
      streakUnit: streak.unit,
      hasLoggedToday: streak.hasLoggedToday,
      updatedAt: new Date().toISOString(),
      members,
      roomSaved,
      roomGoal,
      roomProgressPct,
    };

    console.log('[Widget] publish snapshot:', reason, {
      roomName: snapshot.roomName,
      saved: snapshot.saved,
      goal: snapshot.goal,
      progressPct: snapshot.progressPct,
    });
    void writeWidgetSnapshot(snapshot);
  }, [
    roomName,
    saved,
    target,
    progressPct,
    todayDue,
    todayState,
    todayPeriod,
    leadItem?.bucketName,
    todaySummary.length,
    leadBucketSaved,
    leadBucketTarget,
    leadBucketPct,
    streak.streak,
    streak.unit,
    streak.hasLoggedToday,
    members,
    roomSaved,
    roomGoal,
    roomProgressPct,
  ]);

  useEffect(() => {
    console.log('[Widget] useWidgetSync started');
  }, []);

  useEffect(() => {
    publishSnapshot('data-change');
  }, [publishSnapshot]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let removeAppStateListener: (() => void) | undefined;

    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) publishSnapshot('app-active');
    }).then(listener => {
      if (cancelled) {
        void listener.remove();
      } else {
        removeAppStateListener = () => { void listener.remove(); };
      }
    });

    const handleFocus = () => publishSnapshot('window-focus');
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') publishSnapshot('visibility-visible');
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      removeAppStateListener?.();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [publishSnapshot]);
}
