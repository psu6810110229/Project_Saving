import type { ReactNode } from 'react';
import { Button } from '../Button/Button';
import { ComparisonTrendChart } from '../ComparisonTrendChart/ComparisonTrendChart';
import { MicroCopyBanner } from '../MicroCopyBanner/MicroCopyBanner';
import { useI18n } from '../../i18n/useI18n';

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
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: ConfirmDepositPanelProps) {
  const { copy } = useI18n();
  const resolvedPrimaryLabel = primaryLabel ?? copy.addMoney.confirmDepositButton;
  const resolvedSecondaryLabel = secondaryLabel ?? copy.addMoney.editAmountButton;

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
        <Button variant="action" fullWidth onClick={onPrimary}>{resolvedPrimaryLabel}</Button>
        {onSecondary && (
          <Button variant="ghost" fullWidth onClick={onSecondary}>{resolvedSecondaryLabel}</Button>
        )}
      </div>
    </section>
  );
}
