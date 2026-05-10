import { useState, useEffect } from 'react';
import { useBuckets } from '../../hooks/useBuckets';
import { BucketRow } from '../BucketRow/BucketRow';
import { validateBuckets, sumTargets } from '../../lib/buckets';
import { formatCurrency } from '../../lib/format';
import type { BucketDraft, SavingsLog } from '../../types';

interface Props {
  roomId: string | null;
  goalTarget: number;
  logs: SavingsLog[];
}

export function BucketEditor({ roomId, goalTarget, logs }: Props) {
  const { buckets, loading, saveBuckets } = useBuckets(roomId);
  const [drafts, setDrafts] = useState<BucketDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync drafts whenever DB buckets change
  useEffect(() => {
    setDrafts(buckets.map(b => ({ id: b.id, name: b.name, target_amount: b.target_amount })));
  }, [buckets]);

  function handleNameChange(i: number, name: string) {
    setDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, name } : d));
    setErrorMsg('');
  }

  function handleTargetChange(i: number, target_amount: number) {
    setDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, target_amount } : d));
    setErrorMsg('');
  }

  function handleDelete(i: number) {
    setDrafts(prev => prev.filter((_, idx) => idx !== i));
    setErrorMsg('');
  }

  function handleAdd() {
    if (drafts.length >= 10) return;
    setDrafts(prev => [...prev, { id: undefined, name: '', target_amount: 0 }]);
  }

  async function handleSave() {
    setErrorMsg('');
    const validation = validateBuckets(drafts, goalTarget);
    if (validation.state === 'over') {
      setErrorMsg(`Cannot save: ${validation.reason}`);
      return;
    }
    if (drafts.some(d => !d.name.trim())) {
      setErrorMsg('All buckets must have a name.');
      return;
    }
    if (drafts.some(d => d.target_amount <= 0)) {
      setErrorMsg('All bucket targets must be greater than 0.');
      return;
    }
    setSaving(true);
    const result = await saveBuckets(drafts);
    setSaving(false);
    if (result.error) setErrorMsg(result.error);
  }

  const validation = validateBuckets(drafts, goalTarget);
  const totalAllocated = sumTargets(drafts);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="w-6 h-6 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-muted uppercase tracking-widest font-semibold">
          Your Buckets ({drafts.length} of 10)
        </span>
      </div>

      {/* Bucket rows */}
      {drafts.map((draft, i) => {
        // Build a fake Bucket object for BucketRow (safe because id may be undefined for new rows)
        const fakeBucket = {
          id: draft.id ?? `__new_${i}`,
          user_id: '',
          room_id: roomId ?? '',
          name: draft.name,
          target_amount: draft.target_amount,
          position: i,
          created_at: '',
        };
        return (
          <BucketRow
            key={draft.id ?? `new-${i}`}
            bucket={fakeBucket}
            logs={draft.id ? logs : []}
            onNameChange={name => handleNameChange(i, name)}
            onTargetChange={amount => handleTargetChange(i, amount)}
            onDelete={() => handleDelete(i)}
            canDelete={drafts.length > 1}
          />
        );
      })}

      {/* Sum indicator */}
      <div className={`text-sm font-medium px-1 ${
        validation.state === 'match' ? 'text-emerald-600' :
        validation.state === 'under' ? 'text-amber-600' :
        'text-red-500'
      }`}>
        {validation.state === 'match' && `✓ ${formatCurrency(totalAllocated)} / ${formatCurrency(goalTarget)} allocated`}
        {validation.state === 'under' && `⚠ ${formatCurrency(totalAllocated)} / ${formatCurrency(goalTarget)} — ${validation.reason}`}
        {validation.state === 'over' && `✕ ${formatCurrency(totalAllocated)} / ${formatCurrency(goalTarget)} — ${validation.reason}`}
      </div>

      {errorMsg && <p className="text-red-500 text-xs">{errorMsg}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={drafts.length >= 10}
          className="flex-1 border border-border rounded-xl py-2.5 text-sm text-ink-muted font-medium hover:border-terracotta hover:text-terracotta disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          + Add bucket
        </button>
        <button
          onClick={handleSave}
          disabled={saving || validation.state === 'over'}
          className="flex-1 bg-terracotta text-white rounded-xl py-2.5 text-sm font-bold shadow-sm hover:shadow-md hover:brightness-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? '…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
