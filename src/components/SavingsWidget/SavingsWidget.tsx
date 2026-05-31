import { palette } from '../../lib/theme';
import { IconPlane } from '../Icon/Icon';

/**
 * 4×2 home-screen widget face (design preview).
 *
 * Reproduces the glanceable savings widget from the product mockup: a rounded
 * header pill (plane badge · today's goal · streak) stacked above a main card
 * that pairs a radial progress ring with the accumulated amount and a slim
 * horizontal progress bar.
 *
 * This is the display-only React rendition used as the single source of truth
 * for the look; the native Android `RemoteViews` layout (plan 59) mirrors it.
 * All numbers are props so the same face renders any room's snapshot.
 */

interface SavingsWidgetProps {
  /** Today's per-day saving goal, in baht. */
  todayGoal?: number;
  /** Current saving streak, in days. */
  streakDays?: number;
  /** Accumulated saved amount (verified balance), in baht. */
  saved?: number;
  /** Personal goal target, in baht. */
  target?: number;
  /** Progress percentage shown in the ring + bar (0–100). */
  progressPct?: number;
  className?: string;
}

const baht = (n: number) => `฿${n.toLocaleString('en-US')}`;

/** Radial ring matching the mockup: thick light track, rounded orange arc, start dot. */
function Ring({ pct }: { pct: number }) {
  const SIZE = 132;
  const STROKE = 15;
  const clamped = Math.max(0, Math.min(100, pct));
  const c = SIZE / 2;
  const r = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0" aria-hidden>
        <g transform={`rotate(-90 ${c} ${c})`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="#FBF4EC" strokeWidth={STROKE} />
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={palette.brand500}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </g>
        {/* Orange start dot anchored at 12 o'clock */}
        <circle cx={c} cy={STROKE / 2} r={STROKE / 2 + 1.5} fill={palette.brand500} />
      </svg>
      <div className="relative grid place-items-center text-center">
        <span className="font-mono text-2xl font-bold leading-none tabular-nums text-brand-500">{clamped}%</span>
        <span className="mt-1 font-mono text-[11px] font-medium leading-none text-ink-dim">of 100%</span>
      </div>
    </div>
  );
}

export function SavingsWidget({
  todayGoal = 160,
  streakDays = 7,
  saved = 1600,
  target = 70000,
  progressPct = 3,
  className = '',
}: SavingsWidgetProps) {
  const pct = Math.max(0, Math.min(100, progressPct));

  return (
    <div className={`flex w-full max-w-[380px] flex-col gap-2.5 ${className}`}>
      {/* Header pill — plane badge · today's goal · streak */}
      <div className="flex items-center justify-between gap-3 rounded-[22px] bg-gradient-to-br from-white to-surfaceAlt px-3.5 py-2.5 shadow-neuRaised">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 shadow-haloOrange">
            <IconPlane size={20} weight="fill" className="text-white" />
          </span>
          <span className="truncate font-mono text-[13px] font-bold leading-tight text-ink">
            เป้าหมายวันนี้ : {todayGoal} บาท
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[13px] font-bold leading-tight text-ink">
          <span aria-hidden className="text-base leading-none">🔥</span>
          ติดต่อกัน {streakDays} วัน
        </span>
      </div>

      {/* Main card — ring · accumulated amount · progress bar */}
      <div className="rounded-[28px] bg-gradient-to-br from-[#FBF1E7] to-[#F1E3D3] px-5 pb-4 pt-4 shadow-neuRaised">
        <div className="flex items-center gap-4">
          <Ring pct={pct} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[13px] font-medium leading-none text-ink-muted">ยอดสะสม</p>
            <p className="mt-2 font-mono text-[32px] font-bold leading-none tabular-nums text-ink">{baht(saved)}</p>
            <p className="mt-2 font-mono text-sm font-medium leading-none tabular-nums text-ink-dim">
              of {baht(target)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-pill bg-[#F4E8DA] shadow-neuPressed">
            <div
              className="h-full rounded-pill bg-brand-500"
              style={{ width: `${Math.max(pct, 4)}%` }}
            />
            <span className="absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-brand-500" />
          </div>
          <span className="font-mono text-[13px] font-bold leading-none tabular-nums text-ink">{pct}%</span>
        </div>
      </div>
    </div>
  );
}
