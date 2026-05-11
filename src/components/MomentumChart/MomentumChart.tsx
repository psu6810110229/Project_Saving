import { palette } from '../../lib/theme';
import { SectionLabel } from '../SectionLabel/SectionLabel';

/**
 * Dashboard 7-day savings momentum chart. SVG bar chart with one bar per
 * day; the most-recent day is highlighted in brand-500, the rest in
 * muted ink. Pure presentational — parent passes pre-computed daily
 * totals (THB).
 *
 * Mobile-first: SVG scales to container width via viewBox preserveAspectRatio.
 */

interface MomentumChartProps {
  /** 7 values, oldest → newest. */
  series: number[];
  /** Optional weekday labels matching the series order (e.g. ['M','T',...]). */
  labels?: string[];
}

const W = 280;
const H = 96;
const PAD_X = 8;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;

export function MomentumChart({ series, labels }: MomentumChartProps) {
  const max = Math.max(1, ...series);
  const barCount = series.length;
  const gap = 6;
  const barW = (W - PAD_X * 2 - gap * (barCount - 1)) / barCount;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  return (
    <section className="rounded-3xl bg-surface shadow-soft p-5">
      <SectionLabel tone="muted">Daily Savings Trend</SectionLabel>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-3 w-full h-24"
        role="img"
        aria-label="7-day savings momentum"
      >
        {series.map((v, i) => {
          const h = (v / max) * chartH;
          const x = PAD_X + i * (barW + gap);
          const y = PAD_TOP + chartH - h;
          const isLast = i === series.length - 1;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h || 2}
                rx={3}
                fill={isLast ? palette.brand500 : palette.well}
                stroke={isLast ? 'none' : palette.inkDim}
                strokeWidth={isLast ? 0 : 0.5}
              />
              {labels?.[i] && (
                <text
                  x={x + barW / 2}
                  y={H - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="ui-monospace, monospace"
                  fill={palette.inkMuted}
                >
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
