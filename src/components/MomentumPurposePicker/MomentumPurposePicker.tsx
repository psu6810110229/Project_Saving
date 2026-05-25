import type { BucketCategory } from '../../types';
import type { MomentumPurposeScope } from '../../lib/momentumPurpose';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { haptic } from '../../lib/haptics';
import { useI18n } from '../../i18n/useI18n';

interface MomentumPurposePickerProps {
  categories: BucketCategory[];
  value: MomentumPurposeScope;
  onChange: (next: MomentumPurposeScope) => void;
}

export function MomentumPurposePicker({ categories, value, onChange }: MomentumPurposePickerProps) {
  const { copy } = useI18n();
  const d = copy.dashboard;
  const catLabels = copy.bucket.categoryLabels;

  const isAll = value.kind === 'all';

  return (
    <div
      role="tablist"
      aria-label={d.dailyDepositPurposeAria}
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1.5"
    >
      <PurposeChip
        active={isAll}
        label={d.dailyDepositPurposeAll}
        onClick={() => {
          onChange({ kind: 'all' });
          haptic('success');
        }}
      />
      {categories.map(cat => (
        <PurposeChip
          key={cat}
          active={value.kind === 'category' && value.category === cat}
          label={catLabels[cat]}
          icon={<BucketCategoryIcon category={cat} size={14} />}
          onClick={() => {
            onChange({ kind: 'category', category: cat });
            haptic('success');
          }}
        />
      ))}
    </div>
  );
}

interface PurposeChipProps {
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

function PurposeChip({ active, label, icon, onClick }: PurposeChipProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-1.5 font-mono text-[11px] font-bold transition-colors '
        + (active
          ? 'bg-brand-500 text-ink-inverse shadow-[0_4px_12px_rgba(242,107,26,0.28)]'
          : 'bg-well text-ink-muted shadow-[inset_2px_2px_5px_rgba(120,89,61,0.12),inset_-2px_-2px_5px_rgba(255,255,255,0.5)]')
      }
    >
      {icon && <span className={active ? 'text-ink-inverse' : 'text-ink-muted'}>{icon}</span>}
      <span className="truncate">{label}</span>
    </button>
  );
}
