import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { refreshWidget } from './widgetBridge';

/**
 * Display-only snapshot the Android home-screen widget renders. Every value is
 * derived from numbers already shown on the dashboard. The widget never talks
 * to Supabase; it only reads this snapshot from native storage.
 */
export interface WidgetSnapshot {
  roomName: string;
  saved: number; // Verified Balance (source of truth)
  goal: number; // personal sub-goal target; 0 when unset
  progressPct: number; // 0-100, clamped
  todayDue: number; // summed due amount across focus buckets
  todayState: 'due' | 'done' | 'no_plan';
  todayPeriod: 'day' | 'week' | 'month' | 'flex';
  focusBucketName: string | null;
  focusBucketCount: number;
  focusBucketSaved: number;
  focusBucketTarget: number;
  focusBucketPct: number;
  streak: number;
  streakUnit: 'day' | 'week' | 'month';
  hasLoggedToday: boolean;
  updatedAt: string; // ISO timestamp
}

const SNAPSHOT_KEY = 'widget_snapshot';

/**
 * Persist the snapshot where the native widget can read it. `@capacitor/preferences`
 * writes to the Android `CapacitorStorage` SharedPreferences file, which the
 * `SavingsWidget` provider reads by key. No-op on the web.
 */
export async function writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await Preferences.set({ key: SNAPSHOT_KEY, value: JSON.stringify(snapshot) });
  try {
    await refreshWidget();
  } catch {
    /* widget bridge unavailable - periodic update will catch up */
  }
}
