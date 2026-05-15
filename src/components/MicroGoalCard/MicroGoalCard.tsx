import type { ReactNode } from 'react';
import { IconBubble } from '../IconBubble/IconBubble';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { useI18n } from '../../i18n/useI18n';

/**
 * "Next Win" micro-goal card on the dashboard. Shows the closest upcoming
 * micro-milestone (e.g. "Kyoto Deposit") with the remaining gap and a
 * slim progress bar.
 */

interface MicroGoalCardProps {
  icon: ReactNode;
  title: string;
  remaining: number;
  pct: number;
  subtitle?: string;
}

export function MicroGoalCard({ icon, title, remaining, pct, subtitle }: MicroGoalCardProps) {
  const { copy, formatMoney } = useI18n();
  const d = copy.dashboard;
  return (
    <section className="rounded-xl bg-brand-50 p-4 flex items-center gap-4">
      <IconBubble tone="solid" size="lg">{icon}</IconBubble>
      <div className="flex-1 min-w-0">
        <SectionLabel tone="brand">{d.nextWinLabel}</SectionLabel>
        <div className="mt-1 font-mono text-base font-bold text-ink truncate">{title}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-xs text-ink-muted">
            {d.remainingToGo(formatMoney(remaining))}
          </span>
          {subtitle && (
            <span className="font-mono text-xs text-brand-800 truncate">· {subtitle}</span>
          )}
        </div>
        <div className="mt-2">
          <ProgressBar value={pct} tone="primary" size="sm" animate />
        </div>
      </div>
    </section>
  );
}
