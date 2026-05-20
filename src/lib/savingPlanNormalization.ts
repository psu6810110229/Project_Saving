import type {
  SavingPlanPause,
  SavingPlanRevision,
  SavingPlanRuleType,
} from '../types';

export interface RawRevisionRow {
  id: string;
  plan_id: string;
  room_id: string;
  user_id: string;
  effective_from_date: string;
  rule_type: SavingPlanRuleType;
  amount: number | string | null;
  start_amount: number | string | null;
  increment_amount: number | string | null;
  cap_amount: number | string | null;
  target_amount: number | string;
  end_date: string | null;
  day_count: number | null;
  created_at: string;
}

export interface RawPauseRow {
  id: string;
  plan_id: string;
  room_id: string;
  user_id: string;
  paused_from: string;
  resumed_from: string | null;
  created_at: string;
  resumed_at: string | null;
}

function toNum(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

function maybeNum(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value);
}

export function normalizeRevision(row: RawRevisionRow): SavingPlanRevision {
  return {
    id: row.id,
    plan_id: row.plan_id,
    room_id: row.room_id,
    user_id: row.user_id,
    effective_from_date: row.effective_from_date,
    rule_type: row.rule_type,
    amount: maybeNum(row.amount),
    start_amount: maybeNum(row.start_amount),
    increment_amount: maybeNum(row.increment_amount),
    cap_amount: maybeNum(row.cap_amount),
    target_amount: toNum(row.target_amount),
    end_date: row.end_date,
    day_count: row.day_count,
    created_at: row.created_at,
  };
}

export function normalizePause(row: RawPauseRow): SavingPlanPause {
  return {
    id: row.id,
    plan_id: row.plan_id,
    room_id: row.room_id,
    user_id: row.user_id,
    paused_from: row.paused_from,
    resumed_from: row.resumed_from,
    created_at: row.created_at,
    resumed_at: row.resumed_at,
  };
}
