import { memo } from 'react';
import { ProjectedProgressBar } from '../ProjectedProgressBar/ProjectedProgressBar';
import { useI18n } from '../../i18n/useI18n';
import { useAnimatedNumbers } from '../../hooks/useAnimatedNumber';

interface ProjectedProgressCardProps {
  bucketName: string;
  saved: number;
  target: number;
  pendingDeposit: number;
}

export const ProjectedProgressCard = memo(function ProjectedProgressCard({
  bucketName,
  saved,
  target,
  pendingDeposit,
}: ProjectedProgressCardProps) {
  const { copy, formatMoney } = useI18n();
  const currentPct = target > 0 ? (saved / target) * 100 : 0;
  const projectedPct = target > 0 ? Math.min(100, ((saved + pendingDeposit) / target) * 100) : 0;
  const [animCurrent, animProjected, animSaved, animPending] = useAnimatedNumbers([currentPct, projectedPct, saved, pendingDeposit]);
  const projectedPctRounded = Math.round(animProjected);

  return (
    <section className="rounded-xl border border-brand-100 bg-surface p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate font-mono text-sm font-bold leading-tight text-ink">
          {copy.addMoney.projectedProgress(bucketName)}
        </h3>
        <span className="font-mono text-xs font-bold text-brand-500">{projectedPctRounded}%</span>
      </div>
      <div className="mt-3">
        <ProjectedProgressBar current={animCurrent} projected={animProjected} />
      </div>
      <div className="mt-4 grid grid-cols-2 divide-x divide-well">
        <div className="pr-3">
          <span className="block font-mono text-xs text-ink-muted">
            {copy.addMoney.savedLabel(formatMoney(Math.round(animSaved)))}
          </span>
        </div>
        <div className="pl-3 text-right">
          <span className="block font-mono text-xs font-bold text-brand-500">
            {copy.addMoney.projectedLabel(formatMoney(Math.round(animPending)), projectedPctRounded)}
          </span>
        </div>
      </div>
    </section>
  );
});
