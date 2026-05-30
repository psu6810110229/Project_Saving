import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MOTION_DURATION, MOTION_EASE } from '../../lib/motion';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { ExpenseTimeline } from '../ExpenseTimeline/ExpenseTimeline';
import { IconChevronDown } from '../Icon/Icon';
import iconCalendar from '../../assets/icons/calendar.svg';
import iconCoins from '../../assets/icons/coins.svg';
import iconLightbulb from '../../assets/icons/lightbulb.svg';
import { useI18n } from '../../i18n/useI18n';
import { formatCurrency } from '../../lib/format';
import { DAILY_RATE_CAP, calcSuggestedRule } from '../../lib/travelExpenseRules';
import { calcRuleAmount } from '../../lib/bucketRuleSuggest';
import { daysBetween, todayBangkokKey } from '../../lib/savingPlan';
import { classifyExpenseName, GENERIC_SUGGESTION } from '../../lib/expenseNameClassifier';
import { expenseTips } from '../../i18n/expenseTips';
import type { ExpenseDraftItem } from './wizardTypes';
import type { SavingRuleType } from '../../types';

// Saving-plan options offered per bucket on step 4 (decision: no increasing
// rules in the setup wizard). The first matching option is the suggestion.
const RULE_CHOICES = ['fixed_daily', 'fixed_weekly', 'fixed_monthly', 'flexible'] as const;
type WizardRuleChoice = (typeof RULE_CHOICES)[number];

interface StepTimelineProps {
  eventDate: string;
  expenses: ExpenseDraftItem[];
  onExpensesChange: (expenses: ExpenseDraftItem[]) => void;
}

// Compact form for the quiet collapsed meta line, e.g. "Aug 2027".
function formatMonthYear(dateKey: string, lang: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  if (isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
    month: 'short',
    year: 'numeric',
  });
}

