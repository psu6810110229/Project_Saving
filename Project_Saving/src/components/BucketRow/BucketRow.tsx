import type { Bucket, SavingsLog } from '../../types';
import { bucketSaved, bucketPercent } from '../../lib/buckets';
import { formatCurrency } from '../../lib/format';

interface Props {
  bucket: Bucket;
  logs: SavingsLog[];
  onNameChange: (name: string) => void;
  onTargetChange: (amount: number) => void;
  onDelete: () => void;
  canDelete: boolean;
}

export function BucketRow({ bucket, logs, onNameChange, onTargetChange, onDelete, canDelete }: Props) {
  const saved = bucketSaved(bucket.id, logs);
  const pct = bucketPercent(bucket, logs);

  return (
    <div className="bg-canvas border border-border rounded-xl p-4 flex flex-col gap-3">
      {/* Name + target + delete */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          maxLength={30}
          value={bucket.name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Bucket name"
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-terracotta transition-colors"
        />
        <div className="flex items-center gap-1 border border-border rounded-lg px-3 py-2 bg-surface">
          <span className="text-xs text-ink-muted">฿</span>
          <input
            type="number"
            min="1"
            value={bucket.target_amount}
            onChange={e => onTargetChange(Number(e.target.value) || 0)}
            className="w-20 bg-transparent text-sm text-ink outline-none text-right"
          />
        </div>
        <button
          onClick={onDelete}
          disabled={!canDelete}
          title={canDelete ? 'Remove bucket' : 'Cannot remove the only bucket'}
          className="w-7 h-7 flex items-center justify-center rounded-full text-ink-muted hover:bg-red-100 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base"
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-terracotta rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-ink-muted">{Math.round(pct)}%</span>
          <span className="text-xs text-ink-muted">{formatCurrency(saved)} saved</span>
        </div>
      </div>
    </div>
  );
}
