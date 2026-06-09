import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { BucketHeader } from '../BucketHeader/BucketHeader';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { IconPiggyBank } from '../Icon/Icon';
import { QuickAddRow } from '../QuickAddRow/QuickAddRow';
import { SlipAttachField } from '../SlipAttachField/SlipAttachField';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';
import { cleanQuickAmounts, resolveDepositAmount } from '../../lib/deposit';
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
  submitting = false,
}: AddMoneyFormProps) {
  const { copy } = useI18n();
  const amount = resolveDepositAmount(amountValue, selectedQuickAmount);
  const cleanedQuickAmounts = cleanQuickAmounts(quickAmounts);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <BucketHeader icon={bucketIcon} name={bucketName} saved={saved} target={target} pendingDeposit={amount} />
      <FormField label={copy.addMoney.customAmountLabel}>
        <TextInput
          value={amountValue}
          inputMode="numeric"
          placeholder="1200"
          leadingIcon={<IconPiggyBank size={16} />}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onAmountChange(event.target.value)}
        />
      </FormField>
      {cleanedQuickAmounts.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              {copy.addMoney.depositAmountLabel}
            </p>
            {onEditQuickAmounts && (
              <button
                type="button"
                onClick={onEditQuickAmounts}
                className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand-800"
              >
                {copy.addMoney.editQuickAmountsLabel}
              </button>
            )}
          </div>
          <QuickAddRow
            amounts={cleanedQuickAmounts}
            selected={selectedQuickAmount}
            onSelect={amount => {
              onQuickAmountSelect(amount);
              if (amountValue) onAmountChange('');
            }}
          />
        </div>
      )}
      {SHOW_ATTACHED_SLIP && <SlipAttachField file={slip} onChange={onSlipChange} />}
      <Button variant="action" fullWidth type="submit" disabled={submitting || amount <= 0}>
        {submitting ? copy.savingPlan.savingButton : copy.addMoney.confirmDepositButton}
      </Button>
    </form>
  );
}
