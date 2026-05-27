import { memo, useMemo } from 'react';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { IconArrowRight, IconCalendar } from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { Skeleton } from '../Skeleton/Skeleton';
import { useI18n } from '../../i18n/useI18n';
import type { ExpenseTemplate } from '../../types';

interface MiniTimelineProps {
  templates: ExpenseTemplate[];
  todayDateKey: string;
  loading?: boolean;
  onOpenTimeline: () => void;
  compact?: boolean;
}

const MAX_VISIBLE_ITEMS = 5;

export const MiniTimeline = memo(function MiniTimeline({
  templates,
  todayDateKey,
  loading = false,
  onOpenTimeline,
  compact = false,
}: MiniTimelineProps) {
  const { copy, language } = useI18n();
  const d = copy.dashboard;
  const categoryLabels = copy.bucket.categoryLabels;

  const sorted = useMemo(
    () => [...templates].sort((a, b) => (
      a.deadline.localeCompare(b.deadline)
      || a.priority - b.priority
      || a.name.localeCompare(b.name)
    )),
    [templates],
  );

  const nextIndex = sorted.findIndex(item => item.deadline >= todayDateKey);
  const highlightedIndex = nextIndex >= 0 ? nextIndex : sorted.length - 1;
  const visibleStart = Math.max(
    0,
    Math.min(
      highlightedIndex - 1,
      Math.max(0, sorted.length - MAX_VISIBLE_ITEMS),
    ),
  );
  const visible = sorted.slice(visibleStart, visibleStart + MAX_VISIBLE_ITEMS);

  if (loading) {
    if (compact) {
      return (
        <section className="rounded-lg bg-surfaceAlt px-4 py-2.5">
          <Skeleton className="h-6 w-full max-w-[12rem] rounded-md" />
        </section>
      );
    }
    return (
      <section className="rounded-xl bg-surface p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-20 rounded-pill" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 flex-1 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (visible.length === 0) return null;

  const highlighted = sorted[highlightedIndex] ?? visible[0];
  const highlightedDate = formatFullDate(highlighted.deadline, language);

  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpenTimeline}
        className="group w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 bg-surface shadow-sm border border-well hover:border-brand-200"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-well text-ink-muted group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
          <BucketCategoryIcon category={highlighted.category} size={14} />
        </span>
        <p className="min-w-0 flex-1 truncate font-mono text-xs text-ink">
          <span className="text-ink-muted">{copy.common.next}:</span> <span className="font-bold text-sm ml-1">{highlighted.name}</span>
          <span className="mx-1.5 text-ink-muted">·</span>
          <span className="text-ink-muted">{highlightedDate}</span>
        </p>
        <span className="shrink-0 text-ink-dim group-hover:text-ink transition-colors">
          <IconArrowRight size={14} />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenTimeline}
      aria-label={d.timelineOpenAria}
      className="group w-full rounded-xl bg-surface p-4 text-left shadow-soft transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionLabel tone="muted">{d.timelineLabel}</SectionLabel>
          <h2 className="mt-1 font-mono text-lg font-bold leading-tight text-ink">
            {d.timelineTitle}
          </h2>
        </div>
        <span className="inline-flex max-w-[10rem] shrink-0 items-center gap-1.5 rounded-pill bg-brand-50 px-3 py-1.5 font-mono text-[11px] font-bold text-brand-800">
          <IconCalendar size={13} />
          <span className="truncate">{d.timelineNextDue(highlightedDate)}</span>
        </span>
      </div>

      <div className="mt-4 flex min-w-0 items-start overflow-x-auto pb-1">
        {visibleStart > 0 && (
          <span className="mr-2 mt-3 font-mono text-xs font-bold text-ink-dim">...</span>
        )}
        {visible.map((item, index) => {
          const absoluteIndex = visibleStart + index;
          const isHighlighted = absoluteIndex === highlightedIndex;
          const categoryLabel = categoryLabels[item.category];
          return (
            <div key={item.id} className="flex min-w-0 items-start">
              <div className="flex w-[4.75rem] shrink-0 flex-col items-center">
                <span
                  className={
                    'grid h-10 w-10 place-items-center rounded-full border transition-colors '
                    + (isHighlighted
                      ? 'border-brand-300 bg-brand-500 text-ink-inverse shadow-haloOrange'
                      : 'border-white/70 bg-well text-ink-muted')
                  }
                  title={categoryLabel}
                >
                  <BucketCategoryIcon category={item.category} size={18} />
                </span>
                <span className="mt-1 block w-full truncate text-center font-mono text-[10px] font-bold text-ink">
                  {item.name}
                </span>
                <span
                  className={
                    'mt-0.5 font-mono text-[10px] '
                    + (isHighlighted ? 'font-bold text-brand-700' : 'text-ink-dim')
                  }
                >
                  {formatMonthDate(item.deadline, language)}
                </span>
                {isHighlighted && (
                  <span className="mt-1 h-0 w-0 border-x-[5px] border-b-[7px] border-x-transparent border-b-brand-500" />
                )}
              </div>
              {index < visible.length - 1 && (
                <span className="mx-0.5 mt-4 text-ink-dim" aria-hidden>
                  <IconArrowRight size={14} />
                </span>
              )}
            </div>
          );
        })}
        {visibleStart + visible.length < sorted.length && (
          <span className="ml-2 mt-3 font-mono text-xs font-bold text-ink-dim">...</span>
        )}
      </div>
    </button>
  );
});

function formatMonthDate(dateKey: string, language: string): string {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
    month: 'short',
  });
}

function formatFullDate(dateKey: string, language: string): string {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function parseDateKey(dateKey: string): Date | null {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}
