import { memo, type CSSProperties } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useReducedMotion } from 'framer-motion';
import { IconArrowRight, IconPiggyBank, IconVault } from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';
import type { BalanceCheckpoint } from '../../types';

/** Stable id of the draggable unallocated-surplus chip. */
export const ALLOCATION_DRAG_ID = 'allocation-pool';

interface BalanceCheckStatusProps {
  latest: BalanceCheckpoint | null;
  /** Verified surplus not yet placed in any bucket (≥ 0). */
  unallocatedPool: number;
  /**
   * Allocations exceeding the verified balance (≥ 0) — buckets currently
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
}

/** Small 2×3 grip dots that signal "draggable". */
function GripDots() {
  return (
    <span aria-hidden className="grid grid-cols-2 gap-[3px]">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-current opacity-60" />
      ))}
    </span>
  );
}

/**
 * Balance-check surface, shown under the "เป้าหมายย่อย" heading and above
 * the bucket grid (plan 56 §7.3). Two states:
 *
 *  • Settled (pool = 0) — a slim row: the checked balance + a Check CTA.
 *  • Surplus (pool > 0) — the unallocated amount becomes the hero: a
 *    full-width accent bar the user drags down onto a bucket to allocate
 *    (or taps as the accessible fallback). The checked balance drops to a
 *    quiet context line so the surplus reads first.
 */
export const BalanceCheckStatus = memo(function BalanceCheckStatus({
  latest,
  unallocatedPool,
  overAllocated = 0,
  onCheck,
  onSync,
  canAllocate = false,
  onAllocate,
}: BalanceCheckStatusProps) {
  const { copy } = useI18n();
  const a = copy.reconcile.allocate;
  const reduceMotion = useReducedMotion();
  const hasSurplus = unallocatedPool > 0.005;
  const hasShortfall = !hasSurplus && overAllocated > 0.005;

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

  // ── Shortfall state: buckets claim more than the verified balance. ──
  // Two-tier (mirrors the surplus state): the top row keeps the round
  // Check CTA so a balance check is always reachable; the bar below is a
  // calm, neutral sync action that opens the write-down panel (slice 4b).
  if (hasShortfall) {
    return (
      <section className="relative z-10 flex flex-col gap-2 rounded-xl bg-surface p-3 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-well text-ink-muted">
            <IconVault size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono-th text-[11px] font-semibold text-ink-muted">
              {a.cardShortfallLabel}
            </p>
            <p className="truncate font-mono text-sm font-bold text-ink-muted">
              −{formatCurrency(overAllocated)}
            </p>
          </div>
          {checkButton}
        </div>

        <button
          type="button"
          onClick={onSync ?? onCheck}
          aria-label={`${a.cardShortfallNudge} · ${formatCurrency(overAllocated)}`}
          className="flex w-full items-center gap-2.5 rounded-lg bg-well px-3 py-2.5 text-left shadow-soft ring-1 ring-black/5 transition-transform active:scale-[0.99]"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface text-ink-muted">
            <IconVault size={16} />
          </span>
          <span className="min-w-0 flex-1 font-mono-th text-xs font-semibold leading-snug text-ink-muted">
            {a.cardShortfallNudge}
          </span>
          <IconArrowRight size={16} strokeWidth={2.4} className="shrink-0 text-ink-muted" />
        </button>
      </section>
    );
  }

  // ── Settled state: slim single row. ──
  if (!hasSurplus) {
    return (
      <section className="relative z-10 flex items-center gap-3 rounded-xl bg-surface px-4 py-3 shadow-soft">
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
                <p className="shrink-0 truncate font-mono-th text-xs font-semibold text-ink-muted">
                  {a.cardMatched}
                </p>
              </>
            ) : (
              <p className="truncate font-mono-th text-xs text-ink-dim">{a.cardNeverChecked}</p>
            )}
          </div>
        </div>
        {checkButton}
      </section>
    );
  }

  // ── Surplus state: checked balance demoted, surplus bar is the hero. ──
  const barStyle: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging && !reduceMotion ? 1.02 : 1})`
      : undefined,
    zIndex: isDragging ? 50 : undefined,
    transition: isDragging ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
    touchAction: 'manipulation',
    cursor: canAllocate ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
  };

  return (
    <section className="relative z-10 flex flex-col gap-2 rounded-xl bg-surface p-3 shadow-soft">
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
          'flex w-full items-center gap-2.5 rounded-lg bg-gradient-to-r from-orange-50 to-brand-50 px-3 py-2.5 text-left ring-1 ring-brand-200 '
          + (isDragging ? 'shadow-neuRaised' : 'shadow-soft')
        }
        {...(canAllocate ? attributes : {})}
        {...(canAllocate ? listeners : {})}
      >
        <span className="shrink-0 text-brand-700"><GripDots /></span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/70 text-brand-700">
          <IconPiggyBank size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono-th text-[11px] font-semibold text-brand-700">
            {a.surplusLabel}
          </span>
          <span className="block truncate font-mono text-base font-bold leading-tight text-brand-900">
            {formatCurrency(unallocatedPool)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 font-mono-th text-[11px] font-semibold text-brand-700">
          {a.dragHint}
          <IconArrowRight size={14} strokeWidth={2.6} />
        </span>
      </button>
    </section>
  );
});
