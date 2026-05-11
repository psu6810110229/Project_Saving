import { Pill } from '../Pill/Pill';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { formatCurrency } from '../../lib/format';

/**
 * Add Money "quick-add" pill row (+50 / +150 / +500 / ...). Controlled —
 * parent owns `selected` and gets the chosen amount via `onSelect`.
 *
 * Mobile-first: wraps to two lines on very narrow screens.
 */

interface QuickAddRowProps {
  amounts: number[];
  selected?: number | null;
  onSelect: (amount: number) => void;
  /** Optional label above the row ("DEPOSIT AMOUNT"). */
  label?: string;
}

export function QuickAddRow({ amounts, selected, onSelect, label }: QuickAddRowProps) {
  return (
    <div>
      {label && <SectionLabel tone="muted">{label}</SectionLabel>}
      <div className={`flex flex-wrap gap-2 ${label ? 'mt-3' : ''}`}>
        {amounts.map(amount => (
          <Pill
            key={amount}
            selected={selected === amount}
            onClick={() => onSelect(amount)}
          >
            +{formatCurrency(amount)}
          </Pill>
        ))}
      </div>
    </div>
  );
}
