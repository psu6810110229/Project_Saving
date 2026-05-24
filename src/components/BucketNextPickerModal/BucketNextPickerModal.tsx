import { Modal } from '../Modal/Modal';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';
import type { BucketCategory } from '../../types';

interface BucketOption {
  id: string;
  name: string;
  category?: BucketCategory;
  saved: number;
  target: number;
}

interface BucketNextPickerModalProps {
  open: boolean;
  buckets: BucketOption[];
  currentNextBucketId: string | null;
  onSelect: (bucketId: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function BucketNextPickerModal({
  open,
  buckets,
  currentNextBucketId,
  onSelect,
  onClear,
  onClose,
}: BucketNextPickerModalProps) {
  const { copy } = useI18n();

  return (
    <Modal open={open} title={copy.bucketIntent.nextPickerTitle} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {buckets.map(bucket => {
          const pct = bucket.target > 0 ? (bucket.saved / bucket.target) * 100 : 0;
          const isSelected = bucket.id === currentNextBucketId;
          return (
            <button
              key={bucket.id}
              type="button"
              onClick={() => {
                onSelect(bucket.id);
                onClose();
              }}
              className={
                'flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors '
                + (isSelected
                  ? 'bg-brand-50 ring-2 ring-brand-500'
                  : 'bg-surface hover:bg-well')
              }
            >
              <span className="shrink-0 text-brand-500">
                <BucketCategoryIcon category={bucket.category} size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-bold text-ink">{bucket.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
                  {formatCurrency(Math.round(bucket.saved))} / {formatCurrency(Math.round(bucket.target))}
                </p>
                <ProgressBar value={pct} tone="primary" size="sm" className="mt-1.5 bg-brand-50" />
              </div>
            </button>
          );
        })}
        {currentNextBucketId && (
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="mt-1 font-mono text-xs font-bold text-ink-muted transition-colors hover:text-ink active:scale-[0.98]"
          >
            {copy.bucketIntent.clearNext}
          </button>
        )}
      </div>
    </Modal>
  );
}
