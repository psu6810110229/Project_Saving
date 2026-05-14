import type { BalanceAdjustmentReason } from '../types';
import { formatCurrency } from './format';

export interface ReasonOption {
  id: BalanceAdjustmentReason;
  label: string;
  description?: string;
}

/**
 * Reasons offered when the actual balance differs from the app
 * balance. Ordering is meant to lead with the most common cases.
 */
export const RECONCILE_REASONS: ReasonOption[] = [
  { id: 'forgot_to_log',    label: 'Forgot to log',     description: 'Money saved but not added to the app yet.' },
  { id: 'over_recorded',    label: 'Recorded too much', description: 'A deposit was entered larger than it really was.' },
  { id: 'miscounted',       label: 'Miscounted',        description: 'Cash or storage was counted wrong.' },
  { id: 'spent_or_used',    label: 'Spent/used already', description: 'Some money has already been spent or moved out.' },
  { id: 'opening_balance',  label: 'Opening balance',   description: 'Bringing in a balance from before this project.' },
  { id: 'other',            label: 'Other',             description: 'A different reason from the list.' },
];

const REASON_LABEL_MAP: Record<BalanceAdjustmentReason, string> = RECONCILE_REASONS
  .reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {} as Record<BalanceAdjustmentReason, string>);

export function reasonLabel(reason: BalanceAdjustmentReason | null | undefined): string {
  if (!reason) return '';
  return REASON_LABEL_MAP[reason] ?? 'Other';
}

/** Signed currency string like "+฿500" or "-฿120". Zero returns "฿0". */
export function formatSignedCurrency(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return formatCurrency(0);
  const sign = amount > 0 ? '+' : '-';
  return `${sign}${formatCurrency(Math.abs(amount))}`;
}

/** Whole days between two ISO timestamps. Returns 0 if same day. */
export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
