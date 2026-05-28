import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import type { BucketCategory, BucketCreateRuleData, SavingRuleType } from '../../types';
import { addDays, daysBetween, todayBangkokKey } from '../../lib/savingPlan';
import { Button } from '../Button/Button';
import { CalendarPicker } from '../CalendarPicker/CalendarPicker';
import { CategoryRow } from '../CategoryRow/CategoryRow';
import { FormField } from '../FormField/FormField';
import { IconEdit, IconPiggyBank } from '../Icon/Icon';
import { ReminderDayPicker } from '../ReminderDayPicker/ReminderDayPicker';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';

interface BucketCategoryOption {
  id: BucketCategory;
  label: string;
  icon: ReactNode;
}

interface CreateBucketFormProps {
  category: BucketCategory | null;
  options: BucketCategoryOption[];
  name: string;
  target: string;
  targetHelper?: string;
  targetError?: string;
  onCategoryChange: (next: BucketCategory) => void;
  onNameChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onSubmit: (ruleData: BucketCreateRuleData) => void;
  roomEndDate?: string | null;
}

type RuleChoice = 'fixed_daily' | 'fixed_weekly' | 'fixed_monthly' | 'flexible' | 'custom';

function recommendedRule(remainingDays: number): RuleChoice {
  if (remainingDays <= 90) return 'fixed_daily';
  if (remainingDays <= 365) return 'fixed_weekly';
  return 'fixed_monthly';
}

function calcRuleAmount(targetAmount: number, remainingDays: number, rule: 'fixed_daily' | 'fixed_weekly' | 'fixed_monthly'): number {
  if (remainingDays <= 0) return targetAmount;
  switch (rule) {
    case 'fixed_daily': return Math.ceil(targetAmount / remainingDays);
    case 'fixed_weekly': return Math.ceil(targetAmount / Math.max(1, Math.ceil(remainingDays / 7)));
    case 'fixed_monthly': return Math.ceil(targetAmount / Math.max(1, Math.ceil(remainingDays / 30)));
  }
}