export function StepTimeline({
  eventDate,
  expenses,
  onExpensesChange,
}: StepTimelineProps) {
  const { language, copy } = useI18n();
  const c = copy.createRoomWizard;
  const ruleNames = copy.bucket.ruleNames;
  const reduceMotion = useReducedMotion();

  const [editingId, setEditingId] = useState<string | null>(null);

  const checked = useMemo(
    () =>
      expenses
        .filter(e => e.checked)
        .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.priority - b.priority),
    [expenses],
  );

  const timelineItems = useMemo(
    () =>
      checked.map(e => ({
        id: e.id,
        category: e.category,
        nameEn: e.nameEn,
        nameTh: e.nameTh,
        deadline: e.deadline,
        targetAmount: e.targetAmount,
      })),
    [checked],
  );

  const updateDeadline = useCallback(
    (id: string, deadline: string) => {
      onExpensesChange(
        expenses.map(e => (e.id === id ? { ...e, deadline } : e)),
      );
    },
    [expenses, onExpensesChange],
  );

  const updateRule = useCallback(
    (id: string, type: SavingRuleType, amount: number | null) => {
      onExpensesChange(
        expenses.map(e =>
          e.id === id ? { ...e, savingRuleType: type, savingRuleAmount: amount } : e,
        ),
      );
    },
    [expenses, onExpensesChange],
  );

  const applyRule = useCallback(
    (exp: ExpenseDraftItem, choice: WizardRuleChoice) => {
      if (choice === 'flexible') {
        updateRule(exp.id, 'flexible', null);
        return;
      }
      // Rate is computed over this bucket's own saving window (start → deadline),
      // not today → deadline, so queued buckets aren't understated.
      const from = exp.savingWindowStart ?? todayBangkokKey();
      const days = daysBetween(from, exp.deadline);
      updateRule(exp.id, choice, calcRuleAmount(exp.targetAmount, days, choice));
    },
    [updateRule],
  );

  if (checked.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="font-mono text-2xl font-bold text-ink">{c.stepTimelineTitle}</h2>
          <p className="mt-1 font-mono text-sm text-ink-muted">{c.stepTimelineSubtitle}</p>
        </div>
        <div className="flex min-h-[200px] items-center justify-center rounded-xl bg-surface p-8 shadow-soft">
          <p className="font-mono text-sm text-ink-dim">{c.noExpensesForTimeline}</p>
        </div>
      </div>
    );
  }

  // Affordability guardrail: if even spreading the whole goal across the runway
  // needs more than the daily cap, the goal is too big for the time given.
  const totalChecked = checked.reduce((sum, e) => sum + e.targetAmount, 0);
  const daysToEvent = Math.max(1, daysBetween(todayBangkokKey(), eventDate));
  const paceTooTight = totalChecked / daysToEvent > DAILY_RATE_CAP;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-mono text-2xl font-bold text-ink">{c.stepTimelineTitle}</h2>
        <p className="mt-1 font-mono text-sm text-ink-muted">{c.stepTimelineSubtitle}</p>
      </div>

      {paceTooTight && (
        <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs leading-relaxed text-danger">
          {c.paceTooTight}
        </p>
      )}

      {/* Horizontal timeline visualization */}
      <div className="rounded-xl bg-surface p-4 shadow-soft">
        <ExpenseTimeline items={timelineItems} eventDate={eventDate} />
      </div>

      {/* Expense detail cards */}
      <div className="space-y-3">
        {checked.map(exp => {
          const name = language === 'th' ? exp.nameTh : exp.nameEn;
          const windowStart = exp.savingWindowStart ?? todayBangkokKey();
          // Suggested plan by default; the user can override via the picker.
          // Rate spans this bucket's own saving window (start → deadline).
          const suggested = calcSuggestedRule(exp.targetAmount, exp.deadline, windowStart);
          const overrideRule = exp.savingRuleType ?? null;
          const activeRule = overrideRule ?? suggested.ruleType;
          const activeAmount =
            activeRule === 'flexible'
              ? 0
              : overrideRule != null
                ? exp.savingRuleAmount ?? 0
                : suggested.amount;
          // Suggestion sentence: classify by the bucket NAME first (Thai-aware,
          // budget-refined for generic "ค่าเดินทาง"), then fall back to the
          // category tip, then a generic line — so every row shows advice.
          const fallbackTip = exp.tipKey ? expenseTips[exp.tipKey] : null;
          const suggestion =
            classifyExpenseName(`${exp.nameEn} ${exp.nameTh}`, exp.targetAmount)
            ?? fallbackTip
            ?? GENERIC_SUGGESTION;
          const tipText = language === 'th' ? suggestion.th : suggestion.en;
          const paymentLabel = c.paymentTypes[exp.paymentType ?? 'flexible'] ?? '';
          const isEditing = editingId === exp.id;

          // Plan amount shown as a saving rate (e.g. "฿2,400/mo") so it can't be
          // mistaken for the bucket goal rendered in the header.
          const rateAmount =
            activeRule === 'flexible'
              ? formatCurrency(activeAmount)
              : `${formatCurrency(activeAmount)}${c.planPeriodSuffix[activeRule] ?? ''}`;

          // Compact plan summary for the quiet collapsed meta line.
          const planSummary =
            activeRule === 'flexible'
              ? ruleNames.flexible ?? c.flexiblePlanHint
              : `${ruleNames[activeRule] ?? activeRule} · ${rateAmount}`;

          return (
            <div key={exp.id} className="rounded-xl bg-surface p-4 shadow-soft">
              {/* Header row — amount (top-left) · icon · name · expand toggle */}
              <div className="flex items-center gap-3">
                <p className="flex-shrink-0 font-mono text-sm font-bold text-ink">{formatCurrency(exp.targetAmount)}</p>
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <BucketCategoryIcon category={exp.category} size={16} />
                </div>
                <p className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-ink">{name}</p>
                <button
                  type="button"
                  onClick={() => setEditingId(isEditing ? null : exp.id)}
                  aria-expanded={isEditing}
                  aria-label={isEditing ? c.doneEditingButton : c.adjustPlanButton}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-colors hover:bg-brand-100"
                >
                  <motion.span
                    className="flex items-center justify-center"
                    animate={{ rotate: isEditing ? 180 : 0 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 500, damping: 18 }
                    }
                  >
                    <IconChevronDown size={16} />
                  </motion.span>
                </button>
              </div>

              {/* Collapsed: one quiet meta line. */}
              {!isEditing && (
                <p className="mt-2 truncate font-mono text-xs text-ink-muted">
                  {c.timelineWindow(formatMonthYear(windowStart, language), formatMonthYear(exp.deadline, language))} · {planSummary}
                </p>
              )}

              {/* Expanded controls — smooth height reveal with a micro bounce. */}
              <AnimatePresence initial={false}>
                {isEditing && (
                  <motion.div
                    key="adjust"
                    className="overflow-hidden"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : {
                            // Height is a layout property — springing it reflows the
                            // whole list every frame and overshoots, which drops FPS.
                            // A short emphasized tween settles fast with no overshoot;
                            // the bouncy feel comes from the (cheap) chevron transform.
                            height: { duration: 0.26, ease: MOTION_EASE.emphasized },
                            opacity: { duration: MOTION_DURATION.fade },
                          }
                    }
                  >
                    <div className="mt-3 flex flex-col gap-3">
                      {/* Deadline */}
                      <div className="flex items-center gap-2">
                        <img src={iconCalendar} alt="" aria-hidden className="h-4 w-4 shrink-0" />
                        <span className="font-mono text-xs text-ink-muted">{c.deadlineLabel}</span>
                        <input
                          type="date"
                          className="rounded-md border border-brand-200 bg-bg px-2 py-1 font-mono text-xs text-ink outline-none focus:border-brand-500"
                          value={exp.deadline}
                          min={new Date().toISOString().slice(0, 10)}
                          max={eventDate}
                          onChange={e => updateDeadline(exp.id, e.target.value)}
                        />
                      </div>

                      {/* Saving plan — suggested by default, the user can override */}
                      <div>
                        <div className="flex items-center gap-2">
                          <img src={iconCoins} alt="" aria-hidden className="h-4 w-4 shrink-0" />
                          <span className="font-mono text-xs text-ink-muted">
                            {activeRule === 'flexible'
                              ? c.flexiblePlanHint
                              : c.suggestedRule(ruleNames[activeRule] ?? activeRule, rateAmount)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {RULE_CHOICES.map(choice => {
                            const active = choice === activeRule;
                            return (
                              <button
                                key={choice}
                                type="button"
                                onClick={() => applyRule(exp, choice)}
                                aria-pressed={active}
                                className={`rounded-pill px-3 py-1 font-mono text-[11px] font-bold transition-colors ${
                                  active
                                    ? 'bg-brand-500 text-ink-inverse shadow-soft'
                                    : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                                }`}
                              >
                                {ruleNames[choice] ?? choice}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Payment + tip surface only while adjusting */}
                      {paymentLabel && (
                        <p className="font-mono text-[11px] text-ink-dim">{paymentLabel}</p>
                      )}
                      {tipText && (
                        <div className="flex items-start gap-2">
                          <img src={iconLightbulb} alt="" aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                          <p className="font-mono text-[11px] leading-relaxed text-brand-700">{tipText}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
