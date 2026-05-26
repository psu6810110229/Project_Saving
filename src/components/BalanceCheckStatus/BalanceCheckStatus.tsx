import { memo } from 'react';
import { Chip } from '../Chip/Chip';
import { IconVault } from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { daysSince, formatDirectionalAdjustment } from '../../lib/reconcile';
import { useI18n } from '../../i18n/useI18n';
import type { BalanceCheckpoint } from '../../types';

interface BalanceCheckStatusProps {
  latest: BalanceCheckpoint | null;
  appBalance: number;
  onCheck: () => void;
}

/**
 * Lightweight Check Balance status row shown above the Dashboard
 * hero. Stays visually secondary to the Saving Plan card.
 */
export const BalanceCheckStatus = memo(function BalanceCheckStatus({ latest, appBalance, onCheck }: BalanceCheckStatusProps) {
  const { copy } = useI18n();
  const d = copy.dashboard;
  const c = copy.common;
  const r = copy.reconcile;
  const days = latest ? daysSince(latest.checked_at) : null;
  const sinceLabel = latest
    ? days === 0
      ? c.today
      : c.daysAgoShort(days!)
    : c.never;

  const diff = latest?.difference_amount ?? 0;
  const matched = latest ? diff === 0 : false;

  return (
    <section className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 shadow-soft">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-800">
        <IconVault size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            {d.verifiedBalanceLabel}
          </p>
          {latest && (
            <Chip tone={matched ? 'leaf' : 'peach'}>
              {matched ? d.balanceMatched : formatDirectionalAdjustment(diff, r.statAdjustedUp, r.statAdjustedDown)}
            </Chip>
          )}
        </div>
        <p className="mt-0.5 truncate font-mono text-sm font-bold text-ink">
          {formatCurrency(appBalance)}
          <span className="ml-2 font-normal text-ink-muted">· {d.checkedSince(sinceLabel)}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onCheck}
        className="shrink-0 rounded-pill bg-surfaceAlt px-3 py-1.5 font-mono text-xs font-bold text-brand-800 active:scale-[0.98] transition-transform"
      >
        {d.checkButton}
      </button>
    </section>
  );
});
