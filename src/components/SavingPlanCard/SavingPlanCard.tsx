import { memo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Pressable from '../Pressable/Pressable';
import { IconBubble } from '../IconBubble/IconBubble';
import {
  IconCalendar,
  IconChevronDown,
  IconEdit,
  IconPiggyBank,
  IconTrendingUp,
  IconVault,
} from '../Icon/Icon';
import { TextInput } from '../TextInput/TextInput';
import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';
import { formatCurrency } from '../../lib/format';
import { formatSignedCurrency, RECONCILE_REASONS } from '../../lib/reconcile';
import {
  severityFromBehindAmount,
  type HabitStatus,
  type MoneyStatus,
  type MoneyBehindSeverity,
} from '../../lib/savingPlan';
import { useI18n } from '../../i18n/useI18n';
import { useAnimatedNumbers } from '../../hooks/useAnimatedNumber';
import { SPRING } from '../../lib/motion';
import type { BalanceAdjustmentReason, SavingPlanRuleType } from '../../types';

interface VerifiedBalanceSlot {
  amount: number;
  /** Compact duration string (e.g. "today", "2d ago") or null when never checked. */
  sinceLabel: string | null;
  matched: boolean;
  diff: number;
  onSubmit: (actualAmount: number, reason?: BalanceAdjustmentReason) => Promise<{ error?: string; differenceAmount?: number }>;
}

interface SavingPlanCardProps {
  ruleType: SavingPlanRuleType | null;
  money: MoneyStatus | null;
  habit: HabitStatus;
  /**
   * Optional. When omitted, the card hides every Configure / Set up
   * plan / edit FAB CTA so the surface renders as read-only. Used by
   * the Member Detail page to show another member's plan without
   * exposing an edit path.
   */
  onConfigure?: () => void;
  verifiedBalance?: VerifiedBalanceSlot | null;
  isPaused?: boolean;
  pausedSince?: string | null;
  planSummary?: string | null;
  /** Most recent auto-freeze date as `YYYY-MM-DD`, Bangkok-local. */
  lastFreezeDateKey?: string | null;
  /** Today's Bangkok-local date key, for the freeze hint window. */
  todayDateKey?: string | null;
  /** Bangkok-local plan start date for future-start revisions. */
  planStartDateKey?: string | null;
  /** Days remaining until the plan revision (or project) end date. Null when no end is set. */
  daysRemaining?: number | null;
  /** Recorded-vs-target progress, 0–100. Computed from money status by the caller. */
  progressPct?: number;
}

function fireForStreak(streak: number): string {
  if (streak >= 8) return '🔥🔥🔥';
  if (streak >= 6) return '🔥🔥';
  if (streak >= 2) return '🔥';
  return '';
}

// Bangkok-local `YYYY-MM-DD` arithmetic. Both inputs are interpreted as
// midnight UTC so DST in the runtime zone cannot drift the day count.
function daysBetweenIsoKeys(from: string, to: string): number {
  const ms = Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z');
  return Math.round(ms / 86_400_000);
}

const behindSeverityColor: Record<MoneyBehindSeverity, string> = {
  none: 'text-accent-leaf',
  slight: 'text-accent-gold',
  reasonable: 'text-brand-700',
  tremendous: 'text-danger',
};

export const SavingPlanCard = memo(function SavingPlanCard({
  ruleType,
  money,
  habit,
  onConfigure,
  verifiedBalance,
  isPaused = false,
  pausedSince = null,
  planSummary = null,
  lastFreezeDateKey = null,
  todayDateKey = null,
  planStartDateKey = null,
  daysRemaining = null,
  progressPct = 0,
}: SavingPlanCardProps) {
  const { copy, formatShortDateKey } = useI18n();
  const d = copy.dashboard;
  const r = copy.reconcile;
  const reduceMotion = useReducedMotion();
  const [vbExpanded, setVbExpanded] = useState(false);
  const [vbActualValue, setVbActualValue] = useState('');
  const [vbStep, setVbStep] = useState<'enter' | 'reason'>('enter');
  const [vbReason, setVbReason] = useState<BalanceAdjustmentReason | null>(null);
  const [vbSubmitting, setVbSubmitting] = useState(false);
  const [vbError, setVbError] = useState<string | null>(null);
  const [vbDone, setVbDone] = useState<{ matched: boolean } | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const [animProgressPct, animExpectedToday, animDelta, animVerified] = useAnimatedNumbers([
    progressPct,
    money?.expectedToday ?? 0,
    money?.delta ?? 0,
    verifiedBalance?.amount ?? 0,
  ]);

  function handleVbToggle() {
    if (vbExpanded) {
      setVbActualValue('');
      setVbStep('enter');
      setVbReason(null);
      setVbError(null);
      setVbDone(null);
      clientIdRef.current = null;
    } else {
      clientIdRef.current = crypto.randomUUID();
    }
    setVbExpanded(prev => !prev);
  }

  async function handleVbSubmit() {
    if (!verifiedBalance || vbSubmitting) return;
    const actual = Number(vbActualValue);
    if (!Number.isFinite(actual) || actual < 0 || vbActualValue.trim() === '') {
      setVbError(r.inlineEnterActualError);
      return;
    }
    const diff = Math.round((actual - verifiedBalance.amount) * 100) / 100;
    if (diff !== 0 && vbStep === 'enter') {
      setVbStep('reason');
      return;
    }
    if (diff !== 0 && !vbReason) {
      setVbError(r.inlinePickReasonError);
      return;
    }
    setVbSubmitting(true);
    setVbError(null);
    const result = await verifiedBalance.onSubmit(actual, vbReason ?? undefined);
    setVbSubmitting(false);
    if (result.error) {
      setVbError(result.error);
      return;
    }
    const matched = (result.differenceAmount ?? diff) === 0;
    setVbDone({ matched });
    setTimeout(() => {
      setVbExpanded(false);
      setVbActualValue('');
      setVbStep('enter');
      setVbReason(null);
      setVbDone(null);
    }, 1800);
  }

  if (!money || !ruleType) {
    return (
      <Pressable onClick={onConfigure}>
        <section className="rounded-xl border border-white/60 bg-surface p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <IconBubble tone="peach" size="md">
              <IconTrendingUp size={20} />
            </IconBubble>
            <div className="min-w-0 flex-1">
              <h2 className="font-mono text-lg font-bold leading-tight text-ink">
                {d.savingPlanLabel}
              </h2>
              <p className="mt-1 truncate font-mono text-base font-bold text-ink">{d.noPlanYet}</p>
            </div>
            {onConfigure && (
              <Button
                variant="action"
                size="sm"
                onClick={e => { e.stopPropagation(); onConfigure(); }}
                className="shrink-0"
              >
                {d.setUpPlan}
              </Button>
            )}
          </div>
        </section>
      </Pressable>
    );
  }

  const behindSeverity = money.state === 'behind'
    ? severityFromBehindAmount(-money.delta, money.targetAmount)
    : 'none';

  const moneyHeadlineColor = isPaused
    ? 'text-ink-muted'
    : money.state === 'not_started'
      ? 'text-ink'
      : money.state === 'behind'
        ? behindSeverityColor[behindSeverity]
        : 'text-accent-leaf';

  const moneyHeadline = isPaused
    ? d.planPaused
    : money.state === 'ahead'
      ? d.aheadBy(formatCurrency(Math.round(animDelta)))
      : money.state === 'behind'
        ? d.behindBy(formatCurrency(Math.round(-animDelta)))
        : money.state === 'on_track'
          ? d.onTrack
          : planStartDateKey && todayDateKey && planStartDateKey > todayDateKey
            ? d.planStartsOn(formatShortDateKey(planStartDateKey))
            : d.notStarted;

  const habitHeadline = habit.lastDepositDateKey === null
    ? d.noDepositsYet
    : habit.hasDepositedToday
      ? d.depositedToday
      : habit.daysSinceLastDeposit === 1
        ? d.depositedDaysAgo(1)
        : d.depositedDaysAgo(habit.daysSinceLastDeposit ?? 0);

  const streakFire = fireForStreak(habit.streak);

  // SPRINT1-003: derive the freeze hint state from the dates the
  // parent plumbed down. The "We covered ..." hint only shows for a
  // few days after a freeze and disappears as soon as the user saves
  // today (so the streak number on its own then tells the story).
  const sf = copy.streakFreeze;
  const freezeHintLine = (() => {
    if (isPaused) return null;
    if (!lastFreezeDateKey || !todayDateKey) return null;
    if (habit.hasDepositedToday) return null;
    const days = daysBetweenIsoKeys(lastFreezeDateKey, todayDateKey);
    if (days <= 0 || days > 6) return null;
    const dateLabel = days === 1 ? sf.coveredYesterday : formatShortDateKey(lastFreezeDateKey);
    return sf.coveredHint(dateLabel);
  })();

  const vbActualNumber = Number(vbActualValue);
  const vbDiff = vbActualValue.trim() !== '' && Number.isFinite(vbActualNumber)
    ? Math.round((vbActualNumber - (verifiedBalance?.amount ?? 0)) * 100) / 100
    : null;

  const progressPctRounded = Math.max(0, Math.min(100, Math.round(animProgressPct)));

  return (
    <section className="rounded-xl border border-white/60 bg-surface p-5 shadow-soft">
      {/* Header — eyebrow + status title + halo edit FAB */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-base font-bold leading-tight text-ink">
            {d.savingPlanLabel}
          </h2>
          <p className={`mt-1 font-mono text-sm font-bold ${moneyHeadlineColor}`}>
            {moneyHeadline}
          </p>
        </div>
        {onConfigure && (
          <IconButton
            variant="solid"
            size="lg"
            ariaLabel={d.changePlan}
            onClick={onConfigure}
            className="shrink-0"
          >
            <IconEdit size={18} />
          </IconButton>
        )}
      </div>
      {isPaused ? (
        pausedSince && (
          <p className="mt-1 font-mono text-sm font-bold text-ink-muted">
            {d.planSince} <span className="text-ink">{formatShortDateKey(pausedSince)}</span>
            {planSummary && (
              <span className="ml-2 font-normal text-ink-muted">· {planSummary}</span>
            )}
          </p>
        )
      ) : (
        money.state === 'ahead' && money.coveredUntilDate && (
          <p className="mt-1 font-mono text-sm font-bold text-ink-muted">
            {d.coveredUntil} <span className="text-ink">{formatShortDateKey(money.coveredUntilDate)}</span>
          </p>
        )
      )}

      {/* 3-col meta row — today's plan / days left / progress */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500">
            <IconPiggyBank size={14} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] leading-tight text-ink-muted">{d.todaysPlan}</p>
            <p className="font-mono text-sm font-bold text-ink truncate">
              {formatCurrency(Math.round(animExpectedToday))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500">
            <IconCalendar size={14} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] leading-tight text-ink-muted">{d.daysLeftLabel}</p>
            <p className="font-mono text-sm font-bold text-ink truncate">
              {daysRemaining === null || daysRemaining < 0
                ? d.noEndDate
                : d.daysLeftValue(daysRemaining)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500">
            <IconTrendingUp size={14} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] leading-tight text-ink-muted">{d.progressLabel}</p>
            <p className="font-mono text-sm font-bold text-ink truncate">
              {progressPctRounded}%
            </p>
          </div>
        </div>
      </div>

      {/* Compact habit/streak/freeze secondary line */}
      {!isPaused && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-muted">
          <span>
            {d.lastDeposit}: <span className="font-bold text-ink">{habitHeadline}</span>
          </span>
          {habit.streak > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>
                {d.streakLabel}:{' '}
                <span className="font-bold text-ink">
                  {d.streakDays(habit.streak)}
                  {streakFire && (
                    <span aria-hidden className="ml-1 align-middle">{streakFire}</span>
                  )}
                </span>
              </span>
            </>
          )}
        </div>
      )}
      {freezeHintLine && (
        <p className="mt-0.5 font-mono text-xs text-ink-muted">{freezeHintLine}</p>
      )}

      {/* Verified Balance — expandable inline form */}
      {verifiedBalance && (
        <div className="mt-4 border-t border-well pt-4" onClick={e => e.stopPropagation()}>
          <motion.button
            type="button"
            onClick={handleVbToggle}
            className="flex w-full items-center gap-3 text-left"
            whileTap={reduceMotion ? { opacity: 0.85 } : { scale: 0.97, y: 2 }}
            transition={SPRING.press}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-800">
              <IconVault size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-ink-muted">
                {d.verifiedBalanceRowLabel}
              </p>
              <p className="mt-0.5 truncate font-mono text-sm font-bold text-ink">
                {formatCurrency(Math.round(animVerified))}
                <span className="ml-2 font-normal text-ink-muted">
                  · {verifiedBalance.sinceLabel === null
                    ? d.notChecked
                    : verifiedBalance.matched
                      ? d.matchedSince(verifiedBalance.sinceLabel)
                      : `${formatSignedCurrency(verifiedBalance.diff)} ${verifiedBalance.sinceLabel}`}
                </span>
              </p>
            </div>
            <IconChevronDown
              size={18}
              className={`shrink-0 text-ink-muted transition-transform duration-300 ${vbExpanded ? 'rotate-180' : ''}`}
            />
          </motion.button>

          {/* Slide-down panel — inline VB form strings deferred to 24.4 */}
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: vbExpanded ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-3 pt-4">
                {vbDone ? (
                  <p className={`font-mono text-sm font-bold ${vbDone.matched ? 'text-accent-leaf' : 'text-brand-800'}`}>
                    {vbDone.matched ? r.inlineBalanceMatched : r.inlineAdjustmentSaved}
                  </p>
                ) : vbStep === 'enter' ? (
                  <>
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-2">
                      <span className="font-mono text-xs text-ink-muted">{r.inlineAppBalanceLabel}</span>
                      <span className="font-mono text-sm font-bold text-ink">{formatCurrency(verifiedBalance.amount)}</span>
                    </div>
                    <TextInput
                      inputMode="numeric"
                      placeholder="0"
                      value={vbActualValue}
                      leadingIcon={<span className="font-mono font-bold text-brand-500">฿</span>}
                      onChange={e => {
                        setVbActualValue(e.target.value.replace(/[^0-9]/g, ''));
                        setVbError(null);
                      }}
                    />
                    {vbDiff !== null && vbDiff !== 0 && (
                      <p className="font-mono text-xs text-ink-muted">
                        {r.inlineDifferencePrefix} <span className={`font-bold ${vbDiff > 0 ? 'text-accent-leaf' : 'text-danger'}`}>{formatSignedCurrency(vbDiff)}</span>
                      </p>
                    )}
                    {vbError && <p className="font-mono text-xs text-danger">{vbError}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="ghost" size="md" onClick={handleVbToggle}>{r.cancelButton}</Button>
                      <Button
                        variant="action"
                        size="md"
                        disabled={vbSubmitting || vbActualValue.trim() === ''}
                        onClick={handleVbSubmit}
                      >
                        {vbSubmitting ? r.savingButton : r.inlineSaveCheck}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-brand-50 px-3 py-2 text-center">
                      <div>
                        <p className="font-mono text-[10px] text-ink-muted uppercase tracking-wider">{r.inlineStatActual}</p>
                        <p className="font-mono text-sm font-bold text-ink">{formatCurrency(Number(vbActualValue))}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-ink-muted uppercase tracking-wider">{r.inlineStatApp}</p>
                        <p className="font-mono text-sm font-bold text-ink">{formatCurrency(verifiedBalance.amount)}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-ink-muted uppercase tracking-wider">{r.inlineStatDiff}</p>
                        <p className={`font-mono text-sm font-bold ${(vbDiff ?? 0) > 0 ? 'text-accent-leaf' : 'text-danger'}`}>
                          {formatSignedCurrency(vbDiff ?? 0)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {RECONCILE_REASONS.map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => { setVbReason(opt.id); setVbError(null); }}
                          className={`w-full rounded-lg px-3 py-2 text-left font-mono text-xs font-bold transition-colors ${vbReason === opt.id ? 'bg-brand-800 text-ink-inverse' : 'bg-brand-50 text-ink hover:bg-brand-100'}`}
                        >
                          {r.reasons[opt.id].label}
                        </button>
                      ))}
                    </div>
                    {vbError && <p className="font-mono text-xs text-danger">{vbError}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="ghost" size="md" onClick={() => { setVbStep('enter'); setVbReason(null); setVbError(null); }}>{r.backButton}</Button>
                      <Button
                        variant="action"
                        size="md"
                        disabled={vbSubmitting || !vbReason}
                        onClick={handleVbSubmit}
                      >
                        {vbSubmitting ? r.savingButton : r.inlineSaveButton}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
});
