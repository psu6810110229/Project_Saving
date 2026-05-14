import { palette } from '../../lib/theme';
import { chartIdentityColors, chartLegendLabel } from '../../lib/chartIdentity';
import { SectionLabel } from '../SectionLabel/SectionLabel';

/**
 * Dashboard 7-day deposit trend chart. SVG bar chart with one bar per
 * day; when a partner series is provided the chart renders two side-by-
 * side bars per day (you on the left, partner on the right) plus a small
 * legend so each color is identifiable. Chart colors are perspective-based:
 * orange = You/current account, green = Partner. Pure presentational —
 * parent passes pre-computed daily deposit totals (THB).
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
  /** Display name shown after "You" in the primary-series legend. */
  yourName?: string;
  /** Display name shown after "Partner" in the partner-series legend. */
  partnerName?: string;
  /**
   * Optional Saving Plan Expected Progress — planned daily amount per
   * day, same length as `series`. Drawn as a subtle horizontal tick
   * across each bar group so users can see whether their bar reaches
   * the plan target for that day. Not a deposit value.
   */
  expectedSeries?: number[];
}

const W = 280;
const H = 110;
const PAD_X = 8;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;

export function MomentumChart({
  series,
  partnerSeries,
  labels,
  yourName = 'You',
  partnerName = 'Partner',
  expectedSeries,
}: MomentumChartProps) {
  const hasPartner = Array.isArray(partnerSeries) && partnerSeries.length === series.length;
  const hasExpected = Array.isArray(expectedSeries) && expectedSeries.length === series.length;
  const max = Math.max(
    1,
    ...series,
    ...(hasPartner ? partnerSeries! : []),
    ...(hasExpected ? expectedSeries! : []),
  );
  const barCount = series.length;
  const groupGap = 6;
  const innerGap = hasPartner ? 2 : 0;
  const groupW = (W - PAD_X * 2 - groupGap * (barCount - 1)) / barCount;
  const barW = hasPartner ? (groupW - innerGap) / 2 : groupW;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  return (
    <section className="rounded-xl bg-surface shadow-soft p-5">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel tone="muted">Daily Deposit Trend</SectionLabel>
        <div className="flex max-w-[58%] flex-col items-end gap-1 font-mono text-[10px] text-ink-muted">
          <span className="inline-flex max-w-full items-center gap-1">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chartIdentityColors.you }} />
            <span className="truncate">{chartLegendLabel('You', yourName)}</span>
          </span>
          {hasPartner && (
            <span className="inline-flex max-w-full items-center gap-1">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chartIdentityColors.partner }} />
              <span className="truncate">{chartLegendLabel('Partner', partnerName)}</span>
            </span>
          )}
          {hasExpected && (
            <span className="inline-flex max-w-full items-center gap-1">
              <span
                className="inline-block h-[2px] w-3 shrink-0 rounded-full"
                style={{ backgroundColor: palette.inkMuted }}
              />
              <span className="truncate">Your plan</span>
            </span>
          )}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-3 w-full h-28"
        role="img"
        aria-label="7-day recorded deposit trend"
      >
        <title>
          Daily Deposit Trend. Orange bars are You. Green bars are Partner.
          {hasExpected ? ' Dashed ticks are the Saving Plan expected daily amount.' : ''}
        </title>
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
                fill={chartIdentityColors.you}
              />
              {hasPartner && (
                <rect
                  x={groupX + barW + innerGap}
                  y={partnerY}
                  width={barW}
                  height={partnerH || 2}
                  rx={3}
                  fill={chartIdentityColors.partner}
                />
              )}
              {hasExpected && expectedSeries![i] > 0 && (
                <line
                  x1={groupX - 1}
                  x2={groupX + groupW + 1}
                  y1={PAD_TOP + chartH - (expectedSeries![i] / max) * chartH}
                  y2={PAD_TOP + chartH - (expectedSeries![i] / max) * chartH}
                  stroke={palette.inkMuted}
                  strokeWidth={1}
                  strokeDasharray="2 2"
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
