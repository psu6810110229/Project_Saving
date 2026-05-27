import { useCallback, useMemo, useRef } from 'react';
import { Button } from '../Button/Button';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { IconArrowLeft, IconPlus } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { formatCurrency } from '../../lib/format';
import { suggestExpenses } from '../../lib/travelExpenseRules';
import type { ExpenseDraftItem } from './wizardTypes';

interface StepExpensesProps {
  endDate: string;
  totalBudget: number;
  expenses: ExpenseDraftItem[];
  onTotalBudgetChange: (value: number) => void;
  onExpensesChange: (expenses: ExpenseDraftItem[]) => void;
  onNext: () => void;
  onBack: () => void;
}

function parseBudgetInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

function formatBudgetDisplay(value: number): string {
  if (value === 0) return '';
  return value.toLocaleString('th-TH');
}

let customIdCounter = 0;
function nextCustomId(): string {
  return `custom-${Date.now()}-${++customIdCounter}`;
}

export function StepExpenses({
  endDate,
  totalBudget,
  expenses,
  onTotalBudgetChange,
  onExpensesChange,
  onNext,
  onBack,
}: StepExpensesProps) {
  const { language, copy } = useI18n();
  const c = copy.createRoomWizard;
  const budgetInputRef = useRef<HTMLInputElement>(null);

  const checkedTotal = useMemo(
    () => expenses.filter(e => e.checked).reduce((sum, e) => sum + e.targetAmount, 0),
    [expenses],
  );

  const hasChecked = expenses.some(e => e.checked);

  const handleBudgetChange = useCallback(
    (raw: string) => {
      const newBudget = parseBudgetInput(raw);
      onTotalBudgetChange(newBudget);
      if (newBudget > 0 && endDate) {
        const suggested = suggestExpenses(newBudget, endDate);
        const updated = expenses.map(exp => {
          if (exp.isCustom) return exp;
          const match = suggested.find(s => s.category === exp.category);
          if (!match) return exp;
          return { ...exp, targetAmount: match.targetAmount, deadline: match.deadline };
        });
        onExpensesChange(updated);
      }
    },
    [endDate, expenses, onExpensesChange, onTotalBudgetChange],
  );

  const toggleExpense = useCallback(
    (id: string) => {
      onExpensesChange(
        expenses.map(e => (e.id === id ? { ...e, checked: !e.checked } : e)),
      );
    },
    [expenses, onExpensesChange],
  );

  const updateAmount = useCallback(
    (id: string, raw: string) => {
      const amount = parseBudgetInput(raw);
      onExpensesChange(
        expenses.map(e => (e.id === id ? { ...e, targetAmount: amount } : e)),
      );
    },
    [expenses, onExpensesChange],
  );

  const addCustomExpense = useCallback(() => {
    const custom: ExpenseDraftItem = {
      id: nextCustomId(),
      category: 'other',
      nameEn: c.customExpenseName,
      nameTh: c.customExpenseNameTh,
      targetAmount: 0,
      deadline: endDate,
      checked: true,
      isCustom: true,
      tipKey: null,
      priority: 99,
    };
    onExpensesChange([...expenses, custom]);
  }, [c, endDate, expenses, onExpensesChange]);

  const updateCustomName = useCallback(
    (id: string, name: string) => {
      onExpensesChange(
        expenses.map(e =>
          e.id === id ? { ...e, nameEn: name, nameTh: name } : e,
        ),
      );
    },
    [expenses, onExpensesChange],
  );

  const removeCustom = useCallback(
    (id: string) => {
      onExpensesChange(expenses.filter(e => e.id !== id));
    },
    [expenses, onExpensesChange],
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-mono text-2xl font-bold text-ink">{c.stepExpensesTitle}</h2>
        <p className="mt-1 font-mono text-sm text-ink-muted">{c.stepExpensesSubtitle}</p>
      </div>

      {/* Budget input */}
      <div className="rounded-xl bg-surface p-4 shadow-soft">
        <label className="block">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">
            {c.totalBudgetLabel}
          </span>
          <div className="relative mt-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-ink-muted">
              ฿
            </span>
            <input
              ref={budgetInputRef}
              type="text"
              inputMode="numeric"
              className="w-full rounded-lg border border-brand-200 bg-bg py-3 pl-8 pr-4 font-mono text-base font-bold text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              value={formatBudgetDisplay(totalBudget)}
              placeholder={c.totalBudgetPlaceholder}
              onChange={e => handleBudgetChange(e.target.value)}
            />
          </div>
        </label>
      </div>

      {/* Expense list */}
      <div className="space-y-2">
        {expenses.map(exp => {
          const name = language === 'th' ? exp.nameTh : exp.nameEn;
          return (
            <div
              key={exp.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
                exp.checked ? 'bg-surface shadow-soft' : 'bg-surfaceAlt opacity-60'
              }`}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => toggleExpense(exp.id)}
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                  exp.checked
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-ink-dim bg-transparent'
                }`}
                aria-label={`Toggle ${name}`}
              >
                {exp.checked && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* Icon */}
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <BucketCategoryIcon category={exp.category} size={18} />
              </div>

              {/* Name (editable for custom) */}
              {exp.isCustom ? (
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <input
                    type="text"
                    className="w-full rounded-md border-0 bg-transparent font-mono text-sm font-bold text-ink outline-none placeholder:text-ink-dim"
                    value={name}
                    placeholder={c.customExpenseName}
                    onChange={e => updateCustomName(exp.id, e.target.value)}
                  />
                  <button
                    type="button"
                    className="self-start font-mono text-[10px] text-danger"
                    onClick={() => removeCustom(exp.id)}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-ink">
                  {name}
                </span>
              )}

              {/* Amount input */}
              <div className="relative w-24 flex-shrink-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-ink-dim">
                  ฿
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-brand-100 bg-bg py-2 pl-5 pr-2 text-right font-mono text-xs font-bold text-ink outline-none focus:border-brand-400"
                  value={exp.targetAmount > 0 ? exp.targetAmount.toLocaleString('th-TH') : ''}
                  placeholder="0"
                  onChange={e => updateAmount(exp.id, e.target.value)}
                />
              </div>
            </div>
          );
        })}

        {/* Add custom expense */}
        <button
          type="button"
          onClick={addCustomExpense}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 py-3 font-mono text-sm font-bold text-brand-500 transition-colors hover:border-brand-400 hover:text-brand-700"
        >
          <IconPlus size={16} />
          {c.addCustomExpense}
        </button>
      </div>

      {/* Running total */}
      <div className="rounded-xl bg-brand-50 px-4 py-3 text-center">
        <p className="font-mono text-sm font-bold text-brand-800">
          {c.runningTotal(formatCurrency(checkedTotal))}
        </p>
      </div>

      {/* Validation hint */}
      {!hasChecked && (
        <p className="text-center font-mono text-xs text-danger">{c.noExpensesSelected}</p>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Button variant="ghost" size="lg" onClick={onBack}>
          <IconArrowLeft size={16} />
        </Button>
        <Button variant="primary" fullWidth disabled={!hasChecked} onClick={onNext}>
          {c.nextButton}
        </Button>
      </div>
    </div>
  );
}
