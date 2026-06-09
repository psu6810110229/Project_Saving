import { memo, type CSSProperties, type ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useReducedMotion } from 'framer-motion';
import { IconArrowRight, IconPiggyBank, IconVault } from '../Icon/Icon';
import { CATEGORY_ACCENT } from '../../lib/bucketAccent';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';
import type { BalanceCheckpoint } from '../../types';

/** Stable id of the draggable unallocated-surplus chip. */
export const ALLOCATION_DRAG_ID = 'allocation-pool';

interface BalanceCheckStatusProps {
  latest: BalanceCheckpoint | null;
  /** Verified surplus not yet placed in any bucket (>= 0). */
  unallocatedPool: number;
  /**
   * Allocations exceeding the verified balance (>= 0) — buckets currently
   * claim more than the real money. Triggers the calm shortfall nudge.
   */
  overAllocated?: number;
  onCheck: () => void;
  /** Tap handler for the shortfall row — opens the sync panel directly. */
  onSync?: () => void;
  /** When true the surplus bar is draggable (bucket transfer mode, not edit). */
  canAllocate?: boolean;
  /** Tap fallback for allocation (keyboard/touch/reduced-motion). */
  onAllocate?: () => void;
  /** At least one deposit was recorded after the latest manual balance check. */
  needsFreshCheck?: boolean;
}

type StatusOrbitTone = 'amber' | 'red' | 'green';

const STAY_ACCENT = CATEGORY_ACCENT.stay;
const OTHER_ACCENT = CATEGORY_ACCENT.other;

const ORBIT_TONES: Record<StatusOrbitTone, CSSProperties> = {
  amber: {
    ['--status-orbit-soft' as string]: 'rgba(245, 158, 11, 0.12)',
    ['--status-orbit-core' as string]: 'rgba(249, 115, 22, 0.88)',
    ['--status-orbit-glow' as string]: 'rgba(251, 191, 36, 0.48)',
    ['--status-orbit-static' as string]: 'rgba(251, 191, 36, 0.18)',
    ['--status-orbit-speed' as string]: '7.2s',
  },
  red: {
    ['--status-orbit-soft' as string]: withAlpha(OTHER_ACCENT.accent, 0.14),
    ['--status-orbit-core' as string]: withAlpha(OTHER_ACCENT.accent, 0.9),
    ['--status-orbit-glow' as string]: withAlpha(OTHER_ACCENT.border, 0.56),
    ['--status-orbit-static' as string]: withAlpha(OTHER_ACCENT.border, 0.22),
    ['--status-orbit-speed' as string]: '5.8s',
  },
  green: {
    ['--status-orbit-soft' as string]: withAlpha(STAY_ACCENT.accent, 0.14),
    ['--status-orbit-core' as string]: withAlpha(STAY_ACCENT.accent, 0.92),
    ['--status-orbit-glow' as string]: withAlpha(STAY_ACCENT.border, 0.56),
    ['--status-orbit-static' as string]: withAlpha(STAY_ACCENT.border, 0.22),
    ['--status-orbit-speed' as string]: '6.4s',
  },
};

/** Small 2x3 grip dots that signal "draggable". */
function GripDots() {
  return (
    <span aria-hidden className="grid grid-cols-2 gap-[3px]">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-current opacity-60" />
      ))}
    </span>
  );
}

