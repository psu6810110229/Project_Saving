import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { BucketHeader } from '../BucketHeader/BucketHeader';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { IconEdit, IconPiggyBank } from '../Icon/Icon';
import { ProjectedProgressCard } from '../ProjectedProgressCard/ProjectedProgressCard';
import { QuickAddRow } from '../QuickAddRow/QuickAddRow';
import { SlipAttachField } from '../SlipAttachField/SlipAttachField';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';

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
  onSubmit: () => void;
  onEditQuickAmounts?: () => void;
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
}: AddMoneyFormProps) {
  const { copy } = useI18n();
  const amount = Number(amountValue) || selectedQuickAmount || 0;
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <BucketHeader icon={bucketIcon} name={bucketName} saved={saved} target={target} />
      <div className="flex flex-col gap-2">
        <QuickAddRow
          label={copy.addMoney.depositAmountLabel}
          amounts={quickAmounts}
          selected={selectedQuickAmount}
          onSelect={onQuickAmountSelect}
        />
        {onEditQuickAmounts && (
          <button
            type="button"
            onClick={onEditQuickAmounts}
            className="self-end inline-flex items-center gap-1 font-mono text-xs font-bold text-ink-muted hover:text-ink"
          >
            <IconEdit size={14} />
            {copy.addMoney.editQuickAmountsLabel}
          </button>
        )}
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
      <ProjectedProgressCard bucketName={bucketName} saved={saved} target={target} pendingDeposit={amount} />
      <SlipAttachField file={slip} onChange={onSlipChange} />
      <Button variant="action" fullWidth type="submit">{copy.addMoney.confirmDepositButton}</Button>
    </form>
  );
}
