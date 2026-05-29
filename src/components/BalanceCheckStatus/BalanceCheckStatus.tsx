import { memo } from 'react';
import { IconArrowRight, IconVault } from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';
import type { BalanceCheckpoint } from '../../types';

interface BalanceCheckStatusProps {
  latest: BalanceCheckpoint | null;
  appBalance: number;
  bucketTotal: number;
  onCheck: () => void;
}

/**
 * Lightweight Check Balance status row shown above the Dashboard
 * hero. Stays visually secondary to the Saving Plan card.
 */
export const BalanceCheckStatus = memo(function BalanceCheckStatus({
  latest,
  appBalance,
  bucketTotal,
  onCheck,
}: BalanceCheckStatusProps) {
  const { copy } = useI18n();
  const d = copy.dashboard;
  const c = copy.common;

  const diff = latest?.difference_amount ?? 0;
  const needsBucketTopUp = appBalance > bucketTotal + 0.005;
  const differenceText = latest
    ? diff > 0
      ? `มากกว่าในแอป ${formatCurrency(Math.abs(diff))}`
      : diff < 0
        ? `น้อยกว่าในแอป ${formatCurrency(Math.abs(diff))}`
        : 'เท่ากัน'
    : null;
  const reminderText = needsBucketTopUp ? 'อย่าลืมไปหยอดเงินใน bucket ด้วยนะ' : null;

  return (
    <section className="relative z-10 flex items-center gap-3 rounded-xl bg-surface px-4 py-3 shadow-soft">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-800">
        <IconVault size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[12px] font-bold uppercase tracking-wider text-ink-muted">
          {d.verifiedBalanceLabel}
        </p>
        <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
          <p className="min-w-0 truncate font-mono text-lg font-bold text-ink">
            {formatCurrency(appBalance)}
          </p>
          {differenceText && (
            <p className={`shrink-0 truncate font-mono text-xs font-bold ${
              diff > 0 ? 'text-accent-leaf' : diff < 0 ? 'text-brand-800' : 'text-ink-muted'
            }`}>
              {differenceText}
            </p>
          )}
        </div>
        {reminderText && (
          <p className="mt-0.5 truncate font-mono text-xs font-bold text-brand-800">
            {reminderText}
          </p>
        )}
        {!latest && !reminderText && (
          <p className="mt-0.5 truncate font-mono text-xs text-ink-dim">{c.never}</p>
        )}
      </div>
      <button
        type="button"
        aria-label={d.checkButton}
        title={d.checkButton}
        onClick={onCheck}
        className="group grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-brand-700 text-white shadow-[0_10px_22px_rgba(234,88,12,0.28)] ring-4 ring-orange-100 transition-transform active:scale-[0.94]"
      >
        <IconArrowRight size={20} className="transition-transform group-hover:translate-x-0.5" strokeWidth={2.6} />
      </button>
    </section>
  );
});
