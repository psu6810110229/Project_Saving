import { type Bucket, type SavingsLog } from '../../types';
import { formatCurrency } from '../../lib/format';

interface Props {
  buckets: Bucket[];
  allLogs: SavingsLog[];
  onSelect: (bucket: Bucket) => void;
}

export function BucketGrid({ buckets, allLogs, onSelect }: Props) {
  if (buckets.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5 text-center flex flex-col gap-2">
        <span className="text-xl"></span>
        <p className="text-ink font-semibold">No buckets yet</p>
        <p className="text-sm text-ink-muted">Go to Profile to create your first savings bucket!</p>
      </div>
    );
  }

  // Calculate current saved amount per bucket
  const savedPerBucket = allLogs.reduce((acc, log) => {
    if (log.bucket_id) {
      acc[log.bucket_id] = (acc[log.bucket_id] || 0) + log.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-ink-muted uppercase tracking-widest font-semibold">Select a bucket to log</span>
      <div className="grid grid-cols-2 gap-3">
        {buckets.map((b, i) => {
          const saved = savedPerBucket[b.id] || 0;
          const progress = b.target_amount > 0 ? Math.min((saved / b.target_amount) * 100, 100) : 0;
          
          return (
            <button
              key={b.id}
              onClick={() => onSelect(b)}
              className="
                bg-surface border border-border rounded-xl p-4 text-left
                flex flex-col gap-2 shadow-sm
                hover:border-terracotta hover:shadow-md hover:bg-white
                active:scale-95 transition-all duration-150
                animate-scale-in
              "
              style={{ animationDelay: `${i * 75}ms` }}
            >
              <span className="font-medium text-sm text-ink truncate">{b.name}</span>
              <div className="flex flex-col gap-1.5 w-full mt-1">
                 <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-terracotta rounded-full transition-all duration-500" 
                      style={{ width: `${progress}%` }} 
                    />
                 </div>
                 <div className="flex justify-between items-center mt-1">
                   <span className="text-base font-bold text-ink-dim">{formatCurrency(saved)}</span>
                   <span className="text-sm font-semibold text-terracotta">{Math.round(progress)}%</span>
                 </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
