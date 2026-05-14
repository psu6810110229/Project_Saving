import { Chip } from '../Chip/Chip';
import { IconVault } from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { daysSince, formatSignedCurrency } from '../../lib/reconcile';
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
export function BalanceCheckStatus({ latest, appBalance, onCheck }: BalanceCheckStatusProps) {
  const days = latest ? daysSince(latest.checked_at) : null;
  const sinceLabel = latest
    ? days === 0
      ? 'today'
      : days === 1
        ? '1d ago'
        : `${days}d ago`
    : 'never';

  const diff = latest?.difference_amount ?? 0;
  const matched = latest ? diff === 0 : false;

  return (
    <section className="flex items-center gap-3 rounded-3xl bg-surface px-4 py-3 shadow-soft">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-800">
        <IconVault size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Verified Balance
          </p>
          {latest && (
            <Chip tone={matched ? 'leaf' : 'peach'}>
              {matched ? 'Matched' : formatSignedCurrency(diff)}
            </Chip>
          )}
        </div>
        <p className="mt-0.5 truncate font-mono text-sm font-bold text-ink">
          {formatCurrency(appBalance)}
          <span className="ml-2 font-normal text-ink-muted">· checked {sinceLabel}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onCheck}
        className="shrink-0 rounded-pill bg-surfaceAlt px-3 py-1.5 font-mono text-xs font-bold text-brand-800 active:scale-[0.98] transition-transform"
      >
        Check
      </button>
    </section>
  );
}
