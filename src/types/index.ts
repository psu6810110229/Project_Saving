/* ──────────────────────────────────────────────────────────────────────
 * Core entities (1:1 with Supabase tables).
 * `Room` stays the DB-level name. The new UI surfaces it as a "Project".
 * ──────────────────────────────────────────────────────────────────── */

export interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  /** Personal theme swatch persisted on the profile (added in migration 0009). */
  theme_color?: ProfileTheme;
  /** User-editable quick deposit presets. Added in migration 0015. */
  quick_add_amounts?: number[] | null;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  invite_code: string;
  end_date: string;
  created_by: string;
  created_at: string;
  /** Category of the saving project — drives icon + copy in the UI. Added in migration 0007. */
  category?: ProjectCategory;
  /** When set, the project is archived and hidden from the Vault list. Added in migration 0010. */
  archived_at?: string | null;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface Goal {
  user_id: string;
  room_id: string;
  target_amount: number;
  start_date: string;
  end_date: string;
  updated_at: string;
}

export interface SavingsLog {
  id: string;
  user_id: string;
  room_id?: string;
  amount: number;
  note: string | null;
  created_at: string;
  display_name?: string;
  bucket_id?: string;
  bucket_name?: string;
  /** Optional uploaded slip image URL — drives the "Slip Attached" tag in the timeline. Added in migration 0011. */
  slip_url?: string | null;
}

export interface Bucket {
  id: string;
  user_id: string;
  room_id: string;
  name: string;
  target_amount: number;
  position: number;
  created_at: string;
  /** Visual / icon category for this bucket. Added in migration 0008. */
  category?: BucketCategory;
}

/** Working copy used inside BucketEditor before saving. */
export interface BucketDraft {
  /** undefined = new row (not yet in DB) */
  id: string | undefined;
  name: string;
  target_amount: number;
  category?: BucketCategory;
}

/* ──────────────────────────────────────────────────────────────────────
 * UI-level enums (no DB analogue yet — populated as migrations 0007–0011
 * land alongside the consuming features).
 * ──────────────────────────────────────────────────────────────────── */

/** Top-level project type chosen on the Create Project flow. */
export type ProjectCategory = 'travel' | 'gadget' | 'wedding' | 'home' | 'other';

/** Smart Bucket sub-category — drives the icon on bucket tiles. */
export type BucketCategory =
  | 'travel'
  | 'flight'
  | 'accom'
  | 'dining'
  | 'transport'
  | 'activities'
  | 'gear'
  | 'home'
  | 'other';

/** Personal theme swatch keys. Mirror `themeSwatches` keys in `lib/theme.ts`. */
export type ProfileTheme = 'terracotta' | 'slate' | 'teal';

/* ──────────────────────────────────────────────────────────────────────
 * Reconcile / Check Balance (migration 0027).
 * ──────────────────────────────────────────────────────────────────── */

export type BalanceAdjustmentReason =
  | 'forgot_to_log'
  | 'over_recorded'
  | 'miscounted'
  | 'spent_or_used'
  | 'opening_balance'
  | 'other';

export interface BalanceCheckpoint {
  id: string;
  room_id: string;
  user_id: string;
  ledger_amount_at_time: number;
  actual_amount: number;
  difference_amount: number;
  note: string | null;
  checked_at: string;
  created_at: string;
  client_request_id: string | null;
}

export interface BalanceAdjustment {
  id: string;
  checkpoint_id: string;
  room_id: string;
  user_id: string;
  amount: number;
  reason: BalanceAdjustmentReason;
  note: string | null;
  created_at: string;
}

export interface CheckpointStorageItem {
  id: string;
  checkpoint_id: string;
  room_id: string;
  user_id: string;
  label: string;
  amount: number;
  position: number;
  created_at: string;
}

/** Row returned by the sanitized `balance_activity_for_room` RPC. */
export interface BalanceActivityEntry {
  checkpoint_id: string;
  user_id: string;
  display_name: string | null;
  checked_at: string;
  ledger_amount: number;
  actual_amount: number;
  difference_amount: number;
  reason: BalanceAdjustmentReason | null;
}

/* ──────────────────────────────────────────────────────────────────────
 * Saving Plan (Task 22.1, migration 0030).
 * ──────────────────────────────────────────────────────────────────── */

export type SavingPlanRuleType =
  | 'fixed_daily'
  | 'fixed_weekly'
  | 'fixed_monthly'
  | 'increasing_daily';

export interface SavingPlanRevision {
  id: string;
  plan_id: string;
  room_id: string;
  user_id: string;
  /** Bangkok-local date the revision starts to apply (YYYY-MM-DD). */
  effective_from_date: string;
  rule_type: SavingPlanRuleType;
  amount: number | null;
  start_amount: number | null;
  increment_amount: number | null;
  cap_amount: number | null;
  target_amount: number;
  end_date: string | null;
  day_count: number | null;
  created_at: string;
}

export interface SavingPlan {
  id: string;
  room_id: string;
  user_id: string;
  timezone: string;
  created_at: string;
  archived_at: string | null;
  revisions: SavingPlanRevision[];
}

/** Authoritative deposit summary from `recorded_deposits_summary` RPC. */
export interface RecordedDepositsSummary {
  total: number;
  last_deposit_at: string | null;
  /** Distinct Bangkok-local YYYY-MM-DD date keys (deposits exist on these days). */
  deposit_day_keys: string[];
}
