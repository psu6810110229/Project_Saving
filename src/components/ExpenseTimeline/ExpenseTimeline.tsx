import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { useI18n } from '../../i18n/useI18n';
import type { BucketCategory } from '../../types';

export interface TimelineItem {
  id: string;
  category: BucketCategory;
  nameEn: string;
  nameTh: string;
  deadline: string;
  targetAmount: number;
}

interface ExpenseTimelineProps {
  items: TimelineItem[];
  eventDate: string;
}

function formatShortDate(dateKey: string, lang: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  if (isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
    month: 'short',
    year: '2-digit',
  });
}

export function ExpenseTimeline({ items, eventDate }: ExpenseTimelineProps) {
  const { language, copy } = useI18n();
  const c = copy.createRoomWizard;

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.deadline.localeCompare(b.deadline)),
    [items],
  );

  // Edge-fade affordance: the row is horizontally scrollable, but with many
  // buckets nothing hints that more lies offscreen. We fade whichever end has
  // hidden content, so users know to scroll. Recomputed on scroll + resize and
  // when the item count changes.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const overflow = el.scrollWidth - el.clientWidth;
      setEdges({
        left: el.scrollLeft > 1,
        right: overflow > 1 && el.scrollLeft < overflow - 1,
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [sorted.length]);

  if (sorted.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory items-start gap-0 overflow-x-auto scroll-smooth pb-2 pt-1"
      >
        {sorted.map((item, i) => {
          const isLast = i === sorted.length - 1;
          const name = language === 'th' ? item.nameTh : item.nameEn;
          return (
            <div key={item.id} className="flex items-start">
              <div className="flex snap-start flex-col items-center" style={{ minWidth: 64 }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <BucketCategoryIcon category={item.category} size={18} />
                </div>
                <span className="mt-1 line-clamp-1 max-w-[72px] text-center font-mono text-[10px] font-bold text-ink">
                  {name}
                </span>
                <span className="font-mono text-[9px] text-ink-dim">
                  {formatShortDate(item.deadline, language)}
                </span>
              </div>
              {!isLast && (
                <div className="mt-4 h-0.5 w-6 flex-shrink-0 bg-brand-200" />
              )}
            </div>
          );
        })}

        {/* Event day marker */}
        <div className="flex items-start">
          <div className="ml-1 h-0.5 w-4 flex-shrink-0 self-center bg-brand-200" style={{ marginTop: -4 }} />
          <div className="flex snap-start flex-col items-center" style={{ minWidth: 56 }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-white">
              <span className="text-sm">🎯</span>
            </div>
            <span className="mt-1 font-mono text-[10px] font-bold text-accent-700">
              {c.timelineEventDay}
            </span>
            <span className="font-mono text-[9px] text-ink-dim">
              {formatShortDate(eventDate, language)}
            </span>
          </div>
        </div>
      </div>

      {/* Edge fades hint at offscreen buckets; only shown for the end that has
          hidden content. pointer-events-none so they never block scrolling. */}
      {edges.left && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface to-transparent" />
      )}
      {edges.right && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" />
      )}
    </div>
  );
}
