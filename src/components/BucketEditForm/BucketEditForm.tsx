import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Bucket, BucketTransfer, SavingRuleType, SavingsLog } from '../../types';
import { addDays, daysBetween, daysInclusive, todayBangkokKey } from '../../lib/savingPlan';
import {
  type RuleChoice,
  calcDefaultDeadline,
  calcRuleAmount,
  initialRuleChoice,
  recommendedRule,
} from '../../lib/bucketRuleSuggest';
import { bucketSaved, hasDuplicateBucketName, sumTargets } from '../../lib/buckets';
import { Button, MODAL_ACTION_ROW_REVERSE_CLASS, MODAL_SECONDARY_BUTTON_CLASS } from '../Button/Button';
import { CalendarPicker } from '../CalendarPicker/CalendarPicker';
import { FormField } from '../FormField/FormField';
import { IconCheck, IconEdit, IconPiggyBank, IconX } from '../Icon/Icon';
import { ReminderDayPicker } from '../ReminderDayPicker/ReminderDayPicker';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';

export interface BucketEditValues {
  name: string;
  target_amount: number;
  deadline: string | null;
  saving_rule_type: SavingRuleType | null;
  saving_rule_amount: number | null;
  saving_rule_start_amount: number | null;
  saving_rule_increment: number | null;
  saving_rule_cap: number | null;
  saving_rule_day_count: number | null;
  saving_rule_start_date: string | null;
  reminder_day: number | null;
}

export interface BucketEditFormResult {
  error?: string;
  code?: string;
  duplicateName?: string;
  deadlineExtensionWarning?: boolean;
}

interface BucketEditFormProps {
  bucket: Bucket;
  /** All of the caller's active buckets, for duplicate-name and capacity checks. */
  buckets: Bucket[];
  logs: SavingsLog[];
  transfers?: BucketTransfer[];
  goalTarget?: number | null;
  roomEndDate?: string | null;
  /** Smoothly scroll the expanding rule section (monthly reminder / custom) into view on change. */
  autoScrollOnExpand?: boolean;
  onCancel: () => void;
  onSave: (bucket: Bucket, next: BucketEditValues) => Promise<BucketEditFormResult>;
  /** Called after a successful save so the parent can close / exit edit mode. */
  onSaved?: (result: BucketEditFormResult) => void;
}