export function CreateBucketForm({
  category,
  options,
  name,
  target,
  targetHelper,
  targetError,
  onCategoryChange,
  onNameChange,
  onTargetChange,
  onSubmit,
  roomEndDate,
}: CreateBucketFormProps) {
  const { copy, formatMoney } = useI18n();
  const b = copy.bucket;

  const today = todayBangkokKey();
  const defaultDeadline = roomEndDate?.slice(0, 10) ?? '';

  const [step, setStep] = useState(0);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [ruleChoice, setRuleChoice] = useState<RuleChoice | null>(null);
  const [reminderDay, setReminderDay] = useState(25);
  const [customStart, setCustomStart] = useState('');
  const [customIncrement, setCustomIncrement] = useState('');
  const [customCap, setCustomCap] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);
  const reminderDayRef = useRef<HTMLDivElement | null>(null);

  const targetAmount = Number(target) || 0;
  const remainingDays = deadline ? daysBetween(today, deadline) : 0;

  useEffect(() => {
    if (step !== 2 || ruleChoice !== 'fixed_monthly') return;
    const timeoutId = window.setTimeout(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      reminderDayRef.current?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'nearest',
      });
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [ruleChoice, step]);

  function handleBasicsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!category || !name.trim() || targetAmount <= 0) return;
    const prefill = roomEndDate?.slice(0, 10) ?? '';
    if (!deadline && prefill) setDeadline(prefill);
    setStep(1);
    setStepError(null);
  }

  function handleDeadlineNext() {
    if (!deadline) {
      setStepError(b.validationDeadlineRequired);
      return;
    }
    if (deadline <= today) {
      setStepError(b.validationDeadlineFuture);
      return;
    }
    const days = daysBetween(today, deadline);
    if (!ruleChoice) setRuleChoice(recommendedRule(days));
    setStep(2);
    setStepError(null);
  }

  function handleFinalSubmit() {
    if (!ruleChoice) return;

    let savingRuleType: SavingRuleType;
    let savingRuleAmount: number | null = null;
    let savingRuleStartAmount: number | null = null;
    let savingRuleIncrement: number | null = null;
    let savingRuleCap: number | null = null;
    let savingRuleDayCount: number | null = null;
    let finalReminderDay: number | null = null;

    if (ruleChoice === 'fixed_daily' || ruleChoice === 'fixed_weekly' || ruleChoice === 'fixed_monthly') {
      savingRuleType = ruleChoice;
      savingRuleAmount = calcRuleAmount(targetAmount, remainingDays, ruleChoice);
      if (ruleChoice === 'fixed_monthly') finalReminderDay = reminderDay;
    } else if (ruleChoice === 'flexible') {
      savingRuleType = 'flexible';
    } else {
      const start = Number(customStart) || 0;
      const inc = Number(customIncrement) || 0;
      const cap = Number(customCap) || 0;
      savingRuleStartAmount = start;
      savingRuleIncrement = inc;
      savingRuleDayCount = Math.max(1, remainingDays);
      if (cap > 0) {
        savingRuleType = 'increasing_daily_capped';
        savingRuleCap = cap;
      } else {
        savingRuleType = 'increasing_daily';
      }
    }

    onSubmit({
      deadline,
      savingRuleType,
      savingRuleAmount,
      savingRuleStartAmount,
      savingRuleIncrement,
      savingRuleCap,
      savingRuleDayCount,
      reminderDay: finalReminderDay,
    });
  }

  // ── Step 0: Basics ──────────────────────────────────────────
  if (step === 0) {
    return (
      <form className="rounded-xl bg-surface shadow-soft p-5 flex flex-col gap-4" onSubmit={handleBasicsSubmit}>
        <div>
          <SectionLabel tone="brand">{b.createSectionLabel}</SectionLabel>
          <h2 className="mt-1 font-mono text-2xl font-bold text-ink">{b.createTitle}</h2>
        </div>
        <CategoryRow label={b.categoryLabel} shape="circle" options={options} value={category} onChange={onCategoryChange} />
        <FormField label={b.nameLabel}>
          <TextInput value={name} maxLength={12} placeholder={b.namePlaceholder} leadingIcon={<IconEdit size={16} />} onChange={(event: ChangeEvent<HTMLInputElement>) => onNameChange(event.target.value)} />
        </FormField>
        <FormField label={b.targetLabel} helper={targetHelper} error={targetError}>
          <TextInput value={target} inputMode="numeric" placeholder="30000" leadingIcon={<IconPiggyBank size={16} />} onChange={(event: ChangeEvent<HTMLInputElement>) => onTargetChange(event.target.value)} />
        </FormField>
        <Button variant="action" fullWidth type="submit">{b.nextButton}</Button>
      </form>
    );
  }

  // ── Step 1: Deadline ────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="rounded-xl bg-surface shadow-soft p-5 flex flex-col gap-4">
        <div>
          <SectionLabel tone="brand">{b.createSectionLabel}</SectionLabel>
          <h2 className="mt-1 font-mono text-2xl font-bold text-ink">{b.deadlineStepTitle}</h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">{b.deadlineHelper}</p>
        </div>
        {stepError && (
          <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{stepError}</p>
        )}
        <CalendarPicker
          value={deadline || today}
          onChange={setDeadline}
          minDate={addDays(today, 1)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="md" onClick={() => { setStep(0); setStepError(null); }}>
            {copy.common.back}
          </Button>
          <Button variant="action" size="md" onClick={handleDeadlineNext}>
            {b.nextButton}
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 2: Saving Rule ─────────────────────────────────────
  const recommended = recommendedRule(remainingDays);
  const dailyAmount = calcRuleAmount(targetAmount, remainingDays, 'fixed_daily');
  const weeklyAmount = calcRuleAmount(targetAmount, remainingDays, 'fixed_weekly');
  const monthlyAmount = calcRuleAmount(targetAmount, remainingDays, 'fixed_monthly');

  const ruleOptions: { id: RuleChoice; label: string; isRecommended: boolean }[] = [
    { id: 'fixed_daily', label: b.rulePerDay(formatMoney(dailyAmount)), isRecommended: recommended === 'fixed_daily' },
    { id: 'fixed_weekly', label: b.rulePerWeek(formatMoney(weeklyAmount)), isRecommended: recommended === 'fixed_weekly' },
    { id: 'fixed_monthly', label: b.rulePerMonth(formatMoney(monthlyAmount)), isRecommended: recommended === 'fixed_monthly' },
    { id: 'flexible', label: b.ruleFlexible, isRecommended: false },
    { id: 'custom', label: b.ruleCustom, isRecommended: false },
  ];

  return (
    <div className="rounded-xl bg-surface shadow-soft p-5 flex flex-col gap-4">
      <div>
        <SectionLabel tone="brand">{b.createSectionLabel}</SectionLabel>
        <h2 className="mt-1 font-mono text-2xl font-bold text-ink">{b.ruleStepTitle}</h2>
      </div>

      <div className="flex flex-col gap-2">
        {ruleOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setRuleChoice(opt.id)}
            className={[
              'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all',
              ruleChoice === opt.id
                ? 'bg-brand-100 ring-2 ring-brand-500'
                : 'bg-well hover:bg-brand-50',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                ruleChoice === opt.id
                  ? 'border-brand-500 bg-brand-500'
                  : 'border-ink-dim bg-transparent',
              ].join(' ')}
            >
              {ruleChoice === opt.id && (
                <span className="block h-2 w-2 rounded-full bg-white" />
              )}
            </span>
            <span className="flex-1 font-mono text-sm font-bold text-ink">{opt.label}</span>
            {opt.isRecommended && (
              <span className="rounded-pill bg-brand-500 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-inverse">
                {b.ruleRecommended}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Monthly reminder day */}
      {ruleChoice === 'fixed_monthly' && (
        <div ref={reminderDayRef} className="scroll-mt-4">
          <FormField label={b.reminderDayLabel}>
            <ReminderDayPicker
              value={reminderDay}
              onChange={setReminderDay}
              valueLabel={b.reminderDayValue}
              decreaseAriaLabel={b.reminderDayDecrease}
              increaseAriaLabel={b.reminderDayIncrease}
            />
          </FormField>
        </div>
      )}

      {/* Custom increasing fields */}
      {ruleChoice === 'custom' && (
        <div className="flex flex-col gap-3 rounded-xl bg-well p-4">
          <FormField label={b.customStartAmount}>
            <TextInput
              value={customStart}
              inputMode="numeric"
              placeholder="10"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomStart(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </FormField>
          <FormField label={b.customDailyIncrease}>
            <TextInput
              value={customIncrement}
              inputMode="numeric"
              placeholder="5"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomIncrement(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </FormField>
          <FormField label={b.customCap}>
            <TextInput
              value={customCap}
              inputMode="numeric"
              placeholder="200"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomCap(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </FormField>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" size="md" onClick={() => setStep(1)}>
          {copy.common.back}
        </Button>
        <Button variant="action" size="md" disabled={!ruleChoice} onClick={handleFinalSubmit}>
          {b.createButton}
        </Button>
      </div>
    </div>
  );
}
