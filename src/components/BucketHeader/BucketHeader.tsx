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
    <section className="rounded-xl bg-surface shadow-soft p-5">
      <div className="flex items-center gap-4">
        <IconBubble tone="solid" size="xl">{icon}</IconBubble>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-lg font-bold text-ink truncate">{name}</div>
          <div className="mt-1 font-mono text-sm text-ink-muted">
            {formatCurrency(saved)} <span className="text-ink-dim">/ {formatCurrency(target)}</span>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <ProgressBar value={pct} tone="primary" size="lg" animate />
      </div>
    </section>
  );
}
