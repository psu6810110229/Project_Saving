import { useCallback, useMemo, useState } from 'react';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { IconEdit, IconPlus, IconTrash } from '../Icon/Icon';
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
}

let customIdCounter = 0;
function nextCustomId(): string {
  return `custom-${Date.now()}-${++customIdCounter}`;
}

/**
 * Digit-only money field. While focused it shows the raw digits (no commas)
 * so the caret stays put and mid-string edits/deletes work; on blur it shows
 * the comma-grouped value. This fixes the "can only delete from the end" bug
 * caused by reformatting the value on every keystroke.
 */
interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  className: string;
  placeholder?: string;
  ariaLabel?: string;
}

function MoneyInput({ value, onChange, className, placeholder, ariaLabel }: MoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');
  const display = focused ? raw : value > 0 ? value.toLocaleString('th-TH') : '';
  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={display}
      onFocus={() => {
        setRaw(value > 0 ? String(value) : '');
        setFocused(true);
      }}
      onChange={e => {
        const digits = e.target.value.replace(/[^0-9]/g, '');
        setRaw(digits);
        onChange(digits ? parseInt(digits, 10) : 0);
      }}
      onBlur={() => setFocused(false)}
    />
  );
}

export function StepExpenses({
  endDate,
  totalBudget,
  expenses,
  onTotalBudgetChange,
  onExpensesChange,
}: StepExpensesProps) {
  const { language, copy } = useI18n();
  const c = copy.createRoomWizard;

  const checkedTotal = useMemo(
    () => expenses.filter(e => e.checked).reduce((sum, e) => sum + e.targetAmount, 0),
    [expenses],
  );

  const hasChecked = expenses.some(e => e.checked);

  const handleBudgetChange = useCallback(
    (newBudget: number) => {
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
    (id: string, amount: number) => {
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

  // Names are editable for every row (suggested + custom). Editing overwrites
  // both language variants so the typed name sticks regardless of UI language.
  const updateName = useCallback(
    (id: string, name: string) => {
      onExpensesChange(
        expenses.map(e =>
          e.id === id ? { ...e, nameEn: name, nameTh: name } : e,
        ),
      );
    },
    [expenses, onExpensesChange],
  );

  const removeExpense = useCallback(
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

      {/* Budget input + running total — one compact card */}
      <div className="rounded-xl bg-surface p-3 shadow-soft">
        <label className="block">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">
            {c.totalBudgetLabel}
          </span>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-ink-muted">
              ฿
            </span>
            <MoneyInput
              value={totalBudget}
              onChange={handleBudgetChange}
              placeholder={c.totalBudgetPlaceholder}
              ariaLabel={c.totalBudgetLabel}
              className="w-full rounded-lg border border-brand-200 bg-bg py-2.5 pl-8 pr-4 font-mono text-base font-bold text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
        </label>
        <p className="mt-2 text-right font-mono text-xs font-bold text-brand-800">
          {c.runningTotal(formatCurrency(checkedTotal))}
        </p>
      </div>

      {/* Expense list */}
      <div className="space-y-2">
        {expenses.map(exp => {
          const name = language === 'th' ? exp.nameTh : exp.nameEn;
          return (
            <div
              key={exp.id}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors ${
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

              {/* Editable name with pencil hint */}
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  className="w-full rounded-md border-0 bg-transparent py-1 pr-5 font-mono text-sm font-bold text-ink outline-none placeholder:text-ink-dim"
                  value={name}
                  placeholder={c.customExpenseName}
                  onChange={e => updateName(exp.id, e.target.value)}
                />
                <IconEdit
                  size={12}
                  className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-ink-dim"
                />
              </div>

              {/* Amount input */}
              <div className="relative w-24 flex-shrink-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-ink-dim">
                  ฿
                </span>
                <MoneyInput
                  value={exp.targetAmount}
                  onChange={amount => updateAmount(exp.id, amount)}
                  placeholder="0"
                  ariaLabel={`${name} amount`}
                  className="w-full rounded-lg border border-brand-100 bg-bg py-2 pl-5 pr-2 text-right font-mono text-xs font-bold text-ink outline-none focus:border-brand-400"
                />
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeExpense(exp.id)}
                aria-label={`Remove ${name}`}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger-soft"
              >
                <IconTrash size={16} />
              </button>
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

      {/* Validation hint */}
      {!hasChecked && (
        <p className="text-center font-mono text-xs text-danger">{c.noExpensesSelected}</p>
      )}
    </div>
  );
}
