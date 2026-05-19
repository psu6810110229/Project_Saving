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
    <section className="flex flex-col gap-5">
      <div className="flex flex-col items-start gap-4">
        <div className="min-w-0">
          <h2 className="font-mono text-[2rem] font-bold leading-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-2 font-mono text-base leading-snug text-ink-muted">{subtitle}</p>}
        </div>
        {onAddBucket && (
          <Button
            variant="action"
            size="sm"
            onClick={onAddBucket}
            leadingIcon={<IconPlus size={18} />}
          >
            {resolvedCta}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
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
