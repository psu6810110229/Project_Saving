import { SectionLabel } from '../SectionLabel/SectionLabel';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { Chip } from '../Chip/Chip';
import { formatCurrency } from '../../lib/format';

/**
 * Dashboard "Recorded Vault" card. Shows recorded deposits against
 * the target, plus an optional deposit trend chip.
 */

interface TotalVaultCardProps {
  saved: number;
  target: number;
  /** Daily average needed to hit target by end date. Null = target reached or no end date. */
  dailyAvgNeeded?: number | null;
}

export function TotalVaultCard({ saved, target, dailyAvgNeeded }: TotalVaultCardProps) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  return (
    <section className="rounded-xl bg-surface shadow-soft p-5">
      <div className="flex items-start justify-between gap-2">
        <SectionLabel tone="muted">Recorded Vault</SectionLabel>
        {typeof dailyAvgNeeded === 'number' && dailyAvgNeeded > 0 && (
          <Chip tone="peach">{formatCurrency(dailyAvgNeeded)}/day</Chip>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold text-ink">{formatCurrency(saved)}</span>
        <span className="font-mono text-sm text-ink-muted">/ {formatCurrency(target)}</span>
      </div>
      <div className="mt-4">
        <ProgressBar value={pct} tone="deep" size="lg" animate />
      </div>
    </section>
  );
}
