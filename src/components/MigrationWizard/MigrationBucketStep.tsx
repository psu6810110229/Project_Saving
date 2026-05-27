import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Bucket, BucketCreateRuleData, BucketTransfer, SavingRuleType, SavingsLog } from '../../types';
import { addDays, daysBetween, todayBangkokKey } from '../../lib/savingPlan';
import { bucketSaved } from '../../lib/buckets';
import { Button } from '../Button/Button';
import { CalendarPicker } from '../CalendarPicker/CalendarPicker';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { FormField } from '../FormField/FormField';
import { ReminderDayPicker } from '../ReminderDayPicker/ReminderDayPicker';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';

type RuleChoice = 'fixed_daily' | 'fixed_weekly' | 'fixed_monthly' | 'flexible' | 'custom';
type FixedRuleChoice = Exclude<RuleChoice, 'flexible' | 'custom'>;

interface MigrationBucketStepProps {
  bucket: Bucket;
  bucketNumber: number;
  totalBuckets: number;
  roomEndDate: string | null;
  logs: SavingsLog[];
  transfers?: BucketTransfer[];
  onBack?: () => void;
  onSubmit: (bucket: Bucket, ruleData: BucketCreateRuleData) => Promise<{ error?: string }> | { error?: string };
}

const CATEGORY_MONTH_OFFSETS: Record<string, number> = {
  flight: -6,
  stay: -3,
  activities: -2,
  transport: -1,
  food: 0,
  shopping: 0,
  buffer: 0,
  home: 0,
  other: 0,
};

