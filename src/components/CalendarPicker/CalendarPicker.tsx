import { useState } from 'react';
import { IconArrowLeft, IconArrowRight, IconCheck, IconFlag } from '../Icon/Icon';
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
          const { selected, inRange, isRangeStart, isRangeEnd, disabled } = cellStyle(day);
          const dateKey = toYMD(viewYear, viewMonth, day);
          const amount = props.getAmountForDate?.(dateKey);
          const hasAmount = amount != null && amount > 0;
          const isRangePreviewCell = isRange && (inRange || isRangeStart || isRangeEnd);
          const rangeShape = isRangeStart && isRangeEnd
            ? 'rounded-[1rem]'
            : isRangeStart
              ? 'rounded-l-[1rem] rounded-r-[0.35rem]'
              : isRangeEnd
                ? 'rounded-r-[1rem] rounded-l-[0.35rem]'
                : inRange
                  ? 'rounded-none'
                  : 'rounded-[1rem]';
          const toneClass = isRangeStart
            ? 'bg-accent-leaf text-ink-inverse shadow-[0_10px_18px_rgba(91,145,67,0.24)]'
            : isRangeEnd
              ? 'bg-danger text-ink-inverse shadow-[0_10px_18px_rgba(212,73,48,0.22)]'
              : selected
                ? 'bg-brand-500 text-ink-inverse shadow-[0_10px_18px_rgba(245,115,22,0.26)]'
              : inRange
                ? 'bg-brand-100 text-brand-900'
                : disabled
                  ? 'opacity-30 cursor-not-allowed text-ink'
                  : hasAmount
                    ? 'bg-brand-50 text-ink hover:bg-brand-100 active:scale-95'
                    : 'text-ink hover:bg-well active:scale-95';

          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => handleTap(day)}
              className={[
                'relative flex min-h-[3.35rem] flex-col items-center justify-center px-1 py-1.5 transition-all',
                isRangePreviewCell ? '-mx-px -my-px z-[1]' : '',
                rangeShape,
                toneClass,
              ].join(' ')}
            >
              {isRangeStart && (
                <span className="absolute left-1.5 top-1.5 text-ink-inverse/90" aria-hidden>
                  <IconCheck size={10} strokeWidth={3} />
                </span>
              )}
              {isRangeEnd && (
                <span className="absolute left-1.5 top-1.5 text-ink-inverse/90" aria-hidden>
                  <IconFlag size={10} strokeWidth={3} />
                </span>
              )}
              <span className="font-mono text-xs font-bold leading-none">{day}</span>
              {hasAmount && (
                <span
                  className={[
                    'mt-1 rounded-pill px-1.5 py-[2px] font-mono text-[8px] font-semibold leading-none',
                    selected
                      ? 'bg-white/18 text-ink-inverse'
                      : inRange
                        ? 'bg-white/80 text-brand-700'
                        : 'bg-white text-brand-700',
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
        <p className="mt-3 text-center font-mono text-[11px] text-ink-dim">
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
