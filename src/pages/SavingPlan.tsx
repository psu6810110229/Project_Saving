import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { CalendarPicker } from '../components/CalendarPicker/CalendarPicker';
import { Chip } from '../components/Chip/Chip';
import { ConfirmModal } from '../components/ConfirmModal/ConfirmModal';
import { IconArrowLeft } from '../components/Icon/Icon';
import { IconButton } from '../components/IconButton/IconButton';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { TextInput } from '../components/TextInput/TextInput';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useSharedData } from '../hooks/useSharedData';
import { useI18n } from '../i18n/useI18n';
import { formatCurrency } from '../lib/format';
import { haptic } from '../lib/haptics';
import {
  activeRevisionAt,
  addDays,
  daysBetween,
  daysInclusive,
  plannedCumulativeThroughDate,
  projectedCompletionDate,
  nextUpcomingRevision,
  todayBangkokKey,
} from '../lib/savingPlan';
import type { CreatePlanInput } from '../hooks/useSavingPlan';
import type { SavingPlanRevision, SavingPlanRuleType } from '../types';

type StopMode = 'target' | 'days' | 'date';

export function SavingPlan() {
  const navigate = useNavigate();
  const data = useSharedData();
  const { goal, roomGoalEndDate } = data.goal;
  const { plan, loading, error, isPaused, createPlan, changePlan, pausePlan, resumePlan } = data.savingPlan;
  const { copy, formatShortDateKey } = useI18n();
  const sp = copy.savingPlan;

  const PRESETS: { id: SavingPlanRuleType; label: string }[] = [
    { id: 'fixed_daily',      label: sp.presetDaily },
    { id: 'fixed_weekly',     label: sp.presetWeekly },
    { id: 'fixed_monthly',    label: sp.presetMonthly },
    { id: 'increasing_daily', label: sp.presetIncreasing },
  ];

  const STOP_OPTIONS: { id: StopMode; label: string }[] = [
    { id: 'target', label: sp.stopOptionTarget },
    { id: 'days',   label: sp.stopOptionDays },
    { id: 'date',   label: sp.stopOptionDate },
  ];

  // HOTFIX-004 + HOTFIX-006: prefer the earliest upcoming revision
  // (the user's scheduled plan change) so that after saving a
  // future-start plan change the form shows the new parameters, not
  // today's active revision.  The active revision remains untouched
  // in savingPlan.ts for today's accrual calculations.
  const latestRevision = plan
    ? (nextUpcomingRevision(plan.revisions, todayBangkokKey())
       ?? activeRevisionAt(plan.revisions, todayBangkokKey()))
    : null;
  const isChange = Boolean(plan);
  const openPause = plan?.pauses.find(p => p.resumed_from === null) ?? null;
  const pausedSince = openPause?.paused_from ?? null;

  const [ruleType, setRuleType] = useState<SavingPlanRuleType>('fixed_daily');
  const [amount, setAmount] = useState('');
  const [startAmount, setStartAmount] = useState('1');
  const [incrementAmount, setIncrementAmount] = useState('1');
  const [capAmount, setCapAmount] = useState('');
  const [dayCount, setDayCount] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [endDate, setEndDate] = useState('');
  const [planStartDate, setPlanStartDate] = useState(todayBangkokKey());
  const [stopMode, setStopMode] = useState<StopMode>('target');
  const [message, setMessage] = useState<string | null>(null);
  const [pauseMessage, setPauseMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seededRevisionId, setSeededRevisionId] = useState<string | null>(null);
  const [didSeedCreateTarget, setDidSeedCreateTarget] = useState(false);
  const [confirmingPause, setConfirmingPause] = useState(false);
  const [confirmingResume, setConfirmingResume] = useState(false);
  const [pendingChangeInput, setPendingChangeInput] = useState<CreatePlanInput | null>(null);

  // Handle plan type switch with proper field resets so cross-type
  // state (amount vs start/increment/cap, stopMode, etc.) doesn't
  // leave the form in an invalid state that silently blocks saving.
  function handleRuleTypeChange(newType: SavingPlanRuleType) {
    if (newType === ruleType) return;
    const wasIncreasing = ruleType === 'increasing_daily';
    const isIncreasing = newType === 'increasing_daily';

    setRuleType(newType);
    setMessage(null); // clear stale validation errors

    if (wasIncreasing && !isIncreasing) {
      // Switching FROM increasing → fixed: fixed types don't use
      // stopMode/dayCount, and the range-picker planStartDate might
      // be stale. Reset these so validation and the RPC see clean
      // values. Leave amount as-is (user may have already typed one).
      setStopMode('target');
      setDayCount('');
      setPlanStartDate(todayBangkokKey());
    } else if (!wasIncreasing && isIncreasing) {
      // Switching FROM fixed → increasing: clear amount since
      // increasing uses startAmount/incrementAmount/capAmount instead.
      setAmount('');
    }
  }

  // Seed defaults from the active revision when changing an existing
  // plan, otherwise pull the target from the synchronized room goal.
  useEffect(() => {
    if (loading) return;
    if (latestRevision) {
      if (seededRevisionId === latestRevision.id) return;
      const isCapped = latestRevision.rule_type === 'increasing_daily_capped';
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRuleType(isCapped ? 'increasing_daily' : latestRevision.rule_type);
      setAmount(latestRevision.amount != null ? String(latestRevision.amount) : '');
      setStartAmount(latestRevision.start_amount != null ? String(latestRevision.start_amount) : '1');
      setIncrementAmount(latestRevision.increment_amount != null ? String(latestRevision.increment_amount) : '1');
      setCapAmount(latestRevision.cap_amount != null ? String(latestRevision.cap_amount) : '');
      setDayCount(latestRevision.day_count != null ? String(latestRevision.day_count) : '');
      setTargetAmount(String(latestRevision.target_amount));
      setEndDate(latestRevision.end_date ?? '');
      // HOTFIX-004: seed the start date from the revision's own
      // effective_from_date. For future-start plans this preserves the
      // user's selected start date; for today-start plans the value is
      // today anyway. Changes still apply from today unless the
      // revision is genuinely future-dated.
      setPlanStartDate(latestRevision.effective_from_date);
      if (latestRevision.day_count != null) {
        setStopMode('days');
      } else if (latestRevision.end_date) {
        setStopMode('date');
      } else {
        setStopMode('target');
      }
      setSeededRevisionId(latestRevision.id);
      setDidSeedCreateTarget(true);
      return;
    }
    if (!didSeedCreateTarget && goal?.target_amount) {
      setTargetAmount(String(goal.target_amount));
      // Task 37: the canonical project end date now lives on
      // rooms.end_date (exposed as roomGoalEndDate). Fall back to the
      // personal goal row only when the room end date is missing.
      setEndDate(roomGoalEndDate ?? goal.end_date ?? '');
      setDidSeedCreateTarget(true);
    }
  }, [loading, latestRevision, goal?.target_amount, goal?.end_date, roomGoalEndDate, didSeedCreateTarget, seededRevisionId]);

  const effectiveFromDate = todayBangkokKey();

  // Synthetic revision powering the live preview card. Recalculated
  // from the live form inputs so estimates update as the user types.
  const previewRevisions = useMemo<SavingPlanRevision[] | null>(() => {
    const targetNum = Number(targetAmount);
    if (!Number.isFinite(targetNum) || targetNum <= 0) return null;

    if (ruleType === 'increasing_daily') {
      const startNum = Number(startAmount);
      const incNum = Number(incrementAmount);
      const capNum = Number(capAmount);
      if (!Number.isFinite(startNum) || startNum <= 0) return null;
      if (!Number.isFinite(incNum) || incNum < 0) return null;
      if (!Number.isFinite(capNum) || capNum <= 0 || capNum < startNum) return null;
      const dayCountNum = dayCount.trim() !== '' && /^[0-9]+$/.test(dayCount) ? Number(dayCount) : null;
      return [{
        id: 'preview',
        plan_id: 'preview',
        room_id: 'preview',
        user_id: 'preview',
        effective_from_date: planStartDate || effectiveFromDate,
        rule_type: 'increasing_daily_capped',
        amount: null,
        start_amount: startNum,
        increment_amount: incNum,
        cap_amount: capNum,
        target_amount: targetNum,
        end_date: stopMode === 'date' && endDate >= effectiveFromDate ? endDate : null,
        day_count: stopMode === 'days' && dayCountNum && dayCountNum > 0 ? dayCountNum : null,
        created_at: new Date().toISOString(),
      }];
    }

    // Fixed plan types — allow amount = 0 so the preview card still
    // renders with a "needs input" hint when the user hasn't entered
    // an amount yet. Without this the card would disappear entirely.
    const amountRaw = Number(amount);
    const amountNum = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : 0;
    return [{
      id: 'preview',
      plan_id: 'preview',
      room_id: 'preview',
      user_id: 'preview',
      effective_from_date: planStartDate || effectiveFromDate,
      rule_type: ruleType,
      amount: amountNum,
      start_amount: null,
      increment_amount: null,
      cap_amount: null,
      target_amount: targetNum,
      end_date: endDate && endDate >= (planStartDate || effectiveFromDate) ? endDate : null,
      day_count: null,
      created_at: new Date().toISOString(),
    }];
  }, [ruleType, amount, startAmount, incrementAmount, capAmount, targetAmount, stopMode, endDate, dayCount, effectiveFromDate, planStartDate]);

  const preview = useMemo(() => {
    if (!previewRevisions) return null;
    const rev = previewRevisions[0];
    const targetNum = Number(rev.target_amount);
    // Use the revision's own start date so projections honour a future
    // start date picked by the user (HOTFIX-003).
    const revStart = rev.effective_from_date;
    const beforeStart = addDays(revStart, -1);

    // Increasing daily (capped)
    if (rev.rule_type === 'increasing_daily_capped') {
      const capNum = Number(rev.cap_amount ?? 0);
      if (stopMode === 'target') {
        const finish = projectedCompletionDate(previewRevisions, 0, beforeStart, 3650);
        if (!finish) {
          return { mode: 'target' as const, unreachable: true as const, capAmount: capNum };
        }
        const days = daysInclusive(revStart, finish);
        const total = plannedCumulativeThroughDate(previewRevisions, finish, Math.max(4000, days + 10));
        return {
          mode: 'target' as const,
          unreachable: false as const,
          days,
          finishDateKey: finish,
          capAmount: capNum,
          total,
        };
      }
      if (stopMode === 'days') {
        if (!rev.day_count) return null;
        const endKey = addDays(revStart, rev.day_count - 1);
        const total = plannedCumulativeThroughDate(previewRevisions, endKey, Math.max(4000, rev.day_count + 10));
        return {
          mode: 'days' as const,
          finishDateKey: endKey,
          days: rev.day_count,
          total,
          target: targetNum,
          capAmount: capNum,
          reachesTarget: total + 0.005 >= targetNum,
        };
      }
      if (!rev.end_date) return null;
      const total = plannedCumulativeThroughDate(previewRevisions, rev.end_date, 4000);
      const days = daysInclusive(revStart, rev.end_date);
      return {
        mode: 'date' as const,
        finishDateKey: rev.end_date,
        days,
        total,
        target: targetNum,
        capAmount: capNum,
        reachesTarget: total + 0.005 >= targetNum,
      };
    }

    // Fixed plan types
    const amountNum = Number(rev.amount ?? 0);
    const fixedRuleType = rev.rule_type as 'fixed_daily' | 'fixed_weekly' | 'fixed_monthly';
    // Show a "needs input" preview when the user hasn't entered an
    // amount yet, so the card stays visible across all plan modes.
    if (amountNum <= 0) {
      return {
        mode: 'fixed' as const,
        unreachable: false as const,
        needsAmount: true as const,
        ruleType: fixedRuleType,
        amount: 0,
        target: targetNum,
      };
    }
    if (rev.end_date) {
      const days = daysInclusive(revStart, rev.end_date);
      const total = plannedCumulativeThroughDate(previewRevisions, rev.end_date, Math.max(4000, days + 10));
      return {
        mode: 'fixed' as const,
        unreachable: false as const,
        needsAmount: false as const,
        ruleType: fixedRuleType,
        finishDateKey: rev.end_date,
        days,
        amount: amountNum,
        total,
        target: targetNum,
        reachesTarget: total + 0.005 >= targetNum,
      };
    }
    // Use the same 10 000-day horizon as TARGET_REACH_HORIZON so the
    // projection and the endKey calculation stay in sync.
    const finish = projectedCompletionDate(previewRevisions, 0, beforeStart, 10000);
    if (!finish) {
      return {
        mode: 'fixed' as const,
        unreachable: true as const,
        needsAmount: false as const,
        ruleType: fixedRuleType,
        amount: amountNum,
        target: targetNum,
      };
    }
    const days = daysInclusive(revStart, finish);
    const total = plannedCumulativeThroughDate(previewRevisions, finish, Math.max(4000, days + 10));
    return {
      mode: 'fixed' as const,
      unreachable: false as const,
      needsAmount: false as const,
      ruleType: fixedRuleType,
      finishDateKey: finish,
      days,
      amount: amountNum,
      total,
      target: targetNum,
      reachesTarget: true,
    };
  }, [previewRevisions, stopMode]);

  // Per-date amount function passed to CalendarPicker cells.
  const getAmountForDate = useMemo<((dateKey: string) => number | undefined) | undefined>(() => {
    if (ruleType === 'increasing_daily') {
      const startNum = Number(startAmount);
      const incNum = Number(incrementAmount);
      const capNum = Number(capAmount);
      if (!startNum || startNum <= 0 || incNum < 0 || capNum <= 0) return undefined;
      const ref = planStartDate || todayBangkokKey();
      return (dateKey: string) => {
        if (dateKey < ref) return undefined;
        const idx = daysInclusive(ref, dateKey); // 1-based
        const raw = startNum + (idx - 1) * incNum;
        return Math.min(raw, capNum);
      };
    }
    if (ruleType === 'fixed_daily') {
      const amountNum = Number(amount);
      if (!amountNum || amountNum <= 0) return undefined;
      const ref = todayBangkokKey();
      return (dateKey: string) => (dateKey >= ref ? amountNum : undefined);
    }
    if (ruleType === 'fixed_weekly') {
      const amountNum = Number(amount);
      if (!amountNum || amountNum <= 0) return undefined;
      const ref = todayBangkokKey();
      return (dateKey: string) => {
        const diff = daysBetween(ref, dateKey);
        if (diff < 0) return undefined;
        return diff % 7 === 0 ? amountNum : undefined;
      };
    }
    if (ruleType === 'fixed_monthly') {
      const amountNum = Number(amount);
      if (!amountNum || amountNum <= 0) return undefined;
      const refDay = Number(todayBangkokKey().split('-')[2]);
      return (dateKey: string) => {
        const d = Number(dateKey.split('-')[2]);
        return d === refDay && dateKey >= todayBangkokKey() ? amountNum : undefined;
      };
    }
    return undefined;
  }, [ruleType, startAmount, incrementAmount, capAmount, amount, planStartDate]);

  const { shouldShowLoader: shouldShowSkeleton } = useLoadingGate({
    loading,
    showAfterMs: 120,
    minimumVisibleMs: 400,
  });

  if (loading && !shouldShowSkeleton) return null;

  if (loading) {
    return (
      <div className="flex flex-col gap-5 pt-8" aria-label={sp.loadingAriaLabel}>
        {/* Back-button placeholder */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        {/* Header area */}
        <div className="mt-10 flex items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24 rounded-pill" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Spinner size="sm" tone="neutral" />
        </div>
        {/* Plan type selector card */}
        <section className="rounded-xl bg-surface p-5 shadow-soft">
          <Skeleton className="h-4 w-28 rounded-pill" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
          </div>
        </section>
        {/* Plan fields card */}
        <section className="rounded-xl bg-surface p-5 shadow-soft">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        </section>
      </div>
    );
  }

  function digitsOnly(value: string): string {
    return value.replace(/[^0-9]/g, '');
  }

  async function runPause() {
    setConfirmingPause(false);
    setPauseMessage(null);
    setSubmitting(true);
    const result = await pausePlan();
    setSubmitting(false);
    if (result.error) {
      setPauseMessage(result.error);
    } else {
      haptic('success');
    }
  }

  async function runResume() {
    setConfirmingResume(false);
    setPauseMessage(null);
    setSubmitting(true);
    const result = await resumePlan();
    setSubmitting(false);
    if (result.error) {
      setPauseMessage(result.error);
    } else {
      haptic('success');
    }
  }

  async function handleSubmit() {
    setMessage(null);

    const targetNum = Number(targetAmount);
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      setMessage(sp.validationTarget);
      return;
    }

    let amountNum: number | undefined;
    let startNum: number | undefined;
    let incNum: number | undefined;
    let capNum: number | undefined;
    let dayCountNum: number | undefined;
    let endDateOut: string | undefined;
    let submitRuleType: SavingPlanRuleType = ruleType;

    if (ruleType === 'increasing_daily') {
      startNum = Number(startAmount);
      incNum = Number(incrementAmount);
      if (!Number.isFinite(startNum) || startNum <= 0) {
        setMessage(sp.validationStartAmount);
        return;
      }
      if (!Number.isFinite(incNum) || incNum < 0) {
        setMessage(sp.validationIncrement);
        return;
      }
      if (capAmount.trim() === '') {
        setMessage(sp.validationMaxRequired);
        return;
      }
      capNum = Number(capAmount);
      if (!Number.isFinite(capNum) || capNum <= 0) {
        setMessage(sp.validationMaxAboveZero);
        return;
      }
      if (capNum < startNum) {
        setMessage(sp.validationMaxAboveStart);
        return;
      }

      if (stopMode === 'target') {
        dayCountNum = undefined;
        endDateOut = undefined;
      } else if (stopMode === 'days') {
        if (dayCount.trim() === '') {
          setMessage(sp.validationDays);
          return;
        }
        dayCountNum = Number(dayCount);
        if (!Number.isInteger(dayCountNum) || dayCountNum <= 0) {
          setMessage(sp.validationDaysAboveZero);
          return;
        }
        endDateOut = undefined;
      } else {
        if (!endDate) {
          setMessage(sp.validationStopDate);
          return;
        }
        const startRef = planStartDate || effectiveFromDate;
        if (endDate < startRef) {
          setMessage(sp.validationFutureEnd);
          return;
        }
        endDateOut = endDate;
        dayCountNum = undefined;
      }

      submitRuleType = 'increasing_daily_capped';
    } else {
      amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        setMessage(sp.validationAmount);
        return;
      }
      if (endDate && endDate < effectiveFromDate) {
        setMessage(sp.validationFutureEnd);
        return;
      }
      endDateOut = endDate || undefined;
      dayCountNum = undefined;
    }

    // HOTFIX-005: both creates AND changes must forward the user's
    // selected planStartDate when it is in the future. Previously,
    // the change path always sent `undefined`, causing the RPC to
    // fall back to `v_today`. This made a future-start plan (e.g.
    // June 1 to June 30 = 30 days) revert to today-start after any
    // change (e.g. May 17 to June 30 = 45 days).
    //
    // For plans that have already started (planStartDate <= today),
    // changes still apply from today (effectiveFromDate / undefined)
    // so that mid-plan adjustments don't backdate the new revision.
    const isFutureStart = planStartDate > effectiveFromDate;
    const effectiveFromDateForRpc = isFutureStart
      ? planStartDate
      : isChange
        ? undefined
        : effectiveFromDate;

    const input: CreatePlanInput = {
      ruleType: submitRuleType,
      targetAmount: targetNum,
      amount: amountNum,
      startAmount: startNum,
      incrementAmount: incNum,
      capAmount: capNum,
      dayCount: dayCountNum,
      effectiveFromDate: effectiveFromDateForRpc,
      endDate: endDateOut,
    };

    if (isChange) {
      setPendingChangeInput(input);
      return;
    }

    setSubmitting(true);
    const result = await createPlan(input);
    setSubmitting(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }
    haptic('success');
    navigate('/dashboard');
  }

  async function runChange() {
    if (!pendingChangeInput) return;
    const input = pendingChangeInput;
    setPendingChangeInput(null);
    setSubmitting(true);
    const result = await changePlan(input);
    setSubmitting(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }
    haptic('success');
    navigate('/dashboard');
  }


  return (
    <div className="flex flex-col gap-5 pt-8">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <IconButton ariaLabel={sp.goBackAriaLabel} size="md" onClick={() => navigate(-1)}>
          <IconArrowLeft size={20} />
        </IconButton>
      </div>

      {/* Lowered content. */}
      <div className="mt-10 flex flex-col gap-5">
        <header className="min-w-0">
          <p className="font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800">
            {sp.pageEyebrow}
          </p>
          <h1 className="mt-2 truncate font-mono text-3xl font-bold text-ink">
            {isChange ? sp.changeTitle : sp.setUpTitle}
          </h1>
          {isChange && (
            <button
              type="button"
              disabled={submitting}
              onClick={isPaused ? () => setConfirmingResume(true) : () => setConfirmingPause(true)}
              className={
                'mt-4 inline-flex items-center gap-2 rounded-pill px-5 py-2.5 font-mono text-sm font-bold transition-all active:scale-95 ' +
                (isPaused
                  ? 'bg-brand-500 text-ink-inverse shadow-haloOrange'
                  : 'bg-well text-ink hover:bg-brand-100 hover:text-brand-800')
              }
            >
              <span className="text-base leading-none">{isPaused ? '▶' : '⏸'}</span>
              {submitting ? '...' : isPaused ? sp.resumeButton : sp.pausePlanButton}
            </button>
          )}
        </header>

      {/* Paused state: hide all form fields, show resume prompt */}
      {isChange && isPaused && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl bg-surface p-8 shadow-soft text-center">
          <p className="font-mono text-base font-bold text-ink">{sp.planPausedLabel}</p>
          {pausedSince && (
            <p className="font-mono text-sm text-ink-muted">{sp.pausedSinceLabel(formatShortDateKey(pausedSince))}</p>
          )}
          <p className="font-mono text-sm text-ink-muted">Resume your plan before making changes.</p>
          {pauseMessage && <p className="font-mono text-xs text-danger">{pauseMessage}</p>}
        </div>
      )}

      {/* Form sections — only shown when plan is active */}
      <div className={isChange && isPaused ? 'hidden' : 'flex flex-col gap-5'}>

      {/* Plan type selector */}
      <section className="rounded-xl bg-surface p-5 shadow-soft">
        <p className="font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800">
          {sp.planTypeLabel}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {PRESETS.map(preset => {
            const selected = ruleType === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleRuleTypeChange(preset.id)}
                className={
                  'rounded-lg px-4 py-3 text-center font-mono text-sm font-bold transition-colors ' +
                  (selected
                    ? 'bg-brand-500 text-ink-inverse shadow-haloOrange'
                    : 'bg-brand-50 text-ink hover:bg-brand-100')
                }
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Plan fields */}
      <section className="rounded-xl bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-4">
          {ruleType === 'increasing_daily' ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CardField label={sp.startAmountLabel}>
                  <TextInput
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="1"
                    value={startAmount}
                    leadingIcon={<span className="font-mono font-bold">฿</span>}
                    onChange={e => setStartAmount(digitsOnly(e.target.value))}
                  />
                </CardField>
                <CardField label={sp.increaseByLabel}>
                  <TextInput
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="1"
                    value={incrementAmount}
                    leadingIcon={<span className="font-mono font-bold">฿</span>}
                    onChange={e => setIncrementAmount(digitsOnly(e.target.value))}
                  />
                </CardField>
              </div>

              <CardField label={sp.maxDailyLabel}>
                <TextInput
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="180"
                  value={capAmount}
                  leadingIcon={<span className="font-mono font-bold">฿</span>}
                  onChange={e => setCapAmount(digitsOnly(e.target.value))}
                />
              </CardField>

              <div>
                <p className="font-mono text-sm font-bold text-ink">{sp.stopWhenLabel}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STOP_OPTIONS.map(opt => {
                    const selected = stopMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setStopMode(opt.id)}
                        className={
                          'rounded-pill px-3 py-1.5 font-mono text-xs font-bold transition-colors ' +
                          (selected
                            ? 'bg-brand-500 text-ink-inverse shadow-haloOrange'
                            : 'bg-brand-50 text-brand-800 hover:bg-brand-100')
                        }
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {stopMode === 'days' && (
                  <div className="mt-3">
                    <CardField label={sp.runForLabel}>
                      <TextInput
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="500"
                        value={dayCount}
                        trailingIcon={<span className="font-mono text-xs text-ink-muted">{sp.daysSuffix}</span>}
                        onChange={e => setDayCount(digitsOnly(e.target.value))}
                      />
                    </CardField>
                  </div>
                )}

                {stopMode === 'date' && (
                  <div className="mt-3">
                    <CalendarPicker
                      mode="range"
                      rangeStart={planStartDate}
                      rangeEnd={endDate}
                      onRangeChange={(start, end) => { setPlanStartDate(start); setEndDate(end); }}
                      minDate={todayBangkokKey()}
                      getAmountForDate={getAmountForDate}
                    />
                  </div>
                )}
              </div>

              <CardField label={sp.planTargetLabel}>
                <TextInput
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="100000"
                  value={targetAmount}
                  leadingIcon={<span className="font-mono font-bold">฿</span>}
                  onChange={e => setTargetAmount(digitsOnly(e.target.value))}
                />
              </CardField>
            </>
          ) : (
            <>
              <BigLabelField label={sp.amountLabel}>
                <TextInput
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="100"
                  value={amount}
                  leadingIcon={<span className="font-mono font-bold">฿</span>}
                  onChange={e => setAmount(digitsOnly(e.target.value))}
                />
              </BigLabelField>

              <BigLabelField label={sp.planTargetLabel}>
                <TextInput
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="100000"
                  value={targetAmount}
                  leadingIcon={<span className="font-mono font-bold">฿</span>}
                  onChange={e => setTargetAmount(digitsOnly(e.target.value))}
                />
              </BigLabelField>

              <BigLabelField label={sp.endDateLabel}>
                <CalendarPicker
                  value={endDate}
                  onChange={setEndDate}
                  minDate={todayBangkokKey()}
                  getAmountForDate={getAmountForDate}
                />
              </BigLabelField>
            </>
          )}
        </div>
      </section>

      {/* Preview card */}
      {preview && (
        <section className="rounded-xl bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800">
              {sp.previewLabel}
            </p>
            {preview.mode !== 'target' && !preview.unreachable && !preview.needsAmount && !preview.reachesTarget && (
              <Chip tone="peach">{sp.belowTargetChip}</Chip>
            )}
          </div>

          {preview.mode === 'target' && preview.unreachable ? (
            <p className="mt-3 font-mono text-xs text-ink-muted">
              {sp.unreachableHint}
            </p>
          ) : preview.mode === 'fixed' && preview.needsAmount ? (
            <p className="mt-3 font-mono text-xs text-ink-muted">
              {sp.needsAmountHint}
            </p>
          ) : preview.mode === 'fixed' && preview.unreachable ? (
            <p className="mt-3 font-mono text-xs text-ink-muted">
              {sp.unreachableFixedHint}
            </p>
          ) : preview.mode === 'fixed' ? (
            <dl className="mt-3 divide-y divide-well font-mono text-xs">
              <PreviewRow label={sp.estimatedFinish} value={formatShortDateKey(preview.finishDateKey)} />
              <PreviewRow
                label={preview.ruleType === 'fixed_weekly' ? sp.savingWeeks : preview.ruleType === 'fixed_monthly' ? sp.savingMonths : sp.savingDays}
                value={preview.ruleType === 'fixed_weekly'
                  ? sp.savingWeeksValue(Math.ceil(preview.days / 7))
                  : preview.ruleType === 'fixed_monthly'
                    ? sp.savingMonthsValue(Math.ceil(preview.days / 30))
                    : sp.savingDaysValue(preview.days)
                }
              />
              <PreviewRow
                label={preview.ruleType === 'fixed_weekly' ? sp.perWeek : preview.ruleType === 'fixed_monthly' ? sp.perMonth : sp.perDay}
                value={formatCurrency(Math.round(preview.amount))}
              />
              <PreviewRow label={sp.expectedTotal} value={formatCurrency(Math.round(preview.total))} />
            </dl>
          ) : (
            <dl className="mt-3 divide-y divide-well font-mono text-xs">
              <PreviewRow label={sp.estimatedFinish} value={formatShortDateKey(preview.finishDateKey)} />
              <PreviewRow label={sp.savingDays} value={sp.savingDaysValue(preview.days)} />
              <PreviewRow label={sp.dailyCap} value={formatCurrency(Math.round(preview.capAmount))} />
              <PreviewRow label={sp.expectedTotal} value={formatCurrency(Math.round(preview.total))} />
            </dl>
          )}

        </section>
      )}

      </div>{/* end form sections */}

      {/* Validation / error */}
      {(message || error) && (
        <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">
          {message ?? error}
        </p>
      )}

      {/* CTA — hidden while the plan is paused */}
      {!(isChange && isPaused) && (
        <div className="flex flex-col gap-2">
          <Button variant="action" fullWidth onClick={handleSubmit} disabled={submitting}>
            {submitting ? sp.savingButton : sp.savePlanButton}
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={() => navigate(-1)}>
            {sp.cancelButton}
          </Button>
        </div>
      )}
      </div>
      <ConfirmModal
        open={confirmingPause}
        title={sp.pauseConfirmTitle}
        body={sp.pauseConfirmBody}
        confirmLabel={sp.pauseConfirmLabel}
        onCancel={() => setConfirmingPause(false)}
        onConfirm={runPause}
      />
      <ConfirmModal
        open={confirmingResume}
        title={sp.resumeConfirmTitle}
        body={sp.resumeConfirmBody}
        confirmLabel={sp.resumeConfirmLabel}
        onCancel={() => setConfirmingResume(false)}
        onConfirm={runResume}
      />
      <ConfirmModal
        open={pendingChangeInput !== null}
        title={sp.changeConfirmTitle}
        body={sp.changeConfirmBody}
        confirmLabel={sp.changeConfirmLabel}
        onCancel={() => setPendingChangeInput(null)}
        onConfirm={runChange}
      />
    </div>
  );
}

function BigLabelField({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800">
        {label}
      </span>
      <div className="mt-3">{children}</div>
      {helper && (
        <span className="mt-3 block font-mono text-sm text-ink-muted">{helper}</span>
      )}
    </label>
  );
}

function CardField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-bold text-ink">{value}</dd>
    </div>
  );
}