function addMonthsClamped(dateKey: string, offsetMonths: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const targetMonthIndex = month - 1 + offsetMonths;
  const firstOfTarget = new Date(Date.UTC(year, targetMonthIndex, 1));
  const targetYear = firstOfTarget.getUTCFullYear();
  const targetMonth = firstOfTarget.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  const mm = String(targetMonth + 1).padStart(2, '0');
  const dd = String(clampedDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

function calcDefaultDeadline(bucket: Bucket, roomEndDate: string | null, today: string): string {
  const roomEnd = roomEndDate?.slice(0, 10);
  if (!roomEnd) return addDays(today, 30);
  const offset = CATEGORY_MONTH_OFFSETS[bucket.category ?? 'other'] ?? 0;
  const suggested = addMonthsClamped(roomEnd, offset);
  return suggested > today ? suggested : addDays(today, 7);
}

function recommendedRule(remainingDays: number): RuleChoice {
  if (remainingDays <= 90) return 'fixed_daily';
  if (remainingDays <= 365) return 'fixed_weekly';
  return 'fixed_monthly';
}

function initialRuleChoice(ruleType: SavingRuleType | null | undefined, remainingDays: number): RuleChoice {
  if (
    ruleType === 'fixed_daily'
    || ruleType === 'fixed_weekly'
    || ruleType === 'fixed_monthly'
    || ruleType === 'flexible'
  ) {
    return ruleType;
  }
  if (ruleType === 'increasing_daily' || ruleType === 'increasing_daily_capped') {
    return 'custom';
  }
  return recommendedRule(remainingDays);
}

function calcRuleAmount(targetAmount: number, remainingDays: number, rule: FixedRuleChoice): number {
  if (remainingDays <= 0) return targetAmount;
  switch (rule) {
    case 'fixed_daily':
      return Math.ceil(targetAmount / remainingDays);
    case 'fixed_weekly':
      return Math.ceil(targetAmount / Math.max(1, Math.ceil(remainingDays / 7)));
    case 'fixed_monthly':
      return Math.ceil(targetAmount / Math.max(1, Math.ceil(remainingDays / 30)));
  }
}

export function MigrationBucketStep({
  bucket,
  bucketNumber,
  totalBuckets,
  roomEndDate,
  logs,
  transfers,
  onBack,
  onSubmit,
}: MigrationBucketStepProps) {
  const { copy, formatMoney } = useI18n();
  const m = copy.migrationWizard;
  const today = todayBangkokKey();
  const [deadline, setDeadline] = useState(() => bucket.deadline ?? calcDefaultDeadline(bucket, roomEndDate, today));
  const remainingDays = Math.max(1, daysBetween(today, deadline));
  const [ruleChoice, setRuleChoice] = useState<RuleChoice>(() => initialRuleChoice(bucket.saving_rule_type, remainingDays));
  const [reminderDay, setReminderDay] = useState(bucket.reminder_day ?? 25);
  const [customStart, setCustomStart] = useState(() => bucket.saving_rule_start_amount ? String(Math.round(bucket.saving_rule_start_amount)) : '');
  const [customIncrement, setCustomIncrement] = useState(() => bucket.saving_rule_increment ? String(Math.round(bucket.saving_rule_increment)) : '');
  const [customCap, setCustomCap] = useState(() => bucket.saving_rule_cap ? String(Math.round(bucket.saving_rule_cap)) : '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const reminderDayRef = useRef<HTMLDivElement | null>(null);
  const customRuleRef = useRef<HTMLDivElement | null>(null);

  const saved = bucketSaved(bucket.id, logs, transfers);
  const remainingTarget = Math.max(0, bucket.target_amount - saved);

  const amounts = useMemo(() => ({
    fixed_daily: calcRuleAmount(remainingTarget, remainingDays, 'fixed_daily'),
    fixed_weekly: calcRuleAmount(remainingTarget, remainingDays, 'fixed_weekly'),
    fixed_monthly: calcRuleAmount(remainingTarget, remainingDays, 'fixed_monthly'),
  }), [remainingTarget, remainingDays]);
  const recommended = recommendedRule(remainingDays);

  const ruleOptions: Array<{ id: RuleChoice; label: string; helper: string }> = [
    { id: 'fixed_daily', label: copy.bucket.rulePerDay(formatMoney(amounts.fixed_daily)), helper: m.ruleDailyHelper },
    { id: 'fixed_weekly', label: copy.bucket.rulePerWeek(formatMoney(amounts.fixed_weekly)), helper: m.ruleWeeklyHelper },
    { id: 'fixed_monthly', label: copy.bucket.rulePerMonth(formatMoney(amounts.fixed_monthly)), helper: m.ruleMonthlyHelper },
    { id: 'flexible', label: m.ruleFlexibleLabel, helper: m.ruleFlexibleHelper },
    { id: 'custom', label: copy.bucket.ruleCustom, helper: m.ruleCustomHelper },
  ];

  useEffect(() => {
    if (ruleChoice !== 'fixed_monthly' && ruleChoice !== 'custom') return;
    const timeoutId = window.setTimeout(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const target = ruleChoice === 'fixed_monthly' ? reminderDayRef.current : customRuleRef.current;
      target?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'nearest',
      });
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [ruleChoice]);

  async function handleSubmit() {
    if (!deadline) {
      setError(copy.bucket.validationDeadlineRequired);
      return;
    }
    if (deadline <= today) {
      setError(copy.bucket.validationDeadlineFuture);
      return;
    }

    let savingRuleType: SavingRuleType;
    let savingRuleAmount: number | null = null;
    let savingRuleStartAmount: number | null = null;
    let savingRuleIncrement: number | null = null;
    let savingRuleCap: number | null = null;
    let savingRuleDayCount: number | null = null;

    if (ruleChoice === 'fixed_daily' || ruleChoice === 'fixed_weekly' || ruleChoice === 'fixed_monthly') {
      savingRuleType = ruleChoice;
      savingRuleAmount = amounts[ruleChoice];
    } else if (ruleChoice === 'flexible') {
      savingRuleType = 'flexible';
    } else {
      const start = Number(customStart);
      const increment = Number(customIncrement || '0');
      const cap = Number(customCap || '0');
      if (!Number.isFinite(start) || start <= 0) {
        setError(copy.bucket.validationCustomStartAmount);
        return;
      }
      if (!Number.isFinite(increment) || increment < 0) {
        setError(copy.bucket.validationCustomIncrement);
        return;
      }
      if (cap > 0 && cap < start) {
        setError(copy.bucket.validationCustomCap);
        return;
      }
      savingRuleType = cap > 0 ? 'increasing_daily_capped' : 'increasing_daily';
      savingRuleStartAmount = start;
      savingRuleIncrement = increment;
      savingRuleCap = cap > 0 ? cap : null;
      savingRuleDayCount = Math.max(1, remainingDays);
    }

    const ruleData: BucketCreateRuleData = {
      deadline,
      savingRuleType,
      savingRuleAmount,
      savingRuleStartAmount,
      savingRuleIncrement,
      savingRuleCap,
      savingRuleDayCount,
      reminderDay: ruleChoice === 'fixed_monthly' ? reminderDay : null,
    };

    setSubmitting(true);
    setError(null);
    const result = await onSubmit(bucket, ruleData);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl bg-surface p-4 shadow-soft">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <BucketCategoryIcon category={bucket.category} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink-dim">
            {m.bucketStepLabel(bucketNumber, totalBuckets)}
          </p>
          <h3 className="mt-1 break-words font-mono text-lg font-bold leading-tight text-ink">
            {bucket.name}
          </h3>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {m.savedOf(formatMoney(saved), formatMoney(bucket.target_amount))}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{error}</p>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h4 className="font-mono text-sm font-bold text-ink">{m.pickDeadlineTitle}</h4>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {m.pickDeadlineBody}
          </p>
        </div>
        <CalendarPicker value={deadline} onChange={setDeadline} minDate={addDays(today, 1)} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h4 className="font-mono text-sm font-bold text-ink">{m.chooseRuleTitle}</h4>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {m.chooseRuleBody}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {ruleOptions.map(option => {
            const selected = ruleChoice === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setRuleChoice(option.id);
                  setError(null);
                }}
                className={[
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all',
                  selected ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-well hover:bg-brand-50',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-brand-500 bg-brand-500' : 'border-ink-dim',
                  ].join(' ')}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-sm font-bold text-ink">{option.label}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-ink-muted">{option.helper}</span>
                </span>
                {option.id === recommended && (
                  <span className="shrink-0 rounded-pill bg-brand-500 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-inverse">
                    {m.bestFit}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {ruleChoice === 'fixed_monthly' && (
        <div ref={reminderDayRef} className="scroll-mt-4">
          <FormField label={copy.bucket.reminderDayLabel}>
            <ReminderDayPicker
              value={reminderDay}
              onChange={setReminderDay}
              valueLabel={copy.bucket.reminderDayValue}
              decreaseAriaLabel={copy.bucket.reminderDayDecrease}
              increaseAriaLabel={copy.bucket.reminderDayIncrease}
            />
          </FormField>
        </div>
      )}

      {ruleChoice === 'custom' && (
        <div ref={customRuleRef} className="flex scroll-mt-4 flex-col gap-3 rounded-xl bg-well p-4">
          <FormField label={copy.bucket.customStartAmount}>
            <TextInput
              value={customStart}
              inputMode="numeric"
              placeholder="10"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setCustomStart(event.target.value.replace(/[^0-9]/g, ''));
                setError(null);
              }}
            />
          </FormField>
          <FormField label={copy.bucket.customDailyIncrease}>
            <TextInput
              value={customIncrement}
              inputMode="numeric"
              placeholder="5"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setCustomIncrement(event.target.value.replace(/[^0-9]/g, ''));
                setError(null);
              }}
            />
          </FormField>
          <FormField label={copy.bucket.customCap}>
            <TextInput
              value={customCap}
              inputMode="numeric"
              placeholder="200"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setCustomCap(event.target.value.replace(/[^0-9]/g, ''));
                setError(null);
              }}
            />
          </FormField>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" size="md" disabled={!onBack || submitting} onClick={onBack}>
          {copy.common.back}
        </Button>
        <Button variant="action" size="md" disabled={submitting} onClick={handleSubmit}>
          {submitting ? m.savingButton : copy.bucket.nextButton}
        </Button>
      </div>
    </div>
  );
}
