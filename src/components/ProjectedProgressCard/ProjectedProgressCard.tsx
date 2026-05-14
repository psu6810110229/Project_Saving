import { SectionLabel } from '../SectionLabel/SectionLabel';
import { ProjectedProgressBar } from '../ProjectedProgressBar/ProjectedProgressBar';
import { formatCurrency } from '../../lib/format';

/**
 * Add Money "projected progress" card. Shows the bucket name, current
 * saved amount, the dual-segment ProjectedProgressBar (current + delta),
 * and the projected final percentage off to the right.
 */

interface ProjectedProgressCardProps {
  bucketName: string;
  saved: number;
  target: number;
  pendingDeposit: number;
}

export function ProjectedProgressCard({
  bucketName,
  saved,
  target,
  pendingDeposit,
}: ProjectedProgressCardProps) {
  const currentPct = target > 0 ? (saved / target) * 100 : 0;
  const projectedPct = target > 0 ? Math.min(100, ((saved + pendingDeposit) / target) * 100) : 0;

  return (
    <section className="rounded-xl bg-surface shadow-soft p-5">
      <SectionLabel tone="muted">Projected Progress · {bucketName}</SectionLabel>
      <div className="mt-3">
        <ProjectedProgressBar current={currentPct} projected={projectedPct} />
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="font-mono text-xs text-ink-muted">{formatCurrency(saved)} saved</span>
        <span className="font-mono text-xs font-bold text-brand-500">
          +{formatCurrency(pendingDeposit)} projected → {Math.round(projectedPct)}%
        </span>
      </div>
    </section>
  );
}