function StatusCardShell({
  tone,
  className,
  style,
  children,
}: {
  tone?: StatusOrbitTone | null;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <section
      className={`relative isolate ${className}`}
      style={{
        ...(tone ? ORBIT_TONES[tone] : {}),
        ...style,
      }}
    >
      {tone && (
        <div aria-hidden className="status-orbit pointer-events-none absolute inset-0 rounded-[inherit]">
          <div className="status-orbit__glow absolute inset-0 rounded-[inherit]" />
          <div className="status-orbit__ring absolute inset-0 rounded-[inherit]" />
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </section>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized;

  if (!/^[\da-fA-F]{6}$/.test(expanded)) return hex;

  const value = Number.parseInt(expanded, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Balance-check surface, shown under the sub-goal heading and above the bucket
 * grid. Three attention states now get a soft orbit border:
 *
 * - Never checked yet: warm amber prompt.
 * - Shortfall: red sync warning.
 * - Surplus waiting for allocation: green guide rail.
 */
export const BalanceCheckStatus = memo(function BalanceCheckStatus({
  latest,
  unallocatedPool,
  overAllocated = 0,
  onCheck,
  onSync,
  canAllocate = false,
  onAllocate,
  needsFreshCheck = false,
}: BalanceCheckStatusProps) {
  const { copy } = useI18n();
  const a = copy.reconcile.allocate;
  const reduceMotion = useReducedMotion();
  const hasSurplus = unallocatedPool > 0.005;
  const hasShortfall = !hasSurplus && overAllocated > 0.005;
  const needsFirstCheck = !hasSurplus && !hasShortfall && latest === null;
  const needsCheckAttention = !hasSurplus && !hasShortfall && (needsFirstCheck || needsFreshCheck);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ALLOCATION_DRAG_ID,
    data: { type: 'allocation' },
    disabled: !canAllocate || !hasSurplus,
  });

  const checkedText = latest ? formatCurrency(latest.actual_amount) : null;

  const checkButton = (
    <button
      type="button"
      aria-label={a.cardCheckCta}
      title={a.cardCheckCta}
      onClick={onCheck}
      className="group grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-brand-700 text-white shadow-[0_10px_22px_rgba(234,88,12,0.28)] ring-4 ring-orange-100 transition-transform active:scale-[0.94]"
    >
      <IconArrowRight size={20} className="transition-transform group-hover:translate-x-0.5" strokeWidth={2.6} />
    </button>
  );

  if (hasShortfall) {
    return (
      <StatusCardShell tone="red" className="rounded-xl bg-surface p-3 shadow-soft">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-well text-ink-muted">
              <IconVault size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono-th text-[11px] font-semibold text-ink-muted">
                {a.cardShortfallLabel}
              </p>
              <p className="truncate font-mono text-sm font-bold text-danger">
                -{formatCurrency(overAllocated)}
              </p>
            </div>
            {checkButton}
          </div>

          <button
            type="button"
            onClick={onSync ?? onCheck}
            aria-label={`${a.cardShortfallNudge} · ${formatCurrency(overAllocated)}`}
            className="flex w-full items-center gap-2.5 rounded-lg bg-danger-soft/55 px-3 py-2.5 text-left shadow-soft ring-1 ring-danger/10 transition-transform active:scale-[0.99]"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/72 text-danger">
              <IconVault size={16} />
            </span>
            <span className="min-w-0 flex-1 font-mono-th text-xs font-semibold leading-snug text-ink-muted">
              {a.cardShortfallNudge}
            </span>
            <IconArrowRight size={16} strokeWidth={2.4} className="shrink-0 text-danger" />
          </button>
        </div>
      </StatusCardShell>
    );
  }

  if (!hasSurplus) {
    return (
      <StatusCardShell
        tone={needsCheckAttention ? 'amber' : null}
        className="rounded-xl bg-surface px-4 py-3 shadow-soft"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-800">
            <IconVault size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono-th text-[12px] font-semibold text-ink-muted">
              {a.cardCheckedLabel}
            </p>
            <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
              {checkedText ? (
                <>
                  <p className="min-w-0 truncate font-mono text-lg font-bold text-ink">{checkedText}</p>
                  {!needsFreshCheck && (
                    <p className="shrink-0 truncate font-mono-th text-xs font-semibold text-ink-muted">
                      {a.cardMatched}
                    </p>
                  )}
                </>
              ) : (
                <p className="truncate font-mono-th text-xs text-ink-dim">{a.cardNeverChecked}</p>
              )}
            </div>
            {checkedText && needsFreshCheck && (
              <p className="mt-1 font-mono-th text-[11px] leading-snug text-brand-800">
                {a.cardNeedsFreshCheck}
              </p>
            )}
            {!checkedText && (
              <p className="mt-1 font-mono-th text-[11px] leading-snug text-ink-muted">
                {a.cardCheckIntro}
              </p>
            )}
          </div>
          {checkButton}
        </div>
      </StatusCardShell>
    );
  }

  const barStyle: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging && !reduceMotion ? 1.02 : 1})`
      : undefined,
    zIndex: isDragging ? 120 : undefined,
    transition: isDragging ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
    touchAction: 'manipulation',
    cursor: canAllocate ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
  };

  return (
    <StatusCardShell
      tone="green"
      className="rounded-xl bg-surface p-3 shadow-soft"
      style={{ zIndex: isDragging ? 110 : 10 }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-800">
            <IconVault size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono-th text-[11px] font-semibold text-ink-muted">
              {a.cardCheckedLabel}
            </p>
            <p className="truncate font-mono text-sm font-bold text-ink-muted">{checkedText}</p>
          </div>
          {checkButton}
        </div>

        <button
          type="button"
          ref={setNodeRef}
          style={barStyle}
          onClick={onAllocate}
          aria-label={`${a.surplusLabel} ${formatCurrency(unallocatedPool)} · ${a.dragHint}`}
          className={
            'flex w-full items-center gap-2.5 rounded-lg bg-gradient-to-r from-emerald-50 via-green-50 to-brand-50 px-3 py-2.5 text-left ring-1 ring-emerald-200/70 '
            + (isDragging ? 'shadow-neuRaised' : 'shadow-soft')
          }
          {...(canAllocate ? attributes : {})}
          {...(canAllocate ? listeners : {})}
        >
          <span className="shrink-0 text-emerald-700"><GripDots /></span>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/72 text-emerald-700">
            <IconPiggyBank size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono-th text-[11px] font-semibold text-emerald-700">
              {a.surplusLabel}
            </span>
            <span className="block truncate font-mono text-base font-bold leading-tight text-emerald-900">
              {formatCurrency(unallocatedPool)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 font-mono-th text-[11px] font-semibold text-emerald-700">
            {a.dragHint}
            <IconArrowRight size={14} strokeWidth={2.6} />
          </span>
        </button>
      </div>
    </StatusCardShell>
  );
});
