import { memo, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { IconBubble } from '../IconBubble/IconBubble';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';
import Pressable from '../Pressable/Pressable';
import { useAnimatedNumbers } from '../../hooks/useAnimatedNumber';
import { useI18n } from '../../i18n/useI18n';
import { IconArrowUpRight, IconCheckCircle, IconClock, IconClockAlert, IconWarning } from '../Icon/Icon';
import type { PaceStatus } from '../../types';

interface BucketRowProps {
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
  onClick?: () => void;
  expanded?: boolean;
  status?: {
    kind: 'focus' | 'next' | 'done' | 'queued' | 'overdue';
    label: string;
  };
  deadline?: string | null;
  pace?: {
    status: PaceStatus;
    remainingDays: number;
  } | null;
}

const STATUS_STYLES: Record<string, string> = {
  focus: 'bg-brand-100 text-brand-700',
  next: 'bg-blue-50 text-blue-600',
  done: 'bg-green-100 text-green-700',
  overdue: 'bg-danger-soft text-danger',
};

const PACE_CONFIG: Record<PaceStatus, { className: string; Icon: typeof IconArrowUpRight }> = {
  ahead: { className: 'text-accent-leaf', Icon: IconArrowUpRight },
  on_track: { className: 'text-ink-muted', Icon: IconCheckCircle },
  behind: { className: 'text-brand-700', Icon: IconWarning },
  critical: { className: 'text-danger', Icon: IconWarning },
};

function CountdownLabel({ remainingDays, copy }: { remainingDays: number; copy: ReturnType<typeof useI18n>['copy'] }) {
  const bc = copy.bucketCard;
  if (remainingDays === 0) return <span className="text-danger font-bold">{bc.deadlineToday}</span>;
  if (remainingDays < 0) return <span className="text-danger">{bc.daysOverdue(Math.abs(remainingDays))}</span>;
  if (remainingDays <= 7) return <span className="text-brand-700">{bc.daysLeftUrgent(remainingDays)}</span>;
  return <span className="text-ink-muted">{bc.daysLeft(remainingDays)}</span>;
}

export const BucketRow = memo(function BucketRow({ icon, name, saved, target, onClick, status, deadline, pace }: BucketRowProps) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const [animSaved, animTarget, animPct] = useAnimatedNumbers([saved, target, pct]);
  const wasComplete = useRef(target > 0 && saved >= target);
  const { copy } = useI18n();

  useEffect(() => {
    const isComplete = target > 0 && saved >= target;
    if (isComplete && !wasComplete.current && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
    wasComplete.current = isComplete;
  }, [saved, target]);

  const hasDeadlineInfo = deadline != null && pace != null;
  const paceConfig = pace ? PACE_CONFIG[pace.status] : null;
  const CountdownIcon = pace && pace.remainingDays <= 7 ? IconClockAlert : IconClock;
  const countdownIconClass = pace && pace.remainingDays <= 7 ? 'text-danger' : 'text-ink-dim';
  const paceLabel = pace ? copy.bucketCard[
    pace.status === 'ahead' ? 'paceAhead'
    : pace.status === 'on_track' ? 'paceOnTrack'
    : pace.status === 'behind' ? 'paceBehind'
    : 'paceCritical'
  ] : null;

  return (
    <Pressable
      onClick={onClick}
      className="relative flex aspect-square w-full flex-col items-center rounded-2xl bg-surface px-4 pb-4 pt-7 text-center shadow-soft"
    >
      {status && status.kind !== 'queued' ? (
        <span className={`absolute right-3 top-3 rounded-pill px-2 py-0.5 font-mono text-[10px] font-bold leading-tight ${STATUS_STYLES[status.kind] ?? ''}`}>
          {status.label}
        </span>
      ) : (
        <span className="absolute right-4 top-4 font-mono text-sm font-bold text-brand-500">
          {Math.round(animPct)}%
        </span>
      )}

      <IconBubble tone="peach" size="md" className="text-brand-500">{icon}</IconBubble>

      <div className="mt-3 w-full">
        <p className="truncate font-mono text-sm font-bold leading-tight text-ink">{name}</p>
        <p className="mt-1.5 font-mono text-xs leading-tight text-ink-muted">
          {formatCurrency(Math.round(animSaved))} / {formatCurrency(Math.round(animTarget))}
        </p>
      </div>

      <div className="mt-auto w-full pt-2">
        {hasDeadlineInfo && paceConfig && (
          <div className="bucket-card-meta mb-2 flex items-center justify-between gap-1 text-[11px] font-mono leading-tight">
            <span className="flex min-w-0 items-center gap-1 whitespace-nowrap">
              <CountdownIcon size={12} className={`shrink-0 ${countdownIconClass}`} />
              <CountdownLabel remainingDays={pace!.remainingDays} copy={copy} />
            </span>
            <span className={`flex min-w-0 items-center gap-0.5 whitespace-nowrap font-bold ${paceConfig.className}`}>
              <paceConfig.Icon size={12} className="shrink-0" />
              {paceLabel}
            </span>
          </div>
        )}
        <ProgressBar value={animPct} tone="primary" size="sm" className="bg-brand-50" />
      </div>
    </Pressable>
  );
});
