import { palette } from '../../lib/theme';
import { SectionLabel } from '../SectionLabel/SectionLabel';

/**
 * Dashboard 7-day savings momentum chart. SVG bar chart with one bar per
 * day; when a partner series is provided the chart renders two side-by-
 * side bars per day (you on the left, partner on the right) plus a small
 * legend so each color is identifiable. Pure presentational — parent
 * passes pre-computed daily totals (THB).
 *
 * Mobile-first: SVG scales to container width via viewBox preserveAspectRatio.
 */

interface MomentumChartProps {
  /** Your daily totals — 7 values, oldest → newest. */
  series: number[];
  /** Optional partner daily totals (same length as `series`). */
  partnerSeries?: number[];
  /** Optional weekday labels matching the series order (e.g. ['M','T',...]). */
  labels?: string[];
  /** Display name shown in the legend for the primary series. */
  yourName?: string;
  /** Display name shown in the legend for the partner series. */
  partnerName?: string;
}

const W = 280;
const H = 110;
const PAD_X = 8;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;

export function MomentumChart({ series, partnerSeries, labels, yourName = 'You', partnerName = 'Partner' }: MomentumChartProps) {
  const hasPartner = Array.isArray(partnerSeries) && partnerSeries.length === series.length;
  const max = Math.max(1, ...series, ...(hasPartner ? partnerSeries! : []));
  const barCount = series.length;
  const groupGap = 6;
  const innerGap = hasPartner ? 2 : 0;
  const groupW = (W - PAD_X * 2 - groupGap * (barCount - 1)) / barCount;
  const barW = hasPartner ? (groupW - innerGap) / 2 : groupW;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  return (
    <section className="rounded-3xl bg-surface shadow-soft p-5">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel tone="muted">Daily Savings Trend</SectionLabel>
        {hasPartner && (
          <div className="flex items-center gap-3 font-mono text-[10px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: palette.brand500 }} />
              {yourName}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: palette.accentTeal }} />
              {partnerName}
            </span>
          </div>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-3 w-full h-28"
        role="img"
        aria-label="7-day savings momentum"
      >
        {series.map((v, i) => {
          const groupX = PAD_X + i * (groupW + groupGap);
          const yourH = (v / max) * chartH;
          const yourY = PAD_TOP + chartH - yourH;
          const partnerVal = hasPartner ? partnerSeries![i] : 0;
          const partnerH = (partnerVal / max) * chartH;
          const partnerY = PAD_TOP + chartH - partnerH;
          return (
            <g key={i}>
              <rect
                x={groupX}
                y={yourY}
                width={barW}
                height={yourH || 2}
                rx={3}
                fill={palette.brand500}
              />
              {hasPartner && (
                <rect
                  x={groupX + barW + innerGap}
                  y={partnerY}
                  width={barW}
                  height={partnerH || 2}
                  rx={3}
                  fill={palette.accentTeal}
                />
              )}
              {labels?.[i] && (
                <text
                  x={groupX + groupW / 2}
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