export function BucketEditForm({
  bucket,
  buckets,
  logs,
  transfers,
  goalTarget,
  roomEndDate,
  autoScrollOnExpand = false,
  onCancel,
  onSave,
  onSaved,
}: BucketEditFormProps) {
  const { copy, formatMoney, formatShortDateKey } = useI18n();
  const today = todayBangkokKey();

  const [draftName, setDraftName] = useState(bucket.name);
  const [draftTarget, setDraftTarget] = useState(String(bucket.target_amount));
  const [deadline, setDeadline] = useState(() => bucket.deadline?.slice(0, 10) ?? calcDefaultDeadline(bucket, roomEndDate ?? null, today));
  // Custom (increasing-daily) plans can pick their own start date; falls back to today.
  const [startDate, setStartDate] = useState(() => bucket.saving_rule_start_date?.slice(0, 10) ?? today);
  const remainingDays = deadline ? Math.max(1, daysBetween(today, deadline)) : 1;
  const [ruleChoice, setRuleChoice] = useState<RuleChoice>(() => initialRuleChoice(bucket.saving_rule_type, remainingDays));
  const [reminderDay, setReminderDay] = useState(bucket.reminder_day ?? 25);
  const [customStart, setCustomStart] = useState(() => (bucket.saving_rule_start_amount ? String(Math.round(bucket.saving_rule_start_amount)) : ''));
  const [customIncrement, setCustomIncrement] = useState(() => (bucket.saving_rule_increment ? String(Math.round(bucket.saving_rule_increment)) : ''));
  const [customCap, setCustomCap] = useState(() => (bucket.saving_rule_cap ? String(Math.round(bucket.saving_rule_cap)) : ''));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const ruleSectionRef = useRef<HTMLDivElement | null>(null);
  const reminderDayRef = useRef<HTMLDivElement | null>(null);
  const customRuleRef = useRef<HTMLDivElement | null>(null);

  // Reveal the section a mode opens (or return to the rule cards when it
  // collapses). Only the exact-bucket edit opts in via autoScrollOnExpand.
  useEffect(() => {
    if (!autoScrollOnExpand) return;
    const timeoutId = window.setTimeout(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
      const target = ruleChoice === 'fixed_monthly'
        ? reminderDayRef.current
        : ruleChoice === 'custom'
          ? customRuleRef.current
          : ruleSectionRef.current;
      target?.scrollIntoView({ behavior, block: 'nearest' });
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [ruleChoice, autoScrollOnExpand]);

  const targetAmount = Number(draftTarget);
  const saved = bucketSaved(bucket.id, logs, transfers);
  const totalBucketTargets = sumTargets(buckets);
  const capacityForEdit = typeof goalTarget === 'number'
    ? goalTarget - (totalBucketTargets - bucket.target_amount)
    : null;

  const remainingTarget = Math.max(0, (Number.isFinite(targetAmount) ? targetAmount : bucket.target_amount) - saved);
  const amounts = useMemo(() => ({
    fixed_daily: calcRuleAmount(remainingTarget, remainingDays, 'fixed_daily'),
    fixed_weekly: calcRuleAmount(remainingTarget, remainingDays, 'fixed_weekly'),
    fixed_monthly: calcRuleAmount(remainingTarget, remainingDays, 'fixed_monthly'),
  }), [remainingTarget, remainingDays]);
  const recommended = recommendedRule(remainingDays);

  // Per-day preview for the custom (increasing-daily) range calendar. Day 1 is
  // the chosen start date, matching how the bucket actually charges each day.
  const getCustomAmountForDate = useMemo<((dateKey: string) => number | undefined) | undefined>(() => {
    if (ruleChoice !== 'custom') return undefined;
    const startNum = Number(customStart);
    const incNum = Number(customIncrement || '0');
    const capNum = Number(customCap || '0');
    if (!Number.isFinite(startNum) || startNum <= 0) return undefined;
    return (dateKey: string) => {
      if (!startDate || dateKey < startDate) return undefined;
      if (deadline && dateKey > deadline) return undefined;
      const idx = daysBetween(startDate, dateKey); // 0-based: start day → start amount
      const raw = startNum + idx * incNum;
      return capNum > 0 ? Math.min(raw, capNum) : raw;
    };
  }, [ruleChoice, customStart, customIncrement, customCap, startDate, deadline]);

  // Summary card for the custom plan: finish date, length, cap, and the
  // expected total across the whole start→end range.
  const customPreview = useMemo(() => {
    if (ruleChoice !== 'custom') return null;
    const startNum = Number(customStart);
    const incNum = Number(customIncrement || '0');
    const capNum = Number(customCap || '0');
    if (!Number.isFinite(startNum) || startNum <= 0) return null;
    if (!startDate || !deadline || deadline <= startDate) return null;
    const days = daysInclusive(startDate, deadline);
    if (days <= 0) return null;
    let total = 0;
    for (let idx = 0; idx < days; idx++) {
      const raw = startNum + idx * incNum;
      total += capNum > 0 ? Math.min(raw, capNum) : raw;
    }
    return { finishDateKey: deadline, days, cap: capNum > 0 ? capNum : null, total };
  }, [ruleChoice, customStart, customIncrement, customCap, startDate, deadline]);

  const ruleOptions: Array<{ id: RuleChoice; label: string }> = [
    { id: 'fixed_daily', label: copy.bucket.rulePerDay(formatMoney(amounts.fixed_daily)) },
    { id: 'fixed_weekly', label: copy.bucket.rulePerWeek(formatMoney(amounts.fixed_weekly)) },
    { id: 'fixed_monthly', label: copy.bucket.rulePerMonth(formatMoney(amounts.fixed_monthly)) },
    { id: 'flexible', label: copy.bucket.ruleFlexible },
    { id: 'custom', label: copy.bucket.ruleCustom },
  ];

  async function handleSave() {
    if (!draftName.trim()) {
      setError(copy.bucket.validationNameBeforeSaving);
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError(copy.bucket.validationTargetAboveZero);
      return;
    }
    if (hasDuplicateBucketName(buckets, draftName, bucket.id)) {
      setError(copy.bucket.duplicateName(draftName.trim()));
      return;
    }
    if (capacityForEdit !== null && targetAmount > capacityForEdit) {
      setError(copy.bucket.capacityErrorForEdit(formatMoney(Math.max(0, capacityForEdit))));
      return;
    }
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
    let savingRuleStartDate: string | null = null;

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
      if (!startDate) {
        setError(copy.bucket.validationCustomStartDate);
        return;
      }
      if (deadline <= startDate) {
        setError(copy.bucket.validationCustomRange);
        return;
      }
      savingRuleType = cap > 0 ? 'increasing_daily_capped' : 'increasing_daily';
      savingRuleStartAmount = start;
      savingRuleIncrement = increment;
      savingRuleCap = cap > 0 ? cap : null;
      savingRuleStartDate = startDate;
      savingRuleDayCount = Math.max(1, daysBetween(startDate, deadline));
    }

    const next: BucketEditValues = {
      name: draftName.trim(),
      target_amount: targetAmount,
      deadline,
      saving_rule_type: savingRuleType,
      saving_rule_amount: savingRuleAmount,
      saving_rule_start_amount: savingRuleStartAmount,
      saving_rule_increment: savingRuleIncrement,
      saving_rule_cap: savingRuleCap,
      saving_rule_day_count: savingRuleDayCount,
      saving_rule_start_date: savingRuleStartDate,
      reminder_day: ruleChoice === 'fixed_monthly' ? reminderDay : null,
    };

    setSubmitting(true);
    setError(null);
    const result = await onSave(bucket, next);
    setSubmitting(false);

    if (result.error) {
      setError(result.code === 'duplicate_name'
        ? copy.bucket.duplicateName(result.duplicateName ?? draftName.trim())
        : result.error);
      return;
    }
    onSaved?.(result);
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{error}</p>
      )}

      <FormField label={copy.bucket.editNameLabel}>
        <TextInput
          value={draftName}
          leadingIcon={<IconEdit size={16} />}
          onChange={(event: ChangeEvent<HTMLInputElement>) => { setDraftName(event.target.value); setError(null); }}
        />
      </FormField>

      <FormField
        label={copy.bucket.editTargetLabel}
        helper={capacityForEdit !== null ? copy.bucket.capacityAvailable(formatMoney(Math.max(0, capacityForEdit))) : undefined}
      >
        <TextInput
          value={draftTarget}
          inputMode="numeric"
          leadingIcon={<IconPiggyBank size={16} />}
          onChange={(event: ChangeEvent<HTMLInputElement>) => { setDraftTarget(event.target.value.replace(/[^0-9]/g, '')); setError(null); }}
        />
      </FormField>

      {ruleChoice !== 'custom' && (
        <FormField label={copy.bucket.editDeadlineLabel}>
          <CalendarPicker value={deadline} onChange={value => { setDeadline(value); setError(null); }} minDate={addDays(today, 1)} />
        </FormField>
      )}

      <FormField label={copy.bucket.editRuleLabel}>
        <div ref={ruleSectionRef} className="flex scroll-mt-4 flex-col gap-2">
          {ruleOptions.map(option => {
            const selected = ruleChoice === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => { setRuleChoice(option.id); setError(null); }}
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
                <span className="min-w-0 flex-1 font-mono text-sm font-bold text-ink">{option.label}</span>
                {option.id === recommended && (
                  <span className="shrink-0 rounded-pill bg-brand-500 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-inverse">
                    {copy.bucket.ruleRecommended}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </FormField>

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
              onChange={(event: ChangeEvent<HTMLInputElement>) => { setCustomStart(event.target.value.replace(/[^0-9]/g, '')); setError(null); }}
            />
          </FormField>
          <FormField label={copy.bucket.customDailyIncrease}>
            <TextInput
              value={customIncrement}
              inputMode="numeric"
              placeholder="5"
              onChange={(event: ChangeEvent<HTMLInputElement>) => { setCustomIncrement(event.target.value.replace(/[^0-9]/g, '')); setError(null); }}
            />
          </FormField>
          <FormField label={copy.bucket.customCap}>
            <TextInput
              value={customCap}
              inputMode="numeric"
              placeholder="200"
              onChange={(event: ChangeEvent<HTMLInputElement>) => { setCustomCap(event.target.value.replace(/[^0-9]/g, '')); setError(null); }}
            />
          </FormField>
          <FormField label={copy.bucket.editPlanRangeLabel}>
            <CalendarPicker
              mode="range"
              rangeStart={startDate}
              rangeEnd={deadline}
              onRangeChange={(start, end) => { setStartDate(start); setDeadline(end); setError(null); }}
              minDate={today}
              getAmountForDate={getCustomAmountForDate}
            />
          </FormField>

          {customPreview && (
            <section className="rounded-xl bg-surface p-4 shadow-soft">
              <p className="font-mono text-base font-bold uppercase tracking-[0.18em] text-brand-800">
                {copy.savingPlan.previewLabel}
              </p>
              <dl className="mt-2 divide-y divide-well font-mono text-xs">
                <PreviewRow label={copy.savingPlan.estimatedFinish} value={formatShortDateKey(customPreview.finishDateKey)} />
                <PreviewRow label={copy.savingPlan.savingDays} value={copy.savingPlan.savingDaysValue(customPreview.days)} />
                {customPreview.cap != null && (
                  <PreviewRow label={copy.savingPlan.dailyCap} value={formatMoney(Math.round(customPreview.cap))} />
                )}
                <PreviewRow label={copy.savingPlan.expectedTotal} value={formatMoney(Math.round(customPreview.total))} />
              </dl>
            </section>
          )}
        </div>
      )}

      <div className={MODAL_ACTION_ROW_REVERSE_CLASS}>
        <Button
          type="button"
          variant="primary"
          size="md"
          leadingIcon={<IconCheck size={16} />}
          onClick={handleSave}
          disabled={submitting}
        >
          {copy.bucket.editSave}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          className={MODAL_SECONDARY_BUTTON_CLASS}
          leadingIcon={<IconX size={16} />}
          onClick={onCancel}
          disabled={submitting}
        >
          {copy.bucket.editCancel}
        </Button>
      </div>
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
