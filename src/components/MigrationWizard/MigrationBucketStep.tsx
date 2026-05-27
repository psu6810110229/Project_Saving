import { useMemo, useState } from 'react';
import type { Bucket, BucketCreateRuleData, BucketTransfer, SavingRuleType, SavingsLog } from '../../types';
import { addDays, daysBetween, todayBangkokKey } from '../../lib/savingPlan';
import { bucketSaved } from '../../lib/buckets';
import { Button } from '../Button/Button';
import { CalendarPicker } from '../CalendarPicker/CalendarPicker';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { FormField } from '../FormField/FormField';
import { useI18n } from '../../i18n/useI18n';

type RuleChoice = 'fixed_daily' | 'fixed_weekly' | 'fixed_monthly' | 'flexible';

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

function calcRuleAmount(targetAmount: number, remainingDays: number, rule: Exclude<RuleChoice, 'flexible'>): number {
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
  const today = todayBangkokKey();
  const [deadline, setDeadline] = useState(() => calcDefaultDeadline(bucket, roomEndDate, today));
  const remainingDays = Math.max(1, daysBetween(today, deadline));
  const [ruleChoice, setRuleChoice] = useState<RuleChoice>(() => recommendedRule(remainingDays));
  const [reminderDay, setReminderDay] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const saved = bucketSaved(bucket.id, logs, transfers);
  const remainingTarget = Math.max(0, bucket.target_amount - saved);

  const amounts = useMemo(() => ({
    fixed_daily: calcRuleAmount(remainingTarget, remainingDays, 'fixed_daily'),
    fixed_weekly: calcRuleAmount(remainingTarget, remainingDays, 'fixed_weekly'),
    fixed_monthly: calcRuleAmount(remainingTarget, remainingDays, 'fixed_monthly'),
  }), [remainingTarget, remainingDays]);
  const recommended = recommendedRule(remainingDays);

  const ruleOptions: Array<{ id: RuleChoice; label: string; helper: string }> = [
    { id: 'fixed_daily', label: `${formatMoney(amounts.fixed_daily)} per day`, helper: 'Best when the deadline is close.' },
    { id: 'fixed_weekly', label: `${formatMoney(amounts.fixed_weekly)} per week`, helper: 'A steady weekly checkpoint.' },
    { id: 'fixed_monthly', label: `${formatMoney(amounts.fixed_monthly)} per month`, helper: 'Good for longer timelines.' },
    { id: 'flexible', label: 'Flexible', helper: 'Track progress without a fixed rhythm.' },
  ];

  async function handleSubmit() {
    if (!deadline) {
      setError(copy.bucket.validationDeadlineRequired);
      return;
    }
    if (deadline <= today) {
      setError(copy.bucket.validationDeadlineFuture);
      return;
    }

    const savingRuleType: SavingRuleType = ruleChoice;
    const savingRuleAmount = ruleChoice === 'flexible' ? null : amounts[ruleChoice];
    const ruleData: BucketCreateRuleData = {
      deadline,
      savingRuleType,
      savingRuleAmount,
      savingRuleStartAmount: null,
      savingRuleIncrement: null,
      savingRuleCap: null,
      savingRuleDayCount: null,
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
            Goal {bucketNumber} of {totalBuckets}
          </p>
          <h3 className="mt-1 break-words font-mono text-lg font-bold leading-tight text-ink">
            {bucket.name}
          </h3>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {formatMoney(saved)} saved of {formatMoney(bucket.target_amount)}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{error}</p>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h4 className="font-mono text-sm font-bold text-ink">Pick a deadline</h4>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            We pre-filled a smart date from your project timeline.
          </p>
        </div>
        <CalendarPicker value={deadline} onChange={setDeadline} minDate={addDays(today, 1)} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h4 className="font-mono text-sm font-bold text-ink">Choose a saving rule</h4>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            You can change this later from bucket settings.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {ruleOptions.map(option => {
            const selected = ruleChoice === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setRuleChoice(option.id)}
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
                    Best fit
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {ruleChoice === 'fixed_monthly' && (
        <FormField label={copy.bucket.reminderDayLabel}>
          <select
            value={reminderDay}
            onChange={(event) => setReminderDay(Number(event.target.value))}
            className="w-full rounded-xl border border-well bg-bg px-4 py-3 font-mono text-sm text-ink"
          >
            {Array.from({ length: 28 }, (_, index) => index + 1).map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </FormField>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" size="md" disabled={!onBack || submitting} onClick={onBack}>
          {copy.common.back}
        </Button>
        <Button variant="action" size="md" disabled={submitting} onClick={handleSubmit}>
          {submitting ? 'Saving...' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
