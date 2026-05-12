import type { ChangeEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '../Button/Button';
import { BucketRow } from '../BucketRow/BucketRow';
import { FormField } from '../FormField/FormField';
import { IconPiggyBank } from '../Icon/Icon';
import { ProjectedProgressCard } from '../ProjectedProgressCard/ProjectedProgressCard';
import { QuickAddRow } from '../QuickAddRow/QuickAddRow';
import { TextInput } from '../TextInput/TextInput';

interface BucketRowExpandableProps {
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
  quickAmounts: number[];
  expanded: boolean;
  onToggle: () => void;
  onCancel: () => void;
  onConfirm: (amount: number) => Promise<{ error?: string }>;
}

/**
 * Expandable bucket row used on the Dashboard. Tap the row to expand;
 * inside the expansion the user picks a quick-add pill OR types a
 * custom amount. Custom-amount entry deselects the pill, and vice
 * versa, so the resolved deposit is always unambiguous.
 */
export function BucketRowExpandable({
  icon,
  name,
  saved,
  target,
  quickAmounts,
  expanded,
  onToggle,
  onCancel,
  onConfirm,
}: BucketRowExpandableProps) {
  const defaultPill = quickAmounts[1] ?? quickAmounts[0] ?? 100;
  const [selectedPill, setSelectedPill] = useState<number | null>(defaultPill);
  const [customValue, setCustomValue] = useState('');
  const [saving, setSaving] = useState(false);

  const customAmount = Number(customValue);
  const resolvedAmount = customValue.trim() !== '' && customAmount > 0
    ? customAmount
    : (selectedPill ?? 0);

  function handlePillSelect(amount: number) {
    setSelectedPill(amount);
    if (customValue.trim() !== '') setCustomValue('');
  }

  function handleCustomChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setCustomValue(next);
    if (next.trim() !== '' && selectedPill !== null) setSelectedPill(null);
  }

  async function handleConfirm() {
    if (resolvedAmount <= 0) return;
    setSaving(true);
    const result = await onConfirm(resolvedAmount);
    setSaving(false);
    if (!result.error) {
      setCustomValue('');
      setSelectedPill(defaultPill);
      onCancel();
    }
  }

  return (
    <div className="rounded-2xl bg-surface shadow-soft">
      <BucketRow icon={icon} name={name} saved={saved} target={target} onClick={onToggle} />
      {expanded && (
        <div className="flex flex-col gap-4 border-t border-well px-3 pb-4 pt-3 animate-fade-in">
          <QuickAddRow amounts={quickAmounts} selected={selectedPill} onSelect={handlePillSelect} label="Quick Add" />
          <FormField label="Custom Amount" helper="Type any amount; quick-add will deselect.">
            <TextInput
              value={customValue}
              inputMode="numeric"
              placeholder="1200"
              leadingIcon={<IconPiggyBank size={16} />}
              onChange={handleCustomChange}
            />
          </FormField>
          <ProjectedProgressCard bucketName={name} saved={saved} target={target} pendingDeposit={resolvedAmount} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="md" onClick={onCancel}>Cancel</Button>
            <Button variant="action" size="md" disabled={saving || resolvedAmount <= 0} onClick={handleConfirm}>
              {saving ? 'Saving' : 'Confirm'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
