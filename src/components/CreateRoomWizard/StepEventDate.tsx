import { useMemo } from 'react';
import { Button } from '../Button/Button';
import { CalendarPicker } from '../CalendarPicker/CalendarPicker';
import { IconArrowLeft, IconImage } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';

interface StepEventDateProps {
  endDate: string;
  onEndDateChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function countdownMessage(
  endDate: string,
  today: string,
  formatter: (months: number) => string,
  formatterDays: (days: number) => string,
): string | null {
  if (!endDate) return null;
  const end = new Date(endDate + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  if (isNaN(end.getTime())) return null;

  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return null;

  const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(totalDays / 30);

  if (months >= 1) return formatter(months);
  return formatterDays(totalDays);
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function StepEventDate({
  endDate,
  onEndDateChange,
  onNext,
  onBack,
}: StepEventDateProps) {
  const { copy } = useI18n();
  const c = copy.createRoomWizard;

  const today = useMemo(() => todayKey(), []);
  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const countdown = countdownMessage(endDate, today, c.countdownMonths, c.countdownDays);
  const valid = endDate > today;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-mono text-2xl font-bold text-ink">{c.stepEventDateTitle}</h2>
        <p className="mt-1 font-mono text-sm text-ink-muted">{c.stepEventDateSubtitle}</p>
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-soft">
        <CalendarPicker
          value={endDate}
          onChange={onEndDateChange}
          minDate={minDate}
        />
      </div>

      {countdown && (
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-center">
          <p className="font-mono text-sm font-bold text-brand-800">{countdown}</p>
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl bg-surfaceAlt shadow-soft">
        <div className="flex aspect-[16/9] items-center justify-center bg-brand-100/50">
          <div className="flex flex-col items-center gap-2 text-ink-dim">
            <IconImage size={32} />
            <span className="font-mono text-xs">{c.coverImagePlaceholder}</span>
          </div>
        </div>
        <button
          type="button"
          disabled
          className="absolute bottom-3 right-3 rounded-pill bg-surface/80 px-3 py-1.5 font-mono text-xs font-bold text-ink-muted shadow-soft backdrop-blur-sm disabled:opacity-50"
        >
          {c.changeCoverButton}
        </button>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" size="lg" onClick={onBack}>
          <IconArrowLeft size={16} />
        </Button>
        <Button variant="primary" fullWidth disabled={!valid} onClick={onNext}>
          {c.nextButton}
        </Button>
      </div>
    </div>
  );
}
