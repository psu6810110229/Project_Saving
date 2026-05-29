import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Button/Button';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { ExpenseTimeline } from '../ExpenseTimeline/ExpenseTimeline';
import { useI18n } from '../../i18n/useI18n';
import { useRooms } from '../../hooks/useRooms';
import { formatCurrency } from '../../lib/format';
import { clearWizardDraft } from '../../lib/wizardDraft';
import type { ExpenseDraftItem } from './wizardTypes';
import type { ProjectCategory } from '../../types';

interface StepSummaryProps {
  name: string;
  category: ProjectCategory;
  endDate: string;
  coverImageUrl: string | null;
  totalBudget: number;
  expenses: ExpenseDraftItem[];
}

function formatDate(dateKey: string, lang: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  if (isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function StepSummary({
  name,
  category,
  endDate,
  coverImageUrl,
  totalBudget,
  expenses,
}: StepSummaryProps) {
  const navigate = useNavigate();
  const { language, copy } = useI18n();
  const c = copy.createRoomWizard;
  const categoryLabels = copy.profile.projectCategories;
  const { createRoomWithTemplates } = useRooms();

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictName, setConflictName] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const expenseTotal = useMemo(
    () => checked.reduce((sum, e) => sum + e.targetAmount, 0),
    [checked],
  );

  const handleCreate = useCallback(async (archiveExisting = false) => {
    setCreating(true);
    setError(null);

    const result = await createRoomWithTemplates({
      name,
      target_amount: totalBudget > 0 ? totalBudget : expenseTotal,
      end_date: endDate,
      category,
      cover_image_url: coverImageUrl,
      expenses: checked.map(e => ({
        category: e.category,
        nameEn: e.nameEn,
        nameTh: e.nameTh,
        targetAmount: e.targetAmount,
        deadline: e.deadline,
        priority: e.priority,
        paymentType: e.paymentType,
        tipKey: e.tipKey,
      })),
    }, { archiveExisting });

    setCreating(false);

    if (result.conflict) {
      setConflictName(result.conflict.existingName);
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }

    clearWizardDraft();
    setConflictName(null);
    setInviteCode(result.inviteCode ?? null);
  }, [name, category, endDate, coverImageUrl, totalBudget, expenseTotal, checked, createRoomWithTemplates]);

  const handleCopy = useCallback(async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [inviteCode]);

  if (inviteCode) {
    return (
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="font-mono text-2xl font-bold text-ink">{c.successTitle}</h2>
          <p className="mt-1 font-mono text-sm text-ink-muted">{c.successSubtitle}</p>
        </div>

        <div className="rounded-xl bg-surface p-5 shadow-soft">
          <p className="mb-2 text-center font-mono text-xs font-bold uppercase tracking-wider text-ink-dim">
            {c.inviteCodeLabel}
          </p>
          <p className="text-center font-mono text-3xl font-bold tracking-[0.3em] text-brand-700">
            {inviteCode}
          </p>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-pill bg-brand-50 px-5 py-2 font-mono text-sm font-bold text-brand-700 transition-colors hover:bg-brand-100"
            >
              {copied ? c.codeCopied : c.copyCodeButton}
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-brand-50/60 px-4 py-3">
          <p className="font-mono text-xs leading-relaxed text-brand-700">
            💡 {c.friendsTip}
          </p>
        </div>

        <Button variant="primary" fullWidth onClick={() => navigate('/')}>
          {c.goToDashboard}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-mono text-2xl font-bold text-ink">{c.stepSummaryTitle}</h2>
        <p className="mt-1 font-mono text-sm text-ink-muted">{c.stepSummarySubtitle}</p>
      </div>

      {/* Summary card */}
      <div className="rounded-xl bg-surface p-5 shadow-soft">
        <div className="space-y-3">
          <SummaryRow label={c.summaryProjectName} value={name} />
          <SummaryRow
            label={c.summaryCategory}
            value={categoryLabels[category] ?? category}
          />
          <SummaryRow
            label={c.summaryEventDate}
            value={formatDate(endDate, language)}
          />
          <SummaryRow
            label={c.summaryTotalBudget}
            value={formatCurrency(totalBudget > 0 ? totalBudget : expenseTotal)}
          />
        </div>
      </div>

      {/* Expense summary */}
      {checked.length > 0 && (
        <div className="rounded-xl bg-surface p-4 shadow-soft">
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-ink-dim">
            {c.summaryExpenses(checked.length)}
          </p>
          <div className="space-y-2">
            {checked.map(e => {
              const expName = language === 'th' ? e.nameTh : e.nameEn;
              return (
                <div key={e.id} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <BucketCategoryIcon category={e.category} size={16} />
                  </div>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">
                    {expName}
                  </span>
                  <span className="flex-shrink-0 font-mono text-sm font-bold text-ink">
                    {formatCurrency(e.targetAmount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline preview */}
      {timelineItems.length > 0 && (
        <div className="rounded-xl bg-surface p-4 shadow-soft">
          <ExpenseTimeline items={timelineItems} eventDate={endDate} />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-danger-soft px-4 py-2 font-mono text-sm text-danger">
          {error}
        </p>
      )}

      {conflictName ? (
        <div className="flex flex-col gap-3 rounded-xl bg-brand-50 p-4">
          <p className="font-mono-th text-sm leading-relaxed text-brand-800">
            {c.conflictMessage(conflictName)}
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" size="lg" onClick={() => setConflictName(null)} disabled={creating}>
              {copy.common.cancel}
            </Button>
            <Button
              variant="action"
              fullWidth
              onClick={() => void handleCreate(true)}
              disabled={creating}
            >
              {creating ? c.creatingProject : c.conflictArchiveButton}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="action"
          fullWidth
          onClick={() => void handleCreate()}
          disabled={creating}
        >
          {creating ? c.creatingProject : c.createProjectButton}
        </Button>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-sm text-ink-muted">{label}</span>
      <span className="font-mono text-sm font-bold text-ink">{value}</span>
    </div>
  );
}
