import { palette } from '../../lib/theme';
import { chartIdentityColors } from '../../lib/chartIdentity';
import { SectionLabel } from '../SectionLabel/SectionLabel';

/**
 * Dashboard 7-day deposit trend chart. SVG bar chart with one bar per
 * day; when a partner series is provided the chart renders two side-by-
 * side bars per day (you on the left, partner on the right).
 * Y-axis uses a nice rounded max so the scale is always clean.
 */

interface MomentumChartProps {
  series: number[];
  partnerSeries?: number[];
  labels?: string[];
  yourName?: string;
  partnerName?: string;
  expectedSeries?: number[];
}

const W = 280;
const H = 120;
const PAD_LEFT = 30;
const PAD_RIGHT = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 18;

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const steps = [1, 2, 5, 10];
  for (const s of steps) {
    if (s * mag >= v) return s * mag;
  }
  return 10 * mag;
}

function fmtShort(v: number): string {
  if (v >= 10000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(v));
}

export function MomentumChart({
  series,
  partnerSeries,
  labels,
  yourName: _yourName,
  partnerName = 'Partner',
  expectedSeries,
}: MomentumChartProps) {
  const hasPartner = Array.isArray(partnerSeries) && partnerSeries.length === series.length;
  const hasExpected = Array.isArray(expectedSeries) && expectedSeries.length === series.length;

  const rawMax = Math.max(
    1,
    ...series,
    ...(hasPartner ? partnerSeries! : []),
    ...(hasExpected ? expectedSeries! : []),
  );
  const max = niceMax(rawMax);

  const barCount = series.length;
  const groupGap = 6;
  const innerGap = hasPartner ? 2 : 0;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const groupW = (chartW - groupGap * (barCount - 1)) / barCount;
  const barW = hasPartner ? (groupW - innerGap) / 2 : groupW;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  const yTicks = [0, max / 2, max];

  return (
    <section className="rounded-xl bg-surface shadow-soft p-5">
      <div className="flex items-start justify-between gap-2">
        <SectionLabel tone="muted">Daily Deposit Trend</SectionLabel>
        <div className="flex flex-col items-end gap-1 font-mono text-[9px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: chartIdentityColors.you }}
            />
            You
          </span>
          {hasPartner && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: chartIdentityColors.partner }}
              />
              {partnerName}
            </span>
          )}
          {hasExpected && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-[2px] w-3 shrink-0 rounded-full"
                style={{ backgroundColor: palette.inkMuted }}
              />
              Your plan
            </span>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-3 w-full h-32"
        role="img"
        aria-label="7-day recorded deposit trend"
      >
        <title>
          Daily Deposit Trend. Orange bars are You. Green bars are Partner.
          {hasExpected ? ' Dashed ticks are the Saving Plan expected daily amount.' : ''}
        </title>

        {/* Y-axis grid lines + labels */}
        {yTicks.map((tick, i) => {
          const y = PAD_TOP + chartH - (tick / max) * chartH;
          return (
            <g key={`y-${i}`}>
              <line
                x1={PAD_LEFT}
                x2={W - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke={palette.well}
                strokeWidth={0.75}
              />
              <text
                x={PAD_LEFT - 3}
                y={y + 3.5}
                textAnchor="end"
                fontSize="7"
                fontFamily="ui-monospace, monospace"
                fill={palette.inkMuted}
              >
                {fmtShort(tick)}
              </text>
            </g>
          );
        })}

        {/* Bar groups */}
        {series.map((v, i) => {
          const groupX = PAD_LEFT + i * (groupW + groupGap);
          const yourH = (v / max) * chartH;
          const yourY = PAD_TOP + chartH - yourH;
          const partnerVal = hasPartner ? partnerSeries![i] : 0;
          const partnerH = (partnerVal / max) * chartH;
          const partnerY = PAD_TOP + chartH - partnerH;

          return (
            <g key={i}>
              {/* You bar */}
              <rect
                x={groupX}
                y={yourY}
                width={barW}
                height={yourH || 2}
                rx={2}
                fill={chartIdentityColors.you}
              />
              {v > 0 && yourH > 14 && (
                <text
                  x={groupX + barW / 2}
                  y={yourY - 3}
                  textAnchor="middle"
                  fontSize="7"
                  fontFamily="ui-monospace, monospace"
                  fill={chartIdentityColors.you}
                >
                  {fmtShort(v)}
                </text>
              )}

              {/* Partner bar */}
              {hasPartner && (
                <>
                  <rect
                    x={groupX + barW + innerGap}
                    y={partnerY}
                    width={barW}
                    height={partnerH || 2}
                    rx={2}
                    fill={chartIdentityColors.partner}
                  />
                  {partnerVal > 0 && partnerH > 14 && (
                    <text
                      x={groupX + barW + innerGap + barW / 2}
                      y={partnerY - 3}
                      textAnchor="middle"
                      fontSize="7"
                      fontFamily="ui-monospace, monospace"
                      fill={chartIdentityColors.partner}
                    >
                      {fmtShort(partnerVal)}
                    </text>
                  )}
                </>
              )}

              {/* Expected plan tick */}
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

              {/* X-axis label */}
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
