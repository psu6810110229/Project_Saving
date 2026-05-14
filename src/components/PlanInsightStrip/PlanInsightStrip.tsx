import { Chip } from '../Chip/Chip';
import { formatCurrency } from '../../lib/format';

interface PeriodInsight {
  recorded: number;
  expected: number;
}

interface PlanInsightStripProps {
  week: PeriodInsight;
  month: PeriodInsight;
}

type PeriodTone = 'ahead' | 'behind' | 'on_track';

const TONE_TO_CHIP: Record<PeriodTone, 'leaf' | 'peach' | 'danger'> = {
  ahead: 'leaf',
  on_track: 'peach',
  behind: 'danger',
};

const TONE_LABEL: Record<PeriodTone, string> = {
  ahead: 'Ahead',
  on_track: 'On track',
  behind: 'Behind',
};

function toneFor(p: PeriodInsight): PeriodTone {
  const delta = p.recorded - p.expected;
  if (Math.abs(delta) < 0.5) return 'on_track';
  return delta > 0 ? 'ahead' : 'behind';
}

/**
 * Compact strip showing recorded vs Saving Plan expected progress for
 * the current Bangkok week and month. Uses Recorded Deposits only —
 * Verified Balance is intentionally not mixed in here.
 */
export function PlanInsightStrip({ week, month }: PlanInsightStripProps) {
  return (
    <section className="rounded-3xl bg-brand-50 p-4 shadow-soft">
      <div className="grid grid-cols-2 gap-3">
        <PeriodTile label="This week" {...week} />
        <PeriodTile label="This month" {...month} />
      </div>
    </section>
  );
}

function PeriodTile({ label, recorded, expected }: { label: string } & PeriodInsight) {
  const tone = toneFor({ recorded, expected });
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-muted">
          {label}
        </p>
        <Chip tone={TONE_TO_CHIP[tone]}>{TONE_LABEL[tone]}</Chip>
      </div>
      <p className="mt-2 font-mono text-base font-bold text-ink">
        {formatCurrency(Math.round(recorded))}
      </p>
      <p className="mt-0.5 font-mono text-xs text-ink-muted">
        of {formatCurrency(Math.round(expected))} planned
      </p>
    </div>
  );
}
