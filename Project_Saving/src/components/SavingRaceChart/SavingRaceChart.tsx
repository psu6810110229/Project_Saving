import { palette } from '../../lib/theme';
import { formatCurrency } from '../../lib/format';
import { SectionLabel } from '../SectionLabel/SectionLabel';

/**
 * "Saving Race" — cumulative 7-day line chart showing you vs. partner.
 * Two SVG polylines drawn on the same y-axis (max of both series).
 * Pure presentational; parent computes cumulative series + chooses the
 * scope (all buckets / per-bucket) via the parent-owned filter chip.
 *
 * The legend doubles as a totals readout so a glance gives both rank
 * and absolute value (each player's saved-so-far for the scope).
 */

interface SavingRaceChartProps {
  yourSeries: number[];
  partnerSeries: number[];
  labels: string[];
  yourName: string;
  partnerName: string;
  scopeLabel: string;
}

const W = 280;
const H = 110;
const PAD_X = 12;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;

export function SavingRaceChart({ yourSeries, partnerSeries, labels, yourName, partnerName, scopeLabel }: SavingRaceChartProps) {
  const max = Math.max(1, ...yourSeries, ...partnerSeries);
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const chartW = W - PAD_X * 2;
  const step = yourSeries.length > 1 ? chartW / (yourSeries.length - 1) : 0;
  const pointsFor = (series: number[]) => series
    .map((v, i) => `${PAD_X + i * step},${PAD_TOP + chartH - (v / max) * chartH}`)
    .join(' ');
  const yourTotal = yourSeries[yourSeries.length - 1] ?? 0;
  const partnerTotal = partnerSeries[partnerSeries.length - 1] ?? 0;

  return (
    <section className="rounded-3xl bg-surface shadow-soft p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel tone="muted">Saving Race</SectionLabel>
          <p className="mt-1 font-mono text-[11px] text-ink-muted">{scopeLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1 font-mono text-[10px] text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: palette.brand500 }} />
            {yourName}: {formatCurrency(yourTotal)}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: palette.accentTeal }} />
            {partnerName}: {formatCurrency(partnerTotal)}
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-3 w-full h-28"
        role="img"
        aria-label="Cumulative savings race"
      >
        {[0.25, 0.5, 0.75].map(frac => (
          <line
            key={frac}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_TOP + chartH * frac}
            y2={PAD_TOP + chartH * frac}
            stroke={palette.well}
            strokeWidth={0.5}
          />
        ))}
        <polyline
          fill="none"
          stroke={palette.brand500}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pointsFor(yourSeries)}
        />
        <polyline
          fill="none"
          stroke={palette.accentTeal}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pointsFor(partnerSeries)}
        />
        {labels.map((label, i) => (
          <text
            key={`${label}-${i}`}
            x={PAD_X + i * step}
            y={H - 4}
            textAnchor="middle"
            fontSize="9"
            fontFamily="ui-monospace, monospace"
            fill={palette.inkMuted}
          >
            {label}
          </text>
        ))}
      </svg>
    </section>
  );
}
