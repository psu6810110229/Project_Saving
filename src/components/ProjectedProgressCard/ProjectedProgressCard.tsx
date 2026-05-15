import { SectionLabel } from '../SectionLabel/SectionLabel';
import { ProjectedProgressBar } from '../ProjectedProgressBar/ProjectedProgressBar';
import { useI18n } from '../../i18n/useI18n';

/**
 * Add Money projected progress card. Shows the bucket name, current
 * saved amount, the dual-segment ProjectedProgressBar, and the projected
 * final percentage.
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
  const { copy, formatMoney } = useI18n();
  const currentPct = target > 0 ? (saved / target) * 100 : 0;
  const projectedPct = target > 0 ? Math.min(100, ((saved + pendingDeposit) / target) * 100) : 0;

  return (
    <section className="rounded-xl bg-surface shadow-soft p-5">
      <SectionLabel tone="muted">{copy.addMoney.projectedProgress(bucketName)}</SectionLabel>
      <div className="mt-3">
        <ProjectedProgressBar current={currentPct} projected={projectedPct} />
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="font-mono text-xs text-ink-muted">{copy.addMoney.savedLabel(formatMoney(saved))}</span>
        <span className="font-mono text-xs font-bold text-brand-500">
          {copy.addMoney.projectedLabel(formatMoney(pendingDeposit), Math.round(projectedPct))}
        </span>
      </div>
    </section>
  );
}
