import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '../Button/Button';
import { BucketRow } from '../BucketRow/BucketRow';
import { ProjectedProgressCard } from '../ProjectedProgressCard/ProjectedProgressCard';
import { QuickAddRow } from '../QuickAddRow/QuickAddRow';

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
  const [selectedAmount, setSelectedAmount] = useState(quickAmounts[1] ?? quickAmounts[0] ?? 100);
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (selectedAmount <= 0) return;
    setSaving(true);
    const result = await onConfirm(selectedAmount);
    setSaving(false);
    if (!result.error) onCancel();
  }

  return (
    <div className="rounded-2xl bg-surface shadow-soft">
      <BucketRow icon={icon} name={name} saved={saved} target={target} onClick={onToggle} />
      {expanded && (
        <div className="flex flex-col gap-4 border-t border-well px-3 pb-4 pt-3 animate-fade-in">
          <QuickAddRow amounts={quickAmounts} selected={selectedAmount} onSelect={setSelectedAmount} label="Quick Add" />
          <ProjectedProgressCard bucketName={name} saved={saved} target={target} pendingDeposit={selectedAmount} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="md" onClick={onCancel}>Cancel</Button>
            <Button variant="action" size="md" disabled={saving} onClick={handleConfirm}>
              {saving ? 'Saving' : 'Confirm'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
