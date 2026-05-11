import type { ReactNode } from 'react';
import { IconBubble } from '../IconBubble/IconBubble';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';

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
  return (
    <section className="rounded-3xl bg-brand-50 p-4 flex items-center gap-4">
      <IconBubble tone="solid" size="lg">{icon}</IconBubble>
      <div className="flex-1 min-w-0">
        <SectionLabel tone="brand">Next Win</SectionLabel>
        <div className="mt-1 font-mono text-base font-bold text-ink truncate">{title}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-xs text-ink-muted">
            {formatCurrency(remaining)} to go
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
