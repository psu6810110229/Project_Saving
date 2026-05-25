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

  const activeCategory = value.kind === 'category'
    ? value.category
    : value.kind === 'bucket'
      ? value.parentCategory
      : null;

  const subPills = useMemo(() => {
    if (!activeCategory) return [];
    return bucketsForCategory(buckets, activeCategory);
  }, [buckets, activeCategory]);

  return (
    <div className="flex flex-col gap-1">
      {/* Category row */}
      <ScrollFadeContainer
        wrapperClassName="-mx-4"
        className="flex gap-1.5 overflow-x-auto px-4 pb-1.5"
        fadeWidth={28}
      >
        <div
          role="tablist"
          aria-label={d.dailyDepositPurposeAria}
          className="flex gap-1.5"
        >
          <PurposeChip
            active={isAll}
            label={d.dailyDepositPurposeAll}
            onClick={() => {
              onChange({ kind: 'all' });
              haptic('success');
            }}
          />
          {categories.map(cat => (
            <PurposeChip
              key={cat}
              active={activeCategory === cat}
              label={catLabels[cat]}
              icon={<BucketCategoryIcon category={cat} size={14} />}
              onClick={() => {
                onChange({ kind: 'category', category: cat });
                haptic('success');
              }}
            />
          ))}
        </div>
      </ScrollFadeContainer>

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
}

function PurposeChip({ active, label, icon, onClick }: PurposeChipProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-1.5 font-mono text-[11px] font-bold transition-colors '
        + (active
          ? 'bg-brand-500 text-ink-inverse shadow-[0_4px_12px_rgba(242,107,26,0.28)]'
          : 'bg-well text-ink-muted shadow-[inset_2px_2px_5px_rgba(120,89,61,0.12),inset_-2px_-2px_5px_rgba(255,255,255,0.5)]')
      }
    >
      {icon && <span className={active ? 'text-ink-inverse' : 'text-ink-muted'}>{icon}</span>}
      <span className="truncate">{label}</span>
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
}

function BucketSubPill({ name, active, index, reduceMotion, onClick }: BucketSubPillProps) {
  return (
    <motion.button
      type="button"
      role="tab"
      aria-selected={active}
      initial={reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
      animate={reduceMotion
        ? { opacity: 1 }
        : { scale: 1, opacity: 1 }
      }
      exit={reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
      transition={reduceMotion
        ? REDUCED_MOTION_TRANSITION
        : { ...SPRING.content, delay: index * 0.04 }
      }
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
