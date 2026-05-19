import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { BucketHeader } from '../BucketHeader/BucketHeader';
import { Button } from '../Button/Button';
import { ComparisonTrendChart } from '../ComparisonTrendChart/ComparisonTrendChart';
import { FormField } from '../FormField/FormField';
import { IconEdit, IconPiggyBank } from '../Icon/Icon';
import { ProjectedProgressCard } from '../ProjectedProgressCard/ProjectedProgressCard';
import { QuickAddRow } from '../QuickAddRow/QuickAddRow';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { SlipAttachField } from '../SlipAttachField/SlipAttachField';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';
import { SHOW_ATTACHED_SLIP } from '../../lib/flags';

interface AddMoneyFormProps {
  bucketIcon: ReactNode;
  bucketName: string;
  saved: number;
  target: number;
  quickAmounts: number[];
  selectedQuickAmount: number | null;
  amountValue: string;
  slip: File | null;
  onQuickAmountSelect: (amount: number) => void;
  onAmountChange: (value: string) => void;
  onSlipChange: (file: File | null) => void;
  onSubmit: () => void | Promise<void>;
  onEditQuickAmounts?: () => void;
  smartDefaultHint?: string | null;
  mineLabel?: string;
  theirLabel?: string;
  mineSeries?: number[];
  theirSeries?: number[];
  submitting?: boolean;
}

export function AddMoneyForm({
  bucketIcon,
  bucketName,
  saved,
  target,
  quickAmounts,
  selectedQuickAmount,
  amountValue,
  slip,
  onQuickAmountSelect,
  onAmountChange,
  onSlipChange,
  onSubmit,
  onEditQuickAmounts,
  smartDefaultHint,
  mineLabel,
  theirLabel,
  mineSeries,
  theirSeries,
  submitting = false,
}: AddMoneyFormProps) {
  const { copy } = useI18n();
  const amount = Number(amountValue) || selectedQuickAmount || 0;
  const showTrendPreview = mineLabel && theirLabel && mineSeries && theirSeries;
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <BucketHeader icon={bucketIcon} name={bucketName} saved={saved} target={target} />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel tone="muted">{copy.addMoney.depositAmountLabel}</SectionLabel>
          {onEditQuickAmounts && (
            <button
              type="button"
              onClick={onEditQuickAmounts}
              className="inline-flex items-center gap-1 font-mono text-xs font-bold text-ink-muted hover:text-ink"
            >
              <IconEdit size={14} />
              {copy.addMoney.editQuickAmountsLabel}
            </button>
          )}
        </div>
        <QuickAddRow
          amounts={quickAmounts}
          selected={selectedQuickAmount}
          onSelect={onQuickAmountSelect}
        />
      </div>
      <FormField label={copy.addMoney.customAmountLabel}>
        <TextInput
          value={amountValue}
          inputMode="numeric"
          placeholder="1200"
          leadingIcon={<IconPiggyBank size={16} />}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onAmountChange(event.target.value)}
        />
      </FormField>
      {smartDefaultHint && (
        <p className="-mt-2 font-mono text-xs text-ink-muted">{smartDefaultHint}</p>
      )}
      <ProjectedProgressCard bucketName={bucketName} saved={saved} target={target} pendingDeposit={amount} />
      {showTrendPreview && (
        <ComparisonTrendChart
          mineLabel={mineLabel}
          theirLabel={theirLabel}
          mineSeries={mineSeries}
          theirSeries={theirSeries}
        />
      )}
      {SHOW_ATTACHED_SLIP && <SlipAttachField file={slip} onChange={onSlipChange} />}
      <Button variant="action" fullWidth type="submit" disabled={submitting || amount <= 0}>
        {submitting ? copy.savingPlan.savingButton : copy.addMoney.confirmDepositButton}
      </Button>
    </form>
  );
}
