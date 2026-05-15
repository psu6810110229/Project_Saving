import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { Chip } from '../components/Chip/Chip';
import { IconArrowLeft } from '../components/Icon/Icon';
import { IconButton } from '../components/IconButton/IconButton';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { TextInput } from '../components/TextInput/TextInput';
import { useGoal } from '../hooks/useGoal';
import { useRoom } from '../hooks/useRoom';
import { useSavingPlan } from '../hooks/useSavingPlan';
import { useI18n } from '../i18n/useI18n';
import { formatCurrency } from '../lib/format';
import { haptic } from '../lib/haptics';
import {
  activeRevisionAt,
  addDays,
  daysInclusive,
  plannedCumulativeThroughDate,
  projectedCompletionDate,
  todayBangkokKey,
} from '../lib/savingPlan';
import type { SavingPlanRevision, SavingPlanRuleType } from '../types';

type StopMode = 'target' | 'days' | 'date';

export function SavingPlan() {
  const navigate = useNavigate();
  const { activeRoomId } = useRoom();
  const { goal } = useGoal(activeRoomId);
  const { plan, loading, error, isPaused, createPlan, changePlan, pausePlan, resumePlan } = useSavingPlan(activeRoomId);
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

  const latestRevision = plan
    ? activeRevisionAt(plan.revisions, todayBangkokKey())
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
  const [stopMode, setStopMode] = useState<StopMode>('target');
  const [message, setMessage] = useState<string | null>(null);
  const [pauseMessage, setPauseMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seededRevisionId, setSeededRevisionId] = useState<string | null>(null);
  const [didSeedCreateTarget, setDidSeedCreateTarget] = useState(false);

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
      setEndDate(goal.end_date ?? '');
      setDidSeedCreateTarget(true);
    }
  }, [loading, latestRevision, goal?.target_amount, goal?.end_date, didSeedCreateTarget, seededRevisionId]);

  const effectiveFromDate = todayBangkokKey();

  // Synthetic revision powering the live preview card. Recalculated
  // from the live form inputs so estimates update as the user types.
  const previewRevisions = useMemo<SavingPlanRevision[] | null>(() => {
    if (ruleType !== 'increasing_daily') return null;
    const startNum = Number(startAmount);
    const incNum = Number(incrementAmount);
    const capNum = Number(capAmount);
    const targetNum = Number(targetAmount);
    if (!Number.isFinite(startNum) || startNum <= 0) return null;
    if (!Number.isFinite(incNum) || incNum < 0) return null;
    if (!Number.isFinite(capNum) || capNum <= 0 || capNum < startNum) return null;
    if (!Number.isFinite(targetNum) || targetNum <= 0) return null;
    const dayCountNum = dayCount.trim() !== '' && /^[0-9]+$/.test(dayCount) ? Number(dayCount) : null;
    return [{
      id: 'preview',
      plan_id: 'preview',
      room_id: 'preview',
      user_id: 'preview',
      effective_from_date: effectiveFromDate,
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
  }, [ruleType, startAmount, incrementAmount, capAmount, targetAmount, stopMode, endDate, dayCount, effectiveFromDate]);

  const preview = useMemo(() => {
    if (!previewRevisions) return null;
    const rev = previewRevisions[0];
    const targetNum = Number(rev.target_amount);
    const capNum = Number(rev.cap_amount ?? 0);
    const beforeStart = addDays(effectiveFromDate, -1);

    if (stopMode === 'target') {
      const finish = projectedCompletionDate(previewRevisions, 0, beforeStart, 3650);
      if (!finish) {
        return { mode: 'target' as const, unreachable: true as const, capAmount: capNum };
      }
      const days = daysInclusive(effectiveFromDate, finish);
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
      const endKey = addDays(effectiveFromDate, rev.day_count - 1);
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
    const days = daysInclusive(effectiveFromDate, rev.end_date);
    return {
      mode: 'date' as const,
      finishDateKey: rev.end_date,
      days,
      total,
      target: targetNum,
      capAmount: capNum,
      reachesTarget: total + 0.005 >= targetNum,
    };
  }, [previewRevisions, stopMode, effectiveFromDate]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-label={sp.loadingAriaLabel}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  function digitsOnly(value: string): string {
    return value.replace(/[^0-9]/g, '');
  }

  async function handlePause() {
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

  async function handleResume() {
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
        if (endDate < effectiveFromDate) {
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

    setSubmitting(true);
    const input = {
      ruleType: submitRuleType,
      targetAmount: targetNum,
      amount: amountNum,
      startAmount: startNum,
      incrementAmount: incNum,
      capAmount: capNum,
      dayCount: dayCountNum,
      effectiveFromDate,
      endDate: endDateOut,
    };
    const result = isChange ? await changePlan(input) : await createPlan(input);
    setSubmitting(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }
    haptic('success');
    navigate('/dashboard');
  }


  return (
    <div className="flex flex-col gap-5">
      {/* Back button stays at the top; the rest of the page is lowered. */}
      <div>
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
        </header>

      {/* Form sections — non-interactive while plan is paused */}
      <div className={`flex flex-col gap-5${isChange && isPaused ? ' pointer-events-none select-none opacity-50' : ''}`}>

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
                onClick={() => setRuleType(preset.id)}
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
                    <CardField label={sp.endDateLabel}>
                      <TextInput
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                      />
                    </CardField>
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
                <TextInput
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
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
            {preview.mode !== 'target' && !preview.reachesTarget && (
              <Chip tone="peach">{sp.belowTargetChip}</Chip>
            )}
          </div>

          {preview.mode === 'target' && preview.unreachable ? (
            <p className="mt-3 font-mono text-xs text-ink-muted">
              {sp.unreachableHint}
            </p>
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

      {/* Paused banner — shown prominently when plan is paused. */}
      {isChange && isPaused && (
        <section className="rounded-xl bg-surface p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-brand-800">
                {sp.planPausedLabel}
              </p>
              {pausedSince && (
                <p className="mt-1 font-mono text-base font-bold text-ink">
                  {sp.pausedSinceLabel(formatShortDateKey(pausedSince))}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="action"
              fullWidth
              onClick={handleResume}
              disabled={submitting}
            >
              {submitting ? sp.resumingButton : sp.resumeButton}
            </Button>
          </div>
          {pauseMessage && (
            <p className="mt-2 font-mono text-xs text-danger">{pauseMessage}</p>
          )}
        </section>
      )}

      {/* Validation / error */}
      {(message || error) && (
        <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">
          {message ?? error}
        </p>
      )}

      {/* CTA — hidden while the plan is paused */}
      {!(isChange && isPaused) && (
        <>
          <div className="flex flex-col gap-2">
            <Button variant="action" fullWidth onClick={handleSubmit} disabled={submitting}>
              {submitting ? sp.savingButton : sp.savePlanButton}
            </Button>
            <Button variant="ghost" size="md" fullWidth onClick={() => navigate(-1)}>
              {sp.cancelButton}
            </Button>
          </div>
        </>
      )}

      {/* Pause section — shown when plan is active (not paused). */}
      {isChange && !isPaused && (
        <section className="rounded-xl bg-surface p-5 shadow-soft">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-ink-muted">
            {sp.pausePlanSection}
          </p>
          <div className="mt-3">
            <Button
              variant="primary"
              fullWidth
              onClick={handlePause}
              disabled={submitting}
            >
              {sp.pausePlanButton}
            </Button>
          </div>
          {pauseMessage && (
            <p className="mt-2 font-mono text-xs text-danger">{pauseMessage}</p>
          )}
        </section>
      )}
      </div>
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
