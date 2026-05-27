import { IconChevronLeft, IconChevronRight } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';

interface ReminderDayPickerProps {
  value: number;
  onChange: (day: number) => void;
  valueLabel: (day: number) => string;
  decreaseAriaLabel: string;
  increaseAriaLabel: string;
}

const QUICK_DAYS = [1, 5, 10, 15, 20, 25, 28] as const;

function clampDay(day: number): number {
  return Math.min(28, Math.max(1, day));
}

export function ReminderDayPicker({
  value,
  onChange,
  valueLabel,
  decreaseAriaLabel,
  increaseAriaLabel,
}: ReminderDayPickerProps) {
  const safeValue = clampDay(value);

  return (
    <div className="rounded-xl bg-well p-3">
      <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
        <IconButton
          type="button"
          variant="ghost"
          size="md"
          ariaLabel={decreaseAriaLabel}
          disabled={safeValue <= 1}
          onClick={() => onChange(clampDay(safeValue - 1))}
        >
          <IconChevronLeft size={18} />
        </IconButton>
        <div className="rounded-xl bg-surface px-4 py-3 text-center shadow-neuPressed">
          <p className="font-mono text-lg font-bold text-ink">{valueLabel(safeValue)}</p>
        </div>
        <IconButton
          type="button"
          variant="ghost"
          size="md"
          ariaLabel={increaseAriaLabel}
          disabled={safeValue >= 28}
          onClick={() => onChange(clampDay(safeValue + 1))}
        >
          <IconChevronRight size={18} />
        </IconButton>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {QUICK_DAYS.map(day => {
          const selected = safeValue === day;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(day)}
              className={[
                'h-9 rounded-lg font-mono text-xs font-bold transition-colors',
                selected
                  ? 'bg-brand-500 text-ink-inverse shadow-haloOrange'
                  : 'bg-surface text-ink-muted hover:bg-brand-50 hover:text-ink',
              ].join(' ')}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
