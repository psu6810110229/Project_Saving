import { useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Bucket, BucketCategory } from '../../types';
import type { MomentumPurposeScope } from '../../lib/momentumPurpose';
import { bucketsForCategory } from '../../lib/momentumPurpose';
import { normalizeBucketCategory } from '../../lib/bucketCategories';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { ScrollFadeContainer } from '../ScrollFadeContainer/ScrollFadeContainer';
import { haptic } from '../../lib/haptics';
import { SPRING, REDUCED_MOTION_TRANSITION } from '../../lib/motion';
import { useI18n } from '../../i18n/useI18n';
import { IconX } from '../Icon/Icon';

interface MomentumPurposePickerProps {
  categories: BucketCategory[];
  buckets: Bucket[];
  value: MomentumPurposeScope;
  onChange: (next: MomentumPurposeScope) => void;
  hideBucketRow?: boolean;
}

export function MomentumPurposePicker({
  categories,
  buckets,
  value,
  onChange,
  hideBucketRow,
}: MomentumPurposePickerProps) {
  const { copy } = useI18n();
  const d = copy.dashboard;
  const catLabels = copy.bucket.categoryLabels;
  const reduceMotion = useReducedMotion();

  const isAll = value.kind === 'all';
  const selectedCategories = useMemo(() => {
    if (value.kind === 'category') return new Set<BucketCategory>([value.category]);
    if (value.kind === 'categories') return new Set<BucketCategory>(value.categories);
    if (value.kind === 'bucket') return new Set<BucketCategory>([value.parentCategory]);
    return new Set<BucketCategory>();
  }, [value]);

  const activeCategory = value.kind === 'category'
    ? value.category
    : value.kind === 'bucket'
      ? value.parentCategory
      : null;
  const hasPurposeSelection = selectedCategories.size > 0;

  function toggleCategory(category: BucketCategory) {
    const next = new Set(selectedCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }

    const ordered = categories.filter(cat => next.has(cat));
    if (ordered.length === 0) {
      onChange({ kind: 'all' });
    } else if (ordered.length === 1) {
      onChange({ kind: 'category', category: ordered[0] });
    } else {
      onChange({ kind: 'categories', categories: ordered });
    }
    haptic('success');
  }

  const subPills = useMemo(() => {
    if (!activeCategory) return [];
    return bucketsForCategory(buckets, activeCategory);
  }, [buckets, activeCategory]);

  return (
    <div className="flex flex-col gap-1">
      {/* Category row */}
      <div className="flex items-start gap-1.5">
        <div className="flex min-w-[58px] shrink-0 flex-col items-center">
          <PurposeChip
            active={isAll}
            label={d.dailyDepositPurposeAll}
            onClick={() => {
              onChange({ kind: 'all' });
              haptic('success');
            }}
          />
          <AnimatePresence initial={false}>
            {hasPurposeSelection && (
              <motion.button
                type="button"
                aria-label="Clear purpose filters"
                title="Clear purpose filters"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
                transition={reduceMotion ? REDUCED_MOTION_TRANSITION : SPRING.content}
                onClick={() => {
                  onChange({ kind: 'all' });
                  haptic('success');
                }}
                className="mt-1.5 inline-flex min-h-6 items-center gap-1 px-0.5 font-mono text-[11px] font-bold leading-[16px] text-brand-500 transition-colors hover:text-brand-600 active:scale-95"
              >
                <IconX size={13} />
                <span>Clear</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <ScrollFadeContainer
          wrapperClassName="min-w-0 flex-1"
          className="flex gap-1.5 overflow-x-auto pb-1.5"
          fadeWidth={28}
          showArrows
        >
          <div
            role="tablist"
            aria-label={d.dailyDepositPurposeAria}
            className="flex gap-1.5"
          >
            {categories.map(cat => (
              <PurposeChip
                key={cat}
                active={selectedCategories.has(cat)}
                label={catLabels[cat]}
                icon={<BucketCategoryIcon category={cat} size={18} />}
                onClick={() => {
                  toggleCategory(cat);
                }}
              />
            ))}
          </div>
        </ScrollFadeContainer>
      </div>

      {/* Bucket sub-pill row */}
      <AnimatePresence mode="popLayout">
        {subPills.length > 0 && !hideBucketRow && (
          <motion.div
            key="bucket-row"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? REDUCED_MOTION_TRANSITION : SPRING.content}
            className="overflow-hidden"
          >
            <ScrollFadeContainer
              wrapperClassName="-mx-4"
              className="flex gap-1.5 overflow-x-auto px-4 pb-1"
              fadeWidth={28}
            >
              <div className="flex gap-1.5">
                {subPills.map((bucket, i) => (
                    <BucketSubPill
                      key={bucket.id}
                      name={bucket.name}
                      active={value.kind === 'bucket' && value.bucketId === bucket.id}
                      index={i}
                      reduceMotion={!!reduceMotion}
                      onClick={() => {
                        onChange({
                          kind: 'bucket',
                          bucketId: bucket.id,
                          parentCategory: normalizeBucketCategory(bucket.category),
                        });
                        haptic('success');
                      }}
                      onClear={() => {
                        onChange({
                          kind: 'category',
                          category: normalizeBucketCategory(bucket.category),
                        });
                        haptic('success');
                      }}
                    />
                ))}
              </div>
            </ScrollFadeContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Category chip ──────────────────────────────────────────────────── */

interface PurposeChipProps {
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  onClear?: () => void;
}

function PurposeChip({ active, label, icon, onClick, onClear }: PurposeChipProps) {
  const chipTone = active
    ? 'bg-brand-500 text-ink-inverse shadow-[0_4px_12px_rgba(242,107,26,0.28)]'
    : 'bg-well text-ink-muted shadow-[inset_2px_2px_5px_rgba(120,89,61,0.12),inset_-2px_-2px_5px_rgba(255,255,255,0.5)]';

  if (active && onClear) {
    return (
      <span className={`inline-flex shrink-0 items-center overflow-hidden rounded-pill font-mono text-[11px] font-bold transition-colors ${chipTone}`}>
        <button
          type="button"
          role="tab"
          aria-selected={active}
          onClick={onClick}
          className="inline-flex min-w-0 items-center gap-1.5 py-2 pl-3 pr-1.5"
        >
          {icon && <span className="grid h-5 w-5 shrink-0 place-items-center text-ink-inverse">{icon}</span>}
          <span className="truncate">{label}</span>
        </button>
        <button
          type="button"
          aria-label={`Clear ${label} filter`}
          title={`Clear ${label} filter`}
          onClick={onClear}
          className="mr-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20 text-ink-inverse transition-colors hover:bg-white/30 active:scale-95"
        >
          <IconX size={12} />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'inline-flex min-w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-2 font-mono text-[11px] font-bold transition-colors '
        + chipTone
      }
    >
      {icon && <span className={active ? 'grid h-5 w-5 shrink-0 place-items-center text-ink-inverse' : 'grid h-5 w-5 shrink-0 place-items-center text-ink-muted'}>{icon}</span>}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

/* ── Bucket sub-pill ────────────────────────────────────────────────── */

interface BucketSubPillProps {
  name: string;
  active: boolean;
  index: number;
  reduceMotion: boolean;
  onClick: () => void;
  onClear?: () => void;
}

function BucketSubPill({ name, active, index, reduceMotion, onClick, onClear }: BucketSubPillProps) {
  const motionProps = {
    initial: reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 },
    animate: reduceMotion
      ? { opacity: 1 }
      : { scale: 1, opacity: 1 },
    exit: reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 },
    transition: reduceMotion
      ? REDUCED_MOTION_TRANSITION
      : { ...SPRING.content, delay: index * 0.04 },
  };

  if (active && onClear) {
    return (
      <motion.span
        {...motionProps}
        className="inline-flex max-w-[160px] shrink-0 items-center overflow-hidden rounded-pill bg-brand-400 font-mono text-[10px] font-semibold text-ink-inverse shadow-[0_2px_8px_rgba(242,107,26,0.22)]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={active}
          onClick={onClick}
          className="min-w-0 py-1.5 pl-2.5 pr-1"
        >
          <span className="block truncate">{name}</span>
        </button>
        <button
          type="button"
          aria-label={`Clear ${name} filter`}
          title={`Clear ${name} filter`}
          onClick={onClear}
          className="mr-1 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-white/20 text-ink-inverse transition-colors hover:bg-white/30 active:scale-95"
        >
          <IconX size={10} />
        </button>
      </motion.span>
    );
  }

  return (
    <motion.button
      type="button"
      role="tab"
      aria-selected={active}
      {...motionProps}
      onClick={onClick}
      className={
        'inline-flex max-w-[140px] shrink-0 items-center whitespace-nowrap rounded-pill px-2 py-1 font-mono text-[10px] font-semibold transition-colors '
        + (active
          ? 'bg-brand-400 text-ink-inverse shadow-[0_2px_8px_rgba(242,107,26,0.22)]'
          : 'bg-well text-ink-muted shadow-[inset_1px_1px_3px_rgba(120,89,61,0.10),inset_-1px_-1px_3px_rgba(255,255,255,0.4)]')
      }
    >
      <span className="truncate">{name}</span>
    </motion.button>
  );
}
