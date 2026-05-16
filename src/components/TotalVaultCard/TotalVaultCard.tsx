import { SectionLabel } from '../SectionLabel/SectionLabel';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { IconEdit } from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';

interface TotalVaultCardProps {
  saved: number;
  target: number;
  onEdit?: () => void;
  editAriaLabel?: string;
}

function pctColor(pct: number): string {
  if (pct >= 100) return 'text-accent-leaf';
  if (pct >= 75)  return 'text-accent-gold';
  if (pct >= 25)  return 'text-brand-800';
  return 'text-ink-muted';
}

export function TotalVaultCard({ saved, target, onEdit, editAriaLabel }: TotalVaultCardProps) {
  const { copy } = useI18n();
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const pctRounded = Math.round(pct);
  return (
    <section className="rounded-xl bg-surface shadow-soft p-5">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel tone="muted">{copy.dashboard.recordedVault}</SectionLabel>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-sm font-bold tabular-nums ${pctColor(pct)}`}>
            {pctRounded}%
          </span>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={editAriaLabel}
              className="flex h-7 w-7 items-center justify-center rounded-pill text-ink-muted hover:text-ink active:scale-95 transition-transform"
            >
              <IconEdit size={16} />
            </button>
          )}
        </div>
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
