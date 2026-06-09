import type { ReactNode } from 'react';
import { IconPauseCircle } from '../Icon/Icon';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { ProjectedProgressBar } from '../ProjectedProgressBar/ProjectedProgressBar';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';
import { CATEGORY_ACCENT, DEFAULT_ACCENT } from '../../lib/bucketAccent';
import type { BucketCategory } from '../../types';

interface BucketHeaderProps {
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
  pendingDeposit?: number;
  category?: BucketCategory;
  isPaused?: boolean;
}

export function BucketHeader({
  icon,
  name,
  saved,
  target,
  pendingDeposit = 0,
  category,
  isPaused = false,
}: BucketHeaderProps) {
  const { copy, formatMoney } = useI18n();
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const showProjection = pendingDeposit > 0 && target > 0;
  const projectedPct = showProjection ? Math.min(100, ((saved + pendingDeposit) / target) * 100) : pct;
  const projectedPctRounded = Math.round(projectedPct);
  const pausedAccent = (category && CATEGORY_ACCENT[category]) || DEFAULT_ACCENT;
  const pausedStyle = isPaused
    ? {
        borderColor: pausedAccent.border,
        background: `linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, ${pausedAccent.tint} 100%)`,
        filter: 'saturate(0.1)',
      }
    : undefined;
  const accentTextStyle = isPaused ? { color: pausedAccent.accent } : undefined;

  return (
    <section
      className="rounded-[22px] border border-white/80 bg-surface p-5 shadow-[0_14px_34px_rgba(58,42,31,0.10),0_2px_6px_rgba(58,42,31,0.05)]"
      style={pausedStyle}
    >
      <div className="flex items-center gap-4">
        <span
          className={`inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full [&_svg]:h-9 [&_svg]:w-9 ${
            isPaused ? '' : 'bg-brand-500 text-ink-inverse shadow-haloOrange'
          }`}
          style={isPaused ? { backgroundColor: pausedAccent.tint, color: pausedAccent.accent } : undefined}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-mono text-xl font-bold leading-tight text-ink">{name}</h2>
          <div className="mt-2 font-mono text-sm font-medium text-ink-muted">
            <span style={accentTextStyle}>{formatCurrency(saved)}</span> <span className="text-ink-dim">/ {formatCurrency(target)}</span>
          </div>
        </div>
        {(showProjection || isPaused) && (
          <div className="flex shrink-0 flex-col items-end gap-2 self-start">
            {showProjection && (
              <span className="font-mono text-xs font-bold" style={accentTextStyle ?? { color: '#E16F3D' }}>
                {projectedPctRounded}%
              </span>
            )}
            {isPaused && (
              <span className="inline-flex items-center gap-1 rounded-pill border border-white/90 bg-surface/95 px-2.5 py-1 font-mono-th text-[11px] font-semibold leading-tight text-ink shadow-soft">
                <IconPauseCircle size={12} className="shrink-0 text-ink-muted" />
                {copy.bucketCard.pausedPill}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="mt-5">
        {showProjection ? (
          <ProjectedProgressBar current={pct} projected={projectedPct} />
        ) : (
          <ProgressBar
            value={pct}
            tone={isPaused ? 'theme' : 'primary'}
            themeHex={isPaused ? pausedAccent.accent : undefined}
            size="lg"
            animate
          />
        )}
      </div>
      {showProjection && (
        <div className="mt-3 grid grid-cols-2 divide-x divide-well">
          <div className="pr-3">
            <span className="block font-mono text-xs text-ink-muted">
              {copy.addMoney.savedLabel(formatMoney(saved))}
            </span>
          </div>
          <div className="pl-3 text-right">
            <span className="block font-mono text-xs font-bold" style={accentTextStyle ?? { color: '#E16F3D' }}>
              {copy.addMoney.projectedLabel(formatMoney(pendingDeposit), projectedPctRounded)}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
