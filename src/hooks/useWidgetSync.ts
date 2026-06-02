import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useMemo } from 'react';
import { useSharedData } from './useSharedData';
import { useStreak } from './useStreak';
import { useRoom } from './useRoom';
import { useAuth } from './useAuth';
import { writeWidgetSnapshot, type WidgetSnapshot } from '../lib/widgetSnapshot';
import { calcDailySummary } from '../lib/bucketDailySummary';
import { todayBangkokKey } from '../lib/savingPlan';
import { bucketSaved } from '../lib/buckets';

/**
 * Writes a display-only widget snapshot to native storage whenever the
 * dashboard numbers change, so the Android home-screen widget can render
 * without hitting Supabase. No-op on the web (the writer guards on
 * `Capacitor.isNativePlatform()`).
 *
 * Mount once inside the DataProvider subtree (where `useSharedData` is valid).
 */
export function useWidgetSync(): void {
  const { reconcile, goal, logs, buckets, bucketTransfers, streakFreeze } = useSharedData();
  const { activeRoom } = useRoom();
  const { user } = useAuth();

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
  const todayKey = todayBangkokKey();

  const todaySummary = useMemo(
    () => calcDailySummary(buckets.buckets, logs.allLogs, todayKey, bucketTransfers.transfers),
    [buckets.buckets, logs.allLogs, todayKey, bucketTransfers.transfers],
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
    : bucketSaved(leadBucket.id, logs.allLogs, bucketTransfers.transfers);
  const leadBucketTarget = leadBucket?.target_amount ?? 0;
  const leadBucketPct = leadBucketTarget > 0
    ? Math.max(0, Math.min(100, Math.round((leadBucketSaved / leadBucketTarget) * 100)))
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
