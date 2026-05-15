import type { ReactNode } from 'react';
import { BucketRow } from '../BucketRow/BucketRow';
import { Button } from '../Button/Button';
import { IconPlus } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';

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
  ctaLabel,
  onAddBucket,
  onBucketClick,
  renderBucket,
}: BucketGridProps) {
  const { copy } = useI18n();
  const resolvedCta = ctaLabel ?? copy.dashboard.addBucket;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-brand-800">
              {copy.dashboard.smartBuckets}
            </p>
            <h2 className="mt-1 font-mono text-2xl font-bold text-ink truncate">{title}</h2>
            {subtitle && <p className="mt-1 font-mono text-sm text-ink-muted">{subtitle}</p>}
          </div>
          <Button
            variant="action"
            size="sm"
            onClick={onAddBucket}
            leadingIcon={<IconPlus size={18} />}
            className="self-start"
          >
            {resolvedCta}
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
