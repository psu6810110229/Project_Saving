import type { ChangeEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '../Button/Button';
import { BucketRow } from '../BucketRow/BucketRow';
import { FormField } from '../FormField/FormField';
import { IconPiggyBank, IconTrash } from '../Icon/Icon';
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
  /**
   * Optional destructive action — when provided, a small ghost
   * "Delete bucket" link appears at the bottom of the expanded panel.
   * The parent is responsible for showing a confirmation modal.
   */
  onDelete?: () => void;
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
  onDelete,
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
    <div className="rounded-lg bg-surface shadow-soft">
      <BucketRow icon={icon} name={name} saved={saved} target={target} onClick={onToggle} expanded={expanded} />
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 border-t border-well px-3 pb-4 pt-3">
            <QuickAddRow amounts={quickAmounts} selected={selectedPill} onSelect={handlePillSelect} label="Quick Add" />
            <FormField label="Custom Amount">
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
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center justify-center gap-1.5 self-center rounded-pill px-3 py-1.5 font-mono text-xs font-bold text-danger hover:bg-danger-soft active:scale-[0.98] transition-all"
              >
                <IconTrash size={14} />
                <span>Delete bucket</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
