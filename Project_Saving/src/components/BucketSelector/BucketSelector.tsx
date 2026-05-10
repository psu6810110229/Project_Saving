import { useEffect, useState } from 'react';
import type { Bucket } from '../../types';

const STORAGE_KEY = (roomId: string) => `lastBucket:${roomId}`;

interface Props {
  buckets: Bucket[];
  roomId: string;
  selected: string | null;
  onChange: (bucketId: string) => void;
}

export function BucketSelector({ buckets, roomId, selected, onChange }: Props) {
  const [initialized, setInitialized] = useState(false);

  // On mount or room change, restore last-used bucket from localStorage
  useEffect(() => {
    if (buckets.length === 0) return;
    const stored = localStorage.getItem(STORAGE_KEY(roomId));
    const exists = stored && buckets.some(b => b.id === stored);
    const initial = exists ? stored : buckets[0].id;
    onChange(initial);
    setInitialized(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, buckets.map(b => b.id).join(',')]);

  function handleChange(bucketId: string) {
    localStorage.setItem(STORAGE_KEY(roomId), bucketId);
    onChange(bucketId);
  }

  if (!initialized && buckets.length === 0) {
    return (
      <p className="text-xs text-ink-muted text-center py-1">
        Create a bucket on Profile first.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-muted">Bucket:</span>
      <select
        value={selected ?? ''}
        onChange={e => handleChange(e.target.value)}
        className="flex-1 bg-surface border border-border rounded-full px-3 py-1.5 text-sm text-ink outline-none focus:border-terracotta transition-colors"
      >
        {buckets.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  );
}
