import { SectionLabel } from '../SectionLabel/SectionLabel';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';

interface TotalVaultCardProps {
  saved: number;
  target: number;
}

export function TotalVaultCard({ saved, target }: TotalVaultCardProps) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  return (
    <section className="rounded-xl bg-surface shadow-soft p-5">
      <SectionLabel tone="muted">Recorded Vault</SectionLabel>
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
