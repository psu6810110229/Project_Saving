import { useCallback, useMemo, useState } from 'react';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { ExpenseTimeline } from '../ExpenseTimeline/ExpenseTimeline';
import iconCalendar from '../../assets/icons/calendar.svg';
import iconCoins from '../../assets/icons/coins.svg';
import iconLightbulb from '../../assets/icons/lightbulb.svg';
import { useI18n } from '../../i18n/useI18n';
import { formatCurrency } from '../../lib/format';
import { calcSuggestedRule } from '../../lib/travelExpenseRules';
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

function formatDate(dateKey: string, lang: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  if (isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
    day: 'numeric',
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
      const days = daysBetween(todayBangkokKey(), exp.deadline);
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

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-mono text-2xl font-bold text-ink">{c.stepTimelineTitle}</h2>
        <p className="mt-1 font-mono text-sm text-ink-muted">{c.stepTimelineSubtitle}</p>
      </div>

      {/* Horizontal timeline visualization */}
      <div className="rounded-xl bg-surface p-4 shadow-soft">
        <ExpenseTimeline items={timelineItems} eventDate={eventDate} />
      </div>

      {/* Expense detail cards */}
      <div className="space-y-3">
        {checked.map(exp => {
          const name = language === 'th' ? exp.nameTh : exp.nameEn;
          // Suggested plan by default; the user can override via the picker.
          const suggested = calcSuggestedRule(exp.targetAmount, exp.deadline);
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

          return (
            <div key={exp.id} className="rounded-xl bg-surface p-4 shadow-soft">
              {/* Header row */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <BucketCategoryIcon category={exp.category} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm font-bold text-ink">{name}</p>
                  <p className="font-mono text-xs text-ink-muted">
                    {formatCurrency(exp.targetAmount)}
                    {paymentLabel && <span className="ml-2 text-ink-dim">· {paymentLabel}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingId(isEditing ? null : exp.id)}
                  className="rounded-pill bg-brand-50 px-3 py-1 font-mono text-xs font-bold text-brand-600 transition-colors hover:bg-brand-100"
                >
                  {isEditing ? c.doneEditingButton : c.editDeadlineButton}
                </button>
              </div>

              {/* Deadline */}
              <div className="mt-3 flex items-center gap-2">
                <img src={iconCalendar} alt="" aria-hidden className="h-4 w-4 shrink-0" />
                {isEditing ? (
                  <input
                    type="date"
                    className="rounded-md border border-brand-200 bg-bg px-2 py-1 font-mono text-xs text-ink outline-none focus:border-brand-500"
                    value={exp.deadline}
                    min={new Date().toISOString().slice(0, 10)}
                    max={eventDate}
                    onChange={e => updateDeadline(exp.id, e.target.value)}
                  />
                ) : (
                  <span className="font-mono text-xs font-bold text-ink">
                    {c.timelineDue(formatDate(exp.deadline, language))}
                  </span>
                )}
              </div>

              {/* Saving plan — suggested by default, the user can override */}
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <img src={iconCoins} alt="" aria-hidden className="h-4 w-4 shrink-0" />
                  <span className="font-mono text-xs text-ink-muted">
                    {activeRule === 'flexible'
                      ? c.flexiblePlanHint
                      : c.suggestedRule(ruleNames[activeRule] ?? activeRule, formatCurrency(activeAmount))}
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

              {/* Tip */}
              {tipText && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-brand-50/60 px-3 py-2">
                  <img src={iconLightbulb} alt="" aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="font-mono text-[11px] leading-relaxed text-brand-700">
                    {tipText}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
