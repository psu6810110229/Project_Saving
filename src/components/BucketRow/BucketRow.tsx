import { memo, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';
import Pressable from '../Pressable/Pressable';
import { useAnimatedNumbers } from '../../hooks/useAnimatedNumber';
import { useI18n } from '../../i18n/useI18n';
import { useSecondaryMotionReady } from '../../lib/animationBudget';
import { IconArrowUpRight, IconCheckCircle, IconClock, IconClockAlert, IconWarning } from '../Icon/Icon';
import { CATEGORY_ACCENT, DEFAULT_ACCENT } from '../../lib/bucketAccent';
import type { BucketCategory, PaceStatus } from '../../types';

interface BucketRowProps {
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
  category?: BucketCategory;
  onClick?: () => void;
  expanded?: boolean;
  status?: {
    kind: 'focus' | 'next' | 'done' | 'queued' | 'overdue';
    label: string;
  };
  deadline?: string | null;
  completedAt?: string | null;
  variant?: 'default' | 'completed';
  pace?: {
    status: PaceStatus;
    remainingDays: number;
  } | null;
}

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

export const BucketRow = memo(function BucketRow({
  icon,
  name,
  saved,
  target,
  category,
  onClick,
  status,
  deadline,
  completedAt,
  variant = 'default',
  pace,
}: BucketRowProps) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const [animSaved, animTarget, animPct] = useAnimatedNumbers([saved, target, pct]);
  const wasComplete = useRef(target > 0 && saved >= target);
  const { copy, formatShortDateKey } = useI18n();
  const secondaryMotionReady = useSecondaryMotionReady();
  const accent = (category && CATEGORY_ACCENT[category]) || DEFAULT_ACCENT;

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
  const completedDateLabel = completedAt ? formatShortDateKey(completedAt.slice(0, 10)) : status?.label;

  // Focus ("ลำดับปัจจุบัน") and next ("ลำดับถัดไป") cards alternate their corner
  // between the badge and the percentage every 2s; static if reduced motion is on.
  const alternateEnabled = !REDUCED_MOTION && secondaryMotionReady && (status?.kind === 'focus' || status?.kind === 'next');
  const [showPct, setShowPct] = useState(false);

  useEffect(() => {
    if (!alternateEnabled) return;
    // Percentage lingers longer (4s) than the badge (2s).
    const delay = showPct ? 4000 : 2000;
    const id = window.setTimeout(() => setShowPct(v => !v), delay);
    return () => window.clearTimeout(id);
  }, [alternateEnabled, showPct]);

  const showBadge = !!status && status.kind !== 'queued' && !(alternateEnabled && showPct);

  if (variant === 'completed') {
    return (
      <Pressable
        onClick={onClick}
        className="relative flex aspect-square w-full flex-col rounded-2xl border-[1.5px] bg-surface p-4 text-left shadow-soft"
        style={{ borderColor: accent.border }}
      >
        <span className="absolute right-3 top-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
          <IconCheckCircle size={16} />
        </span>
        <span
          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full [&_svg]:h-7 [&_svg]:w-7"
          style={{ background: accent.tint, color: accent.accent }}
        >
          {icon}
        </span>
        <div className="mt-3 w-full min-w-0">
          <p className="truncate font-mono text-sm font-bold leading-tight text-ink">{name}</p>
          <p className="mt-1 flex min-w-0 items-baseline gap-1 font-mono leading-none">
            <span className="shrink-0 whitespace-nowrap text-sm font-bold" style={{ color: accent.accent }}>
              {formatCurrency(Math.round(animSaved))}
            </span>
            <span className="truncate text-[11px] text-ink-dim">
              / {formatCurrency(Math.round(animTarget))}
            </span>
          </p>
        </div>
        {completedDateLabel && (
          <p className="mt-auto pt-2 font-mono text-[11px] font-bold leading-tight" style={{ color: accent.accent }}>
            {completedDateLabel}
          </p>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onClick={onClick}
      className="relative flex aspect-square w-full flex-col rounded-2xl border-[1.5px] bg-surface p-4 text-left shadow-soft"
      style={{ borderColor: accent.border }}
    >
      {showBadge ? (
        <span
          key="badge"
          className="absolute right-3 top-3 rounded-pill px-2 py-0.5 font-mono text-[10px] font-bold leading-tight animate-corner-pop"
          style={{ background: accent.tint, color: accent.accent }}
        >
          {status!.label}
        </span>
      ) : (
        <span
          key="pct"
          className="absolute right-3 top-3 font-mono text-sm font-bold animate-corner-pop"
          style={{ color: accent.accent }}
        >
          {Math.round(animPct)}%
        </span>
      )}

      <span
        className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full [&_svg]:h-7 [&_svg]:w-7"
        style={{ background: accent.tint, color: accent.accent }}
      >
        {icon}
      </span>

      <div className="mt-3 w-full min-w-0">
        <p className="truncate font-mono text-sm font-bold leading-tight text-ink">{name}</p>
        <p className="mt-1 flex min-w-0 items-baseline gap-1 font-mono leading-none">
          <span className="shrink-0 whitespace-nowrap text-lg font-bold" style={{ color: accent.accent }}>
            {formatCurrency(Math.round(animSaved))}
          </span>
          <span className="truncate text-xs text-ink-dim">
            / {formatCurrency(Math.round(animTarget))}
          </span>
        </p>
      </div>

      <div className="mt-2 w-full">
        <ProgressBar value={animPct} tone="theme" themeHex={accent.accent} size="sm" className="bg-well" />
      </div>

      {hasDeadlineInfo && paceConfig && (
        <div className="bucket-card-meta mt-auto flex w-full items-center justify-between gap-1.5 pt-2 font-mono text-[10px] leading-tight">
          <span className="flex min-w-0 items-center gap-1 whitespace-nowrap">
            <CountdownIcon size={12} className={`shrink-0 ${countdownIconClass}`} />
            <CountdownLabel remainingDays={pace!.remainingDays} copy={copy} />
          </span>
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-well" />
          <span className={`flex min-w-0 items-center gap-1 whitespace-nowrap font-bold ${paceConfig.className}`}>
            <paceConfig.Icon size={12} className="shrink-0" />
            {paceLabel}
          </span>
        </div>
      )}
    </Pressable>
  );
});
