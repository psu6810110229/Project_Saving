import type { ReactNode } from 'react';
import { IconBubble } from '../IconBubble/IconBubble';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { ProjectedProgressBar } from '../ProjectedProgressBar/ProjectedProgressBar';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';

interface BucketHeaderProps {
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
  pendingDeposit?: number;
}

export function BucketHeader({ icon, name, saved, target, pendingDeposit = 0 }: BucketHeaderProps) {
  const { copy, formatMoney } = useI18n();
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const showProjection = pendingDeposit > 0 && target > 0;
  const projectedPct = showProjection ? Math.min(100, ((saved + pendingDeposit) / target) * 100) : pct;
  const projectedPctRounded = Math.round(projectedPct);

  return (
    <section className="rounded-[22px] border border-white/80 bg-surface p-5 shadow-[0_14px_34px_rgba(58,42,31,0.10),0_2px_6px_rgba(58,42,31,0.05)]">
      <div className="flex items-center gap-4">
        <IconBubble tone="solid" size="xl" className="shrink-0 [&_svg]:h-9 [&_svg]:w-9">{icon}</IconBubble>
        <div className="flex-1 min-w-0">
          <h2 className="truncate font-mono text-xl font-bold leading-tight text-ink">{name}</h2>
          <div className="mt-2 font-mono text-sm font-medium text-ink-muted">
            {formatCurrency(saved)} <span className="text-ink-dim">/ {formatCurrency(target)}</span>
          </div>
        </div>
        {showProjection && (
          <span className="font-mono text-xs font-bold text-brand-500">{projectedPctRounded}%</span>
        )}
      </div>
      <div className="mt-5">
        {showProjection ? (
          <ProjectedProgressBar current={pct} projected={projectedPct} />
        ) : (
          <ProgressBar value={pct} tone="primary" size="lg" animate />
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
            <span className="block font-mono text-xs font-bold text-brand-500">
              {copy.addMoney.projectedLabel(formatMoney(pendingDeposit), projectedPctRounded)}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
