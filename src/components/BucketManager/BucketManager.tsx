import type { ReactNode } from 'react';
import { bucketSaved } from '../../lib/buckets';
import { formatCurrency } from '../../lib/format';
import type { Bucket, BucketCategory, SavingsLog } from '../../types';
import { CreateBucketForm } from '../CreateBucketForm/CreateBucketForm';

interface BucketCategoryOption {
  id: BucketCategory;
  label: string;
  icon: ReactNode;
}

interface BucketManagerProps {
  buckets: Bucket[];
  logs: SavingsLog[];
  category: BucketCategory | null;
  options: BucketCategoryOption[];
  name: string;
  target: string;
  onCategoryChange: (next: BucketCategory) => void;
  onNameChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onCreate: () => void;
}

export function BucketManager({
  buckets,
  logs,
  category,
  options,
  name,
  target,
  onCategoryChange,
  onNameChange,
  onTargetChange,
  onCreate,
}: BucketManagerProps) {
  return (
    <div className="flex flex-col gap-4">
      <BucketSummary buckets={buckets} logs={logs} />
      <CreateBucketForm
        category={category}
        options={options}
        name={name}
        target={target}
        onCategoryChange={onCategoryChange}
        onNameChange={onNameChange}
        onTargetChange={onTargetChange}
        onSubmit={onCreate}
      />
    </div>
  );
}

function BucketSummary({
  buckets,
  logs,
}: {
  buckets: Pick<Bucket, 'id' | 'name' | 'target_amount'>[];
  logs: SavingsLog[];
}) {
  if (buckets.length === 0) {
    return <p className="font-mono text-xs text-ink-muted">No buckets yet. Create one below.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {buckets.map(bucket => (
        <div key={bucket.id} className="rounded-2xl bg-brand-50 px-4 py-3 font-mono text-xs text-ink-muted">
          <span className="font-bold text-ink">{bucket.name}</span>
          {' '}
          {formatCurrency(bucketSaved(bucket.id, logs))} / {formatCurrency(bucket.target_amount)}
        </div>
      ))}
    </div>
  );
}
