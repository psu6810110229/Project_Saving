import { memo, type ReactNode } from 'react';
import { BucketRow } from '../BucketRow/BucketRow';
import { Button } from '../Button/Button';
import type { BucketCategory } from '../../types';

export interface BucketGridItem {
  id: string;
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
  category?: BucketCategory;
  deadline?: string | null;
  completedAt?: string | null;
  status?: {
    kind: 'focus' | 'next' | 'done' | 'queued' | 'overdue';
    label: string;
  };
  pace?: {
    status: 'ahead' | 'on_track' | 'behind' | 'critical';
    remainingDays: number;
  } | null;
}

interface BucketGridProps {
  title: string;
  subtitle?: string;
  buckets: BucketGridItem[];
  ctaLabel?: string;
  addShortLabel?: string;
  onAddBucket?: () => void;
  manageLabel?: string;
  onManageBuckets?: () => void;
  onBucketClick?: (id: string) => void;
  renderBucket?: (bucket: BucketGridItem) => ReactNode;
  belowHeader?: ReactNode;
  /** Rendered in the header's right-side button group, beside the Add button. */
  headerAction?: ReactNode;
}

export const BucketGrid = memo(function BucketGrid({
  title,
  subtitle,
  buckets,
  ctaLabel,
  addShortLabel,
  onAddBucket,
  manageLabel,
  onManageBuckets,
  onBucketClick,
  renderBucket,
  belowHeader,
  headerAction,
}: BucketGridProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            className="font-mono text-lg font-bold leading-tight text-ink line-clamp-2 break-words"
            title={title}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 truncate font-mono text-xs leading-snug text-ink-muted" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onManageBuckets && (
            <Button variant="secondary" size="sm" onClick={onManageBuckets}>
              {manageLabel!}
            </Button>
          )}
          {headerAction}
          {onAddBucket && (
            <Button variant="action" size="sm" aria-label={ctaLabel} onClick={onAddBucket}>
              {addShortLabel ?? ctaLabel}
            </Button>
          )}
        </div>
      </div>
      {belowHeader}
      <div className="grid grid-cols-2 gap-4 p-1" data-bucket-drag-boundary="true">
        {buckets.map(bucket => (
          renderBucket ? (
            <div key={bucket.id}>{renderBucket(bucket)}</div>
          ) : (
            <BucketRow
              key={bucket.id}
              icon={bucket.icon}
              name={bucket.name}
              saved={bucket.saved}
              target={bucket.target}
              category={bucket.category}
              status={bucket.status}
              deadline={bucket.deadline}
              completedAt={bucket.completedAt}
              pace={bucket.pace}
              onClick={() => onBucketClick?.(bucket.id)}
            />
          )
        ))}
      </div>
    </section>
  );
});
