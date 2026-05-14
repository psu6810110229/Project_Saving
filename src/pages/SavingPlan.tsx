import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { FormField } from '../components/FormField/FormField';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { TextInput } from '../components/TextInput/TextInput';
import { useGoal } from '../hooks/useGoal';
import { useRoom } from '../hooks/useRoom';
import { useSavingPlan } from '../hooks/useSavingPlan';
import { formatCurrency } from '../lib/format';
import { haptic } from '../lib/haptics';
import {
  RULE_TYPE_LABEL,
  activeRevisionAt,
  todayBangkokKey,
} from '../lib/savingPlan';
import type { SavingPlanRuleType } from '../types';

interface PresetOption {
  id: SavingPlanRuleType;
  label: string;
  description: string;
}

const PRESETS: PresetOption[] = [
  { id: 'fixed_daily',      label: 'Fixed daily',      description: 'Same amount every day.' },
  { id: 'fixed_weekly',     label: 'Fixed weekly',     description: 'Same amount per week, smoothed across the week.' },
  { id: 'fixed_monthly',    label: 'Fixed monthly',    description: 'Same amount per month, smoothed across the month.' },
  { id: 'increasing_daily', label: 'Increasing daily', description: 'Start small, add a little more each day.' },
];

export function SavingPlan() {
  const navigate = useNavigate();
  const { activeRoomId } = useRoom();
  const { goal } = useGoal(activeRoomId);
  const { plan, loading, createPlan, changePlan } = useSavingPlan(activeRoomId);

  const latestRevision = plan
    ? activeRevisionAt(plan.revisions, todayBangkokKey())
    : null;
  const isChange = Boolean(plan);

  const [ruleType, setRuleType] = useState<SavingPlanRuleType>('fixed_daily');
  const [amount, setAmount] = useState('');
  const [startAmount, setStartAmount] = useState('1');
  const [incrementAmount, setIncrementAmount] = useState('1');
  const [targetAmount, setTargetAmount] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seededRevisionId, setSeededRevisionId] = useState<string | null>(null);
  const [didSeedCreateTarget, setDidSeedCreateTarget] = useState(false);

  // Seed defaults from the active revision when changing an existing
  // plan, otherwise pull the target from the synchronized room goal.
  useEffect(() => {
    if (loading) return;
    if (latestRevision) {
      if (seededRevisionId === latestRevision.id) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRuleType(latestRevision.rule_type);
      setAmount(latestRevision.amount != null ? String(latestRevision.amount) : '');
      setStartAmount(latestRevision.start_amount != null ? String(latestRevision.start_amount) : '1');
      setIncrementAmount(latestRevision.increment_amount != null ? String(latestRevision.increment_amount) : '1');
      setTargetAmount(String(latestRevision.target_amount));
      setSeededRevisionId(latestRevision.id);
      setDidSeedCreateTarget(true);
      return;
    }
    if (!didSeedCreateTarget && goal?.target_amount) {
      setTargetAmount(String(goal.target_amount));
      setDidSeedCreateTarget(true);
    }
  }, [loading, latestRevision, goal?.target_amount, didSeedCreateTarget, seededRevisionId]);

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

  async function handleSubmit() {
    setMessage(null);

    const targetNum = Number(targetAmount);
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      setMessage('Target amount must be greater than zero.');
      return;
    }

    let amountNum: number | undefined;
    let startNum: number | undefined;
    let incNum: number | undefined;

    if (ruleType === 'increasing_daily') {
      startNum = Number(startAmount);
      incNum = Number(incrementAmount);
      if (!Number.isFinite(startNum) || startNum <= 0) {
        setMessage('Start amount must be greater than zero.');
        return;
      }
      if (!Number.isFinite(incNum) || incNum < 0) {
        setMessage('Increment must be zero or more.');
        return;
      }
    } else {
      amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        setMessage('Amount must be greater than zero.');
        return;
      }
    }

    setSubmitting(true);
    const input = {
      ruleType,
      targetAmount: targetNum,
      amount: amountNum,
      startAmount: startNum,
      incrementAmount: incNum,
      effectiveFromDate: todayBangkokKey(),
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
      <PageHeader
        eyebrow="Saving Plan"
        title={isChange ? 'Change plan' : 'Set up plan'}
        subtitle={isChange
          ? 'Changes start from today. Past progress will not be rewritten.'
          : 'Pick a cadence and your save amount.'}
        showBack
      />

      {goal?.target_amount && !isChange && (
        <section className="rounded-3xl bg-surfaceAlt p-4">
          <SectionLabel tone="muted">Project goal</SectionLabel>
          <p className="mt-1 font-mono text-sm text-ink">{formatCurrency(Number(goal.target_amount))}</p>
        </section>
      )}

      <section className="rounded-3xl bg-surface p-4 shadow-soft">
        <SectionLabel tone="brand">Cadence</SectionLabel>
        <div className="mt-3 flex flex-col gap-2">
          {PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setRuleType(preset.id)}
              className={
                'w-full rounded-2xl px-4 py-3 text-left font-mono text-sm transition-colors ' +
                (ruleType === preset.id
                  ? 'bg-brand-800 text-ink-inverse'
                  : 'bg-surfaceAlt text-ink hover:bg-brand-50')
              }
            >
              <span className="block font-bold">{preset.label}</span>
              <span className={
                'mt-1 block text-xs ' +
                (ruleType === preset.id ? 'text-ink-inverse/80' : 'text-ink-muted')
              }>
                {preset.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-surface p-4 shadow-soft">
        <SectionLabel tone="brand">{RULE_TYPE_LABEL[ruleType]}</SectionLabel>
        <div className="mt-3 flex flex-col gap-3">
          {ruleType === 'increasing_daily' ? (
            <>
              <FormField label="Start amount" helper="Amount for day 1.">
                <TextInput
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="1"
                  value={startAmount}
                  leadingIcon={<span className="font-mono font-bold">฿</span>}
                  onChange={e => setStartAmount(digitsOnly(e.target.value))}
                />
              </FormField>
              <FormField label="Daily increment" helper="How much to add each day.">
                <TextInput
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="1"
                  value={incrementAmount}
                  leadingIcon={<span className="font-mono font-bold">฿</span>}
                  onChange={e => setIncrementAmount(digitsOnly(e.target.value))}
                />
              </FormField>
            </>
          ) : (
            <FormField
              label="Amount"
              helper={
                ruleType === 'fixed_weekly'
                  ? 'Total per week. Shown as a smoothed daily target.'
                  : ruleType === 'fixed_monthly'
                    ? 'Total per month. Shown as a smoothed daily target.'
                    : 'Amount to save each day.'
              }
            >
              <TextInput
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="100"
                value={amount}
                leadingIcon={<span className="font-mono font-bold">฿</span>}
                onChange={e => setAmount(digitsOnly(e.target.value))}
              />
            </FormField>
          )}

          <FormField label="Plan target" helper="Default from your project goal.">
            <TextInput
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="100000"
              value={targetAmount}
              leadingIcon={<span className="font-mono font-bold">฿</span>}
              onChange={e => setTargetAmount(digitsOnly(e.target.value))}
            />
          </FormField>
        </div>

        {message && (
          <p className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <Button variant="action" fullWidth onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : isChange ? 'Save change' : 'Create plan'}
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
        {isChange && (
          <p className="mt-2 font-mono text-[11px] text-ink-muted">
            A new revision will be created effective today. Past dates keep their old plan.
          </p>
        )}
      </section>
    </div>
  );
}
