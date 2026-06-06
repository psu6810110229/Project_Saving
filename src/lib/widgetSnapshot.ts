import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { refreshWidget } from './widgetBridge';

/**
 * One room member as shown in the team-bars widget. Derived from the
 * leaderboard so it carries the same room-visible saved amount, ordering,
 * and theme color the dashboard already uses.
 */
export interface WidgetMember {
  name: string;
  saved: number; // room-visible saved amount, rounded, >= 0
  color: string; // hex from themeSwatches, used to fill the pill
  isYou: boolean;
  avatarUrl?: string | null; // profile photo; falls back to an initial when absent
  streak?: number; // current saving streak in days, for F1 headline lines
  loggedToday?: boolean; // saved today, for the "เก็บแล้ววันนี้" headline line
}

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
  // Team-bars (2x2) widget fields. Optional so the small/medium widgets and
  // any existing snapshot readers ignore them; only the team variant renders them.
  members?: WidgetMember[]; // all room members, sorted high → low
  roomSaved?: number; // sum of every member's saved amount
  roomGoal?: number; // rooms.target_amount (room-level goal); 0 when unset
  roomProgressPct?: number; // 0-100, clamped = roomSaved / roomGoal
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
  console.log('[Widget] snapshot payload written to SharedPreferences key=widget_snapshot', {
    roomName: snapshot.roomName,
    saved: snapshot.saved,
    goal: snapshot.goal,
    progressPct: snapshot.progressPct,
  });
  console.log('[Widget] WidgetBridge.refresh called');
  try {
    await refreshWidget(snapshot);
    console.log('[Widget] native refresh returned ok');
  } catch (error) {
    console.warn('[Widget] native refresh failed:', error);
  }
}
