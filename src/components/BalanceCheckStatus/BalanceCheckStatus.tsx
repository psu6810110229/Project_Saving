import { IconBubble } from '../IconBubble/IconBubble';
import { IconVault } from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { formatCurrency } from '../../lib/format';
import { daysSince, formatSignedCurrency } from '../../lib/reconcile';
import type { BalanceCheckpoint } from '../../types';

interface BalanceCheckStatusProps {
  latest: BalanceCheckpoint | null;
  appBalance: number;
  onCheck: () => void;
}

/**
 * Compact "Check Balance" status row shown on Dashboard / Profile.
 * Surfaces how long since the last check and the current Verified
 * Balance, plus the primary CTA to start the Check Balance flow.
 */
export function BalanceCheckStatus({ latest, appBalance, onCheck }: BalanceCheckStatusProps) {
  const days = latest ? daysSince(latest.checked_at) : null;
  const statusLine = latest
    ? days === 0
      ? 'Last check: today'
      : days === 1
        ? 'Last check: 1 day ago'
        : `Last check: ${days} days ago`
    : 'No balance check yet';

  const diff = latest?.difference_amount ?? 0;
  const diffLine = latest
    ? diff === 0
      ? 'Amounts matched'
      : `Difference ${formatSignedCurrency(diff)}`
    : 'Confirm your savings match the verified balance.';

  return (
    <section className="rounded-3xl bg-surface p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <IconBubble tone="peach" size="md">
          <IconVault size={20} />
        </IconBubble>
        <div className="min-w-0 flex-1">
          <SectionLabel tone="brand">Check Balance</SectionLabel>
          <p className="mt-1 truncate font-mono text-sm font-bold text-ink">{statusLine}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-ink-muted">{diffLine}</p>
        </div>
        <button
          type="button"
          onClick={onCheck}
          className="shrink-0 rounded-pill bg-brand-800 px-4 py-2 font-mono text-xs font-bold text-ink-inverse shadow-soft active:scale-[0.98] transition-transform"
        >
          Check Balance
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-surfaceAlt px-3 py-2">
        <SectionLabel tone="muted">Verified Balance</SectionLabel>
        <span className="font-mono text-sm font-bold text-ink">{formatCurrency(appBalance)}</span>
      </div>
      <p className="mt-2 font-mono text-[11px] text-ink-muted">
        Balance checks are separate from deposit charts.
      </p>
    </section>
  );
}
