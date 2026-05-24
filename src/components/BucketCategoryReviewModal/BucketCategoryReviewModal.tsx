import { useState } from 'react';
import type { Bucket, BucketCategory } from '../../types';
import { BUCKET_CATEGORY_ORDER } from '../../lib/bucketCategories';
import { isLowConfidenceCategory, normalizeBucketCategory } from '../../lib/bucketCategories';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { Button } from '../Button/Button';
import { Modal } from '../Modal/Modal';
import { useI18n } from '../../i18n/useI18n';

interface BucketCategoryReviewModalProps {
  open: boolean;
  buckets: Bucket[];
  onClose: () => void;
  onSave: (updates: { id: string; category: BucketCategory }[]) => Promise<{ error?: string }>;
}

export function BucketCategoryReviewModal({
  open,
  buckets,
  onClose,
  onSave,
}: BucketCategoryReviewModalProps) {
  const { copy } = useI18n();
  const reviewable = buckets.filter(isLowConfidenceCategory);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, BucketCategory>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const bucket = reviewable[currentIndex] as Bucket | undefined;
  const isLast = currentIndex >= reviewable.length - 1;

  function handleSelect(category: BucketCategory) {
    if (!bucket) return;
    setSaveError(null);
    setSelections(prev => ({ ...prev, [bucket.id]: category }));
  }

  function handleSkip() {
    if (isLast) {
      handleFinish();
    } else {
      setCurrentIndex(i => i + 1);
    }
  }

  function handleNext() {
    if (isLast) {
      handleFinish();
    } else {
      setCurrentIndex(i => i + 1);
    }
  }

  async function handleFinish() {
    const updates = Object.entries(selections).map(([id, category]) => ({
      id,
      category,
    }));
    if (updates.length === 0) {
      resetAndClose();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await onSave(updates);
      if (result.error) {
        setSaveError(result.error);
        return;
      }
    } catch {
      setSaveError(copy.bucket.categoryReview.saveError);
      return;
    } finally {
      setSaving(false);
    }
    resetAndClose();
  }

  function resetAndClose() {
    setCurrentIndex(0);
    setSelections({});
    setSaveError(null);
    onClose();
  }

  if (!bucket) return null;

  const selected = selections[bucket.id] ?? normalizeBucketCategory(bucket.category);

  return (
    <Modal open={open} title={copy.bucket.categoryReview.title} onClose={resetAndClose}>
      <div className="flex flex-col gap-4">
        <p className="font-mono text-xs text-ink-muted">
          {copy.bucket.categoryReview.body}
        </p>

        <div className="rounded-lg bg-brand-50 px-4 py-3">
          <p className="font-mono text-sm font-bold text-ink">{bucket.name}</p>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {currentIndex + 1} / {reviewable.length}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {BUCKET_CATEGORY_ORDER.map(cat => (
            <button
              key={cat}
              type="button"
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 font-mono text-xs transition-colors ${
                selected === cat
                  ? 'bg-brand-500 text-ink-inverse shadow-soft'
                  : 'bg-surface text-ink-muted hover:bg-brand-50'
              }`}
              onClick={() => handleSelect(cat)}
            >
              <BucketCategoryIcon category={cat} size={20} />
              <span className="truncate">{copy.bucket.categoryLabels[cat]}</span>
            </button>
          ))}
        </div>

        {saveError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">
            {saveError}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={handleSkip}
            disabled={saving}
          >
            {copy.bucket.categoryReview.skip}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleNext}
            disabled={saving}
          >
            {isLast ? copy.bucket.categoryReview.save : copy.bucket.categoryReview.save}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
