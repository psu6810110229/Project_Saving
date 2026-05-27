import { useState } from 'react';
import { Button } from '../Button/Button';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { IconArrowLeft, IconCheck, IconPlus } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { formatCurrency } from '../../lib/format';
import type { JoinBucketDraft } from './JoinRoomWizard';
import type { BucketCategory } from '../../types';

interface StepBucketsProps {
  buckets: JoinBucketDraft[];
  onBucketsChange: (buckets: JoinBucketDraft[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepBuckets({ buckets, onBucketsChange, onNext, onBack }: StepBucketsProps) {
  const { copy, language } = useI18n();
  const c = copy.joinRoomWizard;
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  function toggleBucket(id: string) {
    onBucketsChange(
      buckets.map(b => (b.id === id ? { ...b, accepted: !b.accepted } : b)),
    );
  }

  function addCustomBucket() {
    const name = customName.trim();
    const amount = Number(customAmount);
    if (!name || amount <= 0) return;

    const newBucket: JoinBucketDraft = {
      id: `custom-${Date.now()}`,
      category: 'other',
      name,
      targetAmount: amount,
      deadline: '',
      accepted: true,
      isCustom: true,
    };
    onBucketsChange([...buckets, newBucket]);
    setCustomName('');
    setCustomAmount('');
    setAddingCustom(false);
  }

  const hasAccepted = buckets.some(b => b.accepted);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-mono text-2xl font-bold text-ink">{c.stepBucketsTitle}</h2>
        <p className="mt-1 font-mono text-sm text-ink-muted">{c.stepBucketsSubtitle}</p>
      </div>

      {buckets.length === 0 && !addingCustom ? (
        <p className="rounded-lg bg-surface px-4 py-3 font-mono text-xs text-ink-muted shadow-soft">
          {c.noBucketsHint}
        </p>
      ) : (
        <div className="space-y-2">
          {buckets.map(bucket => (
            <button
              key={bucket.id}
              type="button"
              onClick={() => toggleBucket(bucket.id)}
              className={`flex w-full items-center gap-3 rounded-xl p-3 text-left shadow-soft transition-colors ${
                bucket.accepted
                  ? 'bg-brand-50 ring-2 ring-brand-300'
                  : 'bg-surface'
              }`}
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/60 text-brand-600">
                <BucketCategoryIcon category={bucket.category as BucketCategory} size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate font-mono text-sm font-bold text-ink">
                  {bucket.name}
                </span>
                <span className="font-mono text-xs text-ink-muted">
                  {formatCurrency(bucket.targetAmount)}
                </span>
              </div>
              <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                bucket.accepted ? 'bg-brand-500 text-white' : 'bg-well'
              }`}>
                {bucket.accepted && <IconCheck size={14} />}
              </div>
            </button>
          ))}
        </div>
      )}

      {addingCustom ? (
        <div className="rounded-xl bg-surface p-4 shadow-soft">
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-xs text-ink-muted">{c.bucketNameLabel}</span>
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                maxLength={30}
                placeholder={language === 'th' ? 'เช่น ค่ากิจกรรม' : 'e.g. Activities'}
                className="rounded-lg bg-well px-3 py-2 font-mono text-sm text-ink shadow-neuPressed outline-none focus:ring-2 focus:ring-brand-500"
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-xs text-ink-muted">{c.bucketAmountLabel}</span>
              <input
                type="number"
                min={0}
                step={100}
                inputMode="decimal"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="5000"
                className="rounded-lg bg-well px-3 py-2 font-mono text-sm text-ink shadow-neuPressed outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" fullWidth onClick={() => setAddingCustom(false)}>
                {c.cancelBucket}
              </Button>
              <Button
                variant="action"
                fullWidth
                disabled={!customName.trim() || Number(customAmount) <= 0}
                onClick={addCustomBucket}
              >
                {c.saveBucket}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingCustom(true)}
          className="flex items-center gap-2 rounded-xl bg-surface px-4 py-3 font-mono text-sm text-brand-700 shadow-soft hover:bg-brand-50"
        >
          <IconPlus size={16} />
          {c.addPersonalBucket}
        </button>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" size="lg" onClick={onBack}>
          <IconArrowLeft size={16} />
        </Button>
        <Button variant="action" fullWidth onClick={onNext} disabled={!hasAccepted && buckets.length > 0}>
          {copy.createRoomWizard.nextButton}
        </Button>
      </div>
    </div>
  );
}
