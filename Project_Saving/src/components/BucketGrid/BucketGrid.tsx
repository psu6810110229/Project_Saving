import type { ReactNode } from 'react';
import { BucketRow } from '../BucketRow/BucketRow';
import { Button } from '../Button/Button';
import { IconPlus } from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';

export interface BucketGridItem {
  id: string;
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
}

interface BucketGridProps {
  title: string;
  subtitle?: string;
  buckets: BucketGridItem[];
  ctaLabel?: string;
  onAddBucket?: () => void;
  onBucketClick?: (id: string) => void;
  renderBucket?: (bucket: BucketGridItem) => ReactNode;
}

export function BucketGrid({
  title,
  subtitle,
  buckets,
  ctaLabel = 'Add Bucket',
  onAddBucket,
  onBucketClick,
  renderBucket,
}: BucketGridProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <SectionLabel tone="brand">Smart Buckets</SectionLabel>
            <h2 className="mt-1 font-mono text-2xl font-bold text-ink truncate">{title}</h2>
            {subtitle && <p className="mt-1 font-mono text-xs text-ink-muted">{subtitle}</p>}
          </div>
          <Button
            variant="action"
            size="sm"
            onClick={onAddBucket}
            leadingIcon={<IconPlus size={18} />}
            className="self-start"
          >
            {ctaLabel}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
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
