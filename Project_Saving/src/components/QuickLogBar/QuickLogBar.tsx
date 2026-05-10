import { useState } from 'react';
import { formatCurrency } from '../../lib/format';
import { BucketSelector } from '../BucketSelector/BucketSelector';
import type { Bucket } from '../../types';

const PRESETS = [100, 500, 1000];

interface Props {
  onInsert: (amount: number, bucketId: string) => Promise<{ error?: string }>;
  onPreview?: (amount: number) => void;
  buckets: Bucket[];
  roomId: string;
}

export function QuickLogBar({ onInsert, onPreview, buckets, roomId }: Props) {
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);

  async function handleClick(amount: number) {
    if (!selectedBucket) { setErrorMsg('Select a bucket first'); return; }
    setErrorMsg('');
    const { error } = await onInsert(amount, selectedBucket);
    if (error) setErrorMsg(error);
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-ink-muted uppercase tracking-widest font-semibold">Quick log</span>
      <BucketSelector
        buckets={buckets}
        roomId={roomId}
        selected={selectedBucket}
        onChange={setSelectedBucket}
      />
      {buckets.length === 0 ? (
        <p className="text-xs text-ink-muted text-center py-2">Create a bucket on Profile first.</p>
      ) : (
        <div className="flex gap-3">
          {PRESETS.map(amount => (
            <button
              key={amount}
              onClick={() => handleClick(amount)}
              onPointerEnter={() => onPreview?.(amount)}
              onPointerLeave={() => onPreview?.(0)}
              className="
                flex-1 bg-surface border border-border rounded-xl py-4
                text-base font-bold text-ink
                shadow-sm
                hover:bg-terracotta hover:text-white hover:border-terracotta hover:shadow-md
                active:scale-95
                transition-all duration-150
              "
            >
              +{formatCurrency(amount)}
            </button>
          ))}
        </div>
      )}
      {errorMsg && <p className="text-red-500 text-xs">{errorMsg}</p>}
    </div>
  );
}
