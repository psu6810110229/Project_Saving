import { SectionLabel } from '../SectionLabel/SectionLabel';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';

interface TotalVaultCardProps {
  saved: number;
  target: number;
}

function pctColor(pct: number): string {
  if (pct >= 100) return 'text-accent-leaf';
  if (pct >= 75)  return 'text-accent-gold';
  if (pct >= 25)  return 'text-brand-800';
  return 'text-ink-muted';
}

export function TotalVaultCard({ saved, target }: TotalVaultCardProps) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const pctRounded = Math.round(pct);
  return (
    <section className="rounded-xl bg-surface shadow-soft p-5">
      <div className="flex items-center justify-between">
        <SectionLabel tone="muted">Recorded Vault</SectionLabel>
        <span className={`font-mono text-sm font-bold tabular-nums ${pctColor(pct)}`}>
          {pctRounded}%
        </span>
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
