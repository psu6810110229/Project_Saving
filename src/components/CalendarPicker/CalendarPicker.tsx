import { useState } from 'react';
import { IconArrowLeft, IconArrowRight } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';

// ── Types ─────────────────────────────────────────────────────

interface CalendarPickerSingleProps {
  mode?: 'single';
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  getAmountForDate?: (dateKey: string) => number | undefined;
}

interface CalendarPickerRangeProps {
  mode: 'range';
  rangeStart: string;
  rangeEnd: string;
  onRangeChange: (start: string, end: string) => void;
  minDate?: string;
  getAmountForDate?: (dateKey: string) => number | undefined;
}

type CalendarPickerProps = CalendarPickerSingleProps | CalendarPickerRangeProps;

// ── Helpers ───────────────────────────────────────────────────

function parseYMD(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

function toYMD(y: number, mo: number, d: number) {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fmtShortAmount(v: number): string {
  if (v >= 10000) return `฿${Math.round(v / 1000)}k`;
  if (v >= 1000) return `฿${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `฿${Math.round(v)}`;
}

// ── Component ─────────────────────────────────────────────────

export function CalendarPicker(props: CalendarPickerProps) {
  const { copy } = useI18n();
  const cal = copy.calendar;
  const isRange = props.mode === 'range';

  // Resolve initial view month from value/rangeStart
  const seedDate = isRange
    ? parseYMD((props as CalendarPickerRangeProps).rangeStart)
    : parseYMD((props as CalendarPickerSingleProps).value);
  const now = new Date();

  const [viewYear, setViewYear] = useState(seedDate?.y ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(seedDate?.mo ?? (now.getMonth() + 1));
  // Range mode: tracks which endpoint the next tap sets
  const [picking, setPicking] = useState<'start' | 'end'>('start');

  const minParsed = props.minDate ? parseYMD(props.minDate) : null;
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();

  // Resolved selections
  const selectedSingle = !isRange ? parseYMD((props as CalendarPickerSingleProps).value) : null;

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }

  function isDisabled(d: number): boolean {
    if (!minParsed) return false;
    if (viewYear !== minParsed.y) return viewYear < minParsed.y;
    if (viewMonth !== minParsed.mo) return viewMonth < minParsed.mo;
    return d < minParsed.d;
  }

  function handleTap(d: number) {
    if (isDisabled(d)) return;
    const key = toYMD(viewYear, viewMonth, d);

    if (!isRange) {
      (props as CalendarPickerSingleProps).onChange(key);
      return;
    }

    const { rangeStart, rangeEnd, onRangeChange } = props as CalendarPickerRangeProps;
    const bothSet = rangeStart && rangeEnd;

    if (bothSet || picking === 'start') {
      // Reset: this tap becomes the new start
      onRangeChange(key, '');
      setPicking('end');
    } else {
      // Second tap: set end (must be >= start)
      if (rangeStart && key >= rangeStart) {
        onRangeChange(rangeStart, key);
        setPicking('start');
      } else {
        // Tapped before start → become new start
        onRangeChange(key, '');
        setPicking('end');
      }
    }
  }

  // Build grid: blank prefix + days, padded to full rows
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function cellStyle(d: number) {
    const key = toYMD(viewYear, viewMonth, d);
    const disabled = isDisabled(d);

    if (!isRange) {
      const selected =
        !!selectedSingle &&
        selectedSingle.y === viewYear &&
        selectedSingle.mo === viewMonth &&
        selectedSingle.d === d;
      return { selected, inRange: false, isRangeStart: false, isRangeEnd: false, disabled };
    }

    const { rangeStart, rangeEnd } = props as CalendarPickerRangeProps;
    const isRangeStart = !!rangeStart && key === rangeStart;
    const isRangeEnd = !!rangeEnd && key === rangeEnd;
    const inRange =
      !!rangeStart && !!rangeEnd && key > rangeStart && key < rangeEnd;

    return { selected: isRangeStart || isRangeEnd, inRange, isRangeStart, isRangeEnd, disabled };
  }

  return (
    <div className="rounded-xl bg-surface shadow-soft p-4">
      {/* Month / year navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-well active:scale-95 transition-all"
          aria-label={cal.prevMonthAria}
        >
          <IconArrowLeft size={16} className="text-ink" />
        </button>
        <span className="font-mono text-sm font-bold text-ink">
          {cal.monthNames[viewMonth - 1]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-well active:scale-95 transition-all"
          aria-label={cal.nextMonthAria}
        >
          <IconArrowRight size={16} className="text-ink" />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {cal.dayLabels.map((day, i) => (
          <div key={i} className="text-center font-mono text-[10px] text-ink-dim py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;
          const { selected, inRange, disabled } = cellStyle(day);
          const dateKey = toYMD(viewYear, viewMonth, day);
          const amount = props.getAmountForDate?.(dateKey);

          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => handleTap(day)}
              className={[
                'flex flex-col items-center justify-center rounded-lg py-1.5 transition-all',
                selected
                  ? 'bg-brand-500 text-ink-inverse'
                  : inRange
                  ? 'bg-brand-100 text-brand-800'
                  : disabled
                  ? 'opacity-30 cursor-not-allowed text-ink'
                  : 'hover:bg-well active:scale-95 text-ink',
              ].join(' ')}
            >
              <span className="font-mono text-xs font-bold leading-none">{day}</span>
              {amount != null && amount > 0 && (
                <span
                  className={[
                    'font-mono leading-none mt-0.5 text-[8px]',
                    selected ? 'text-ink-inverse opacity-80' : inRange ? 'text-brand-700' : 'text-ink-muted',
                  ].join(' ')}
                >
                  {fmtShortAmount(amount)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Range mode hint */}
      {isRange && (
        <p className="mt-3 text-center font-mono text-[10px] text-ink-dim">
          {picking === 'start' || !(props as CalendarPickerRangeProps).rangeStart
            ? cal.tapStartDate
            : !(props as CalendarPickerRangeProps).rangeEnd
            ? cal.tapEndDate
            : cal.tapChangeStart}
        </p>
      )}
    </div>
  );
}
