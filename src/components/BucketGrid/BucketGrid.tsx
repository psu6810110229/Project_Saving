import type { ReactNode } from 'react';
import { BucketRow } from '../BucketRow/BucketRow';
import { IconPlus } from '../Icon/Icon';

export interface BucketGridItem {
  id: string;
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
  status?: {
    kind: 'focus' | 'next' | 'done';
    label: string;
  };
}

interface BucketGridProps {
  title: string;
  subtitle?: string;
  buckets: BucketGridItem[];
  ctaLabel?: string;
  onAddBucket?: () => void;
  manageLabel?: string;
  onManageBuckets?: () => void;
  onBucketClick?: (id: string) => void;
  renderBucket?: (bucket: BucketGridItem) => ReactNode;
  belowHeader?: ReactNode;
}

export function BucketGrid({
  title,
  subtitle,
  buckets,
  ctaLabel,
  onAddBucket,
  manageLabel,
  onManageBuckets,
  onBucketClick,
  renderBucket,
  belowHeader,
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
            <button
              type="button"
              onClick={onManageBuckets}
              aria-label={manageLabel}
              title={manageLabel}
              className="inline-flex items-center rounded-pill bg-well px-3 py-1.5 font-mono text-xs font-bold text-ink-muted shadow-neuPressed transition-colors hover:text-ink active:scale-[0.98]"
            >
              {manageLabel}
            </button>
          )}
          {onAddBucket && (
            <button
              type="button"
              onClick={onAddBucket}
              aria-label={ctaLabel}
              title={ctaLabel}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-ink-inverse shadow-haloOrange transition-all duration-200 hover:bg-brand-400 active:scale-[0.98]"
            >
              <IconPlus size={20} />
            </button>
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
              onClick={() => onBucketClick?.(bucket.id)}
            />
          )
        ))}
      </div>
    </section>
  );
}
