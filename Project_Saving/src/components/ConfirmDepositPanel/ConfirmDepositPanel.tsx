import type { ReactNode } from 'react';
import { Button } from '../Button/Button';
import { ComparisonTrendChart } from '../ComparisonTrendChart/ComparisonTrendChart';
import { MicroCopyBanner } from '../MicroCopyBanner/MicroCopyBanner';

type BannerTone = 'cheer' | 'nudge' | 'streak';

interface ConfirmDepositPanelProps {
  bannerIcon: ReactNode;
  bannerTitle: string;
  bannerBody?: string;
  bannerTone?: BannerTone;
  mineLabel: string;
  theirLabel: string;
  mineSeries: number[];
  theirSeries: number[];
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}

export function ConfirmDepositPanel({
  bannerIcon,
  bannerTitle,
  bannerBody,
  bannerTone = 'cheer',
  mineLabel,
  theirLabel,
  mineSeries,
  theirSeries,
  primaryLabel = 'Confirm Deposit',
  secondaryLabel = 'Edit Amount',
  onPrimary,
  onSecondary,
}: ConfirmDepositPanelProps) {
  return (
    <section className="flex flex-col gap-3">
      <MicroCopyBanner icon={bannerIcon} title={bannerTitle} body={bannerBody} tone={bannerTone} />
      <ComparisonTrendChart
        mineLabel={mineLabel}
        theirLabel={theirLabel}
        mineSeries={mineSeries}
        theirSeries={theirSeries}
      />
      <div className="flex flex-col gap-2">
        <Button variant="action" fullWidth onClick={onPrimary}>{primaryLabel}</Button>
        {onSecondary && (
          <Button variant="ghost" fullWidth onClick={onSecondary}>{secondaryLabel}</Button>
        )}
      </div>
    </section>
  );
}
