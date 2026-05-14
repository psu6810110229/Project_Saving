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
import { formatCurrency } from '../lib/format';
import { haptic } from '../lib/haptics';
import {
  activeRevisionAt,
  addDays,
  daysInclusive,
  plannedCumulativeThroughDate,
  projectedCompletionDate,
  shortDateLabel,
  todayBangkokKey,
} from '../lib/savingPlan';
import type { SavingPlanRevision, SavingPlanRuleType } from '../types';

interface PresetOption {
  id: SavingPlanRuleType;
  label: string;
}

const PRESETS: PresetOption[] = [
  { id: 'fixed_daily',      label: 'Daily' },
  { id: 'fixed_weekly',     label: 'Weekly' },
  { id: 'fixed_monthly',    label: 'Monthly' },
  { id: 'increasing_daily', label: 'Increasing' },
];

type StopMode = 'target' | 'days' | 'date';

interface StopOption {
  id: StopMode;
  label: string;
}

const STOP_OPTIONS: StopOption[] = [
  { id: 'target', label: 'When target is reached' },
  { id: 'days',   label: 'After a number of days' },
  { id: 'date',   label: 'On a specific date' },
];

export function SavingPlan() {
  const navigate = useNavigate();
  const { activeRoomId } = useRoom();
  const { goal } = useGoal(activeRoomId);
  const { plan, loading, error, isPaused, createPlan, changePlan, pausePlan, resumePlan } = useSavingPlan(activeRoomId);

  const latestRevision = plan
    ? activeRevisionAt(plan.revisions, todayBangkokKey())
    : null;
  const isChange = Boolean(plan);

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
      <div className="flex flex-col gap-4" aria-label="Loading saving plan">
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
      setMessage('Enter a plan target.');
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
        setMessage('Enter a start amount.');
        return;
      }
      if (!Number.isFinite(incNum) || incNum < 0) {
        setMessage('Increase by must be zero or more.');
        return;
      }
      if (capAmount.trim() === '') {
        setMessage('Enter a maximum daily amount.');
        return;
      }
      capNum = Number(capAmount);
      if (!Number.isFinite(capNum) || capNum <= 0) {
        setMessage('Maximum daily amount must be greater than zero.');
        return;
      }
      if (capNum < startNum) {
        setMessage('Maximum daily amount must be at least the start amount.');
        return;
      }

      if (stopMode === 'target') {
        dayCountNum = undefined;
        endDateOut = undefined;
      } else if (stopMode === 'days') {
        if (dayCount.trim() === '') {
          setMessage('Enter the number of days.');
          return;
        }
        dayCountNum = Number(dayCount);
        if (!Number.isInteger(dayCountNum) || dayCountNum <= 0) {
          setMessage('Plan length must be at least 1 day.');
          return;
        }
        endDateOut = undefined;
      } else {
        if (!endDate) {
          setMessage('Choose a stop date.');
          return;
        }
        if (endDate < effectiveFromDate) {
          setMessage('Choose a future end date.');
          return;
        }
        endDateOut = endDate;
        dayCountNum = undefined;
      }

      submitRuleType = 'increasing_daily_capped';
    } else {
      amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        setMessage('Enter an amount.');
        return;
      }
      if (endDate && endDate < effectiveFromDate) {
        setMessage('Choose a future end date.');
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

  const amountHelper = ruleType === 'fixed_weekly'
    ? 'Per week.'
    : ruleType === 'fixed_monthly'
      ? 'Per month.'
      : 'Per day.';

  return (
    <div className="flex flex-col gap-5">
      {/* Back button stays at the top; the rest of the page is lowered. */}
      <div>
        <IconButton ariaLabel="Go back" size="md" onClick={() => navigate(-1)}>
          <IconArrowLeft size={20} />
        </IconButton>
      </div>

      {/* Lowered content. */}
      <div className="mt-10 flex flex-col gap-5">
        <header className="min-w-0">
          <p className="font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800">
            Saving Plan
          </p>
          <h1 className="mt-2 truncate font-mono text-3xl font-bold text-ink">
            {isChange ? 'Change plan' : 'Set up plan'}
          </h1>
        </header>

      {/* Plan type selector */}
      <section className="rounded-3xl bg-brand-50 p-5 shadow-soft">
        <p className="font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800">
          Plan type
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
                  'rounded-2xl px-4 py-3 text-center font-mono text-sm font-bold transition-colors ' +
                  (selected
                    ? 'bg-brand-500 text-ink-inverse shadow-haloOrange'
                    : 'bg-surface text-ink shadow-soft hover:bg-brand-50')
                }
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Plan fields */}
      <section className="rounded-3xl bg-surface p-5 shadow-soft">
        <div className="flex flex-col gap-4">
          {ruleType === 'increasing_daily' ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CardField label="Start amount">
                  <TextInput
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="1"
                    value={startAmount}
                    leadingIcon={<span className="font-mono font-bold">฿</span>}
                    onChange={e => setStartAmount(digitsOnly(e.target.value))}
                  />
                </CardField>
                <CardField label="Increase by">
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

              <CardField label="Maximum daily amount">
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
                <p className="font-mono text-sm font-bold text-ink">Stop when</p>
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
                    <CardField label="Run this plan for">
                      <TextInput
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="500"
                        value={dayCount}
                        trailingIcon={<span className="font-mono text-xs text-ink-muted">days</span>}
                        onChange={e => setDayCount(digitsOnly(e.target.value))}
                      />
                    </CardField>
                  </div>
                )}

                {stopMode === 'date' && (
                  <div className="mt-3">
                    <CardField label="End date">
                      <TextInput
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                      />
                    </CardField>
                  </div>
                )}
              </div>

              <CardField label="Plan target">
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
              <BigLabelField label="Amount" helper={amountHelper}>
                <TextInput
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="100"
                  value={amount}
                  leadingIcon={<span className="font-mono font-bold">฿</span>}
                  onChange={e => setAmount(digitsOnly(e.target.value))}
                />
              </BigLabelField>

              <BigLabelField label="Plan target">
                <TextInput
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="100000"
                  value={targetAmount}
                  leadingIcon={<span className="font-mono font-bold">฿</span>}
                  onChange={e => setTargetAmount(digitsOnly(e.target.value))}
                />
              </BigLabelField>

              <BigLabelField label="End date">
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
        <section className="rounded-3xl bg-brand-50 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800">
              Preview
            </p>
            {preview.mode !== 'target' && !preview.reachesTarget && (
              <Chip tone="peach">Below target</Chip>
            )}
          </div>

          {preview.mode === 'target' && preview.unreachable ? (
            <p className="mt-3 font-mono text-xs text-ink-muted">
              Can&apos;t reach your target within 10 years. Try a higher maximum daily amount.
            </p>
          ) : (
            <dl className="mt-3 flex flex-col gap-2 font-mono text-xs">
              <PreviewRow label="Estimated finish" value={shortDateLabel(preview.finishDateKey)} />
              <PreviewRow label="Saving days" value={`${preview.days} day${preview.days === 1 ? '' : 's'}`} />
              <PreviewRow label="Daily cap" value={formatCurrency(Math.round(preview.capAmount))} />
              <PreviewRow label="Expected total" value={formatCurrency(Math.round(preview.total))} />
            </dl>
          )}

          {preview.mode !== 'target' && !preview.reachesTarget && (
            <p className="mt-3 font-mono text-[11px] text-ink-muted">
              This may finish below your target.
            </p>
          )}
        </section>
      )}

      {/* Validation / error */}
      {(message || error) && (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 font-mono text-xs text-danger">
          {message ?? error}
        </p>
      )}

      {/* CTA */}
      <div className="flex flex-col gap-2">
        <Button variant="action" fullWidth onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save plan'}
        </Button>
        <Button variant="ghost" size="md" fullWidth onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
      {isChange && (
        <p className="text-center font-mono text-[11px] text-ink-muted">
          Changes start from today. Past progress is kept.
        </p>
      )}

      {/* Pause / Resume section — only shown when a plan exists. */}
      {isChange && (
        <section className="rounded-3xl bg-surface p-5 shadow-soft">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-ink-muted">
            Pause plan
          </p>
          {isPaused ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="font-mono text-sm text-ink-muted">Plan is paused</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResume}
                disabled={submitting}
              >
                Resume
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <Button
                variant="ghost"
                fullWidth
                onClick={handlePause}
                disabled={submitting}
              >
                Pause plan
              </Button>
            </div>
          )}
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

/**
 * Stacked-card field used inside the Increasing Daily form. Each
 * field is its own peach mini-card so the dense set of inputs reads
 * as a tidy list of rows rather than a stack of competing labels.
 */
function CardField({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-brand-50 p-3 shadow-soft">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-brand-800">
        {label}
      </p>
      <div className="mt-2">{children}</div>
      {helper && (
        <p className="mt-2 font-mono text-xs text-ink-muted">{helper}</p>
      )}
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
