import type { ReactNode } from 'react';
import { IconBubble } from '../IconBubble/IconBubble';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';

/**
 * Bucket header used at the top of the Add Money screen and Bucket Detail
 * page. Solid orange IconBubble + bucket name + current / target + a
 * full-width progress bar underneath.
 */

interface BucketHeaderProps {
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
}

export function BucketHeader({ icon, name, saved, target }: BucketHeaderProps) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  return (
    <section className="rounded-[22px] border border-white/80 bg-surface p-5 shadow-[0_14px_34px_rgba(58,42,31,0.10),0_2px_6px_rgba(58,42,31,0.05)]">
      <div className="flex items-center gap-4">
        <IconBubble tone="solid" size="xl" className="shrink-0">{icon}</IconBubble>
        <div className="flex-1 min-w-0">
          <h2 className="truncate font-mono text-xl font-bold leading-tight text-ink">{name}</h2>
          <div className="mt-2 font-mono text-sm font-medium text-ink-muted">
            {formatCurrency(saved)} <span className="text-ink-dim">/ {formatCurrency(target)}</span>
          </div>
        </div>
      </div>
      <div className="mt-5">
        <ProgressBar value={pct} tone="primary" size="lg" animate />
      </div>
    </section>
  );
}
