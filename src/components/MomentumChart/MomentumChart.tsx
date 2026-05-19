import { useState } from 'react';
import { palette } from '../../lib/theme';
import { IconTrendingUp } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { formatCurrency } from '../../lib/format';
import { haptic } from '../../lib/haptics';

/**
 * Dashboard 7-day deposit trend chart. SVG bar chart with one bar per
 * day; when a partner series is provided the chart renders two side-by-
 * side bars per day (partner on the left, you on the right) under an
 * overlay trend line that traces the "you" bar tops.
 *
 * The visual treatment is ported from the Savings Performance reference
 * (`docs/design-references/graph-redesign/reference-chart-only.html`):
 * rounded-pill bar tops with a vertical gradient, a brand-orange trend
 * line with white-fill datapoints, and a "today" marker on the most
 * recent bar, set on a white card with a soft pale-navy border. Data
 * logic, props, calculations, and i18n keys are preserved from the
 * previous implementation; the `expectedSeries` and `weekExpected`
 * props remain on the API but are not rendered in this style (the
 * reference visual has no expected-plan overlay).
 */

interface MomentumChartProps {
  series: number[];
  partnerSeries?: number[];
  labels?: string[];
  yourName?: string;
  partnerName?: string;
  expectedSeries?: number[];
  todayIndex?: number;
  weekTotal?: number;
  weekExpected?: number;
}

/** Local colour overrides — match the reference chart only.
 *  Other charts continue to use `chartIdentityColors` from
 *  `lib/chartIdentity` so their visual identity is unchanged. */
const COLOR_YOU = palette.brand500;
const COLOR_PARTNER = '#4F6382';

const W = 280;
const H = 188;
const PAD_LEFT = 22;
const PAD_RIGHT = 4;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

/** Mono stack mirroring `tailwind.config.js > fontFamily.mono`, so Thai
 *  glyphs in SVG `<text>` fall through to IBM Plex Sans Thai instead of
 *  the system monospace fallback (which lacks Thai coverage). */
const SVG_MONO = '"IBM Plex Mono", "IBM Plex Sans Thai", ui-monospace, SFMono-Regular, monospace';

function fmtShort(v: number): string {
  if (v >= 10000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(v));
}

/** Catmull-Rom-to-cubic-Bezier smoother. Produces a soft curve that
 *  passes through every point with a configurable tension (lower =
 *  tighter to the points, higher = looser). */
function smoothPath(points: { x: number; y: number }[], tension = 0.85): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }
  let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 6;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 6;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 6;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 6;
    path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return path;
}

function roundedTopBar(x: number, y: number, w: number, h: number, r: number): string {
  const actualH = Math.max(h, 0);
  if (actualH === 0) return '';
  const actualR = Math.min(r, w / 2, actualH);
  return [
    `M ${x},${y + actualH}`,
    `L ${x},${y + actualR}`,
    `A ${actualR},${actualR} 0 0,1 ${x + actualR},${y}`,
    `L ${x + w - actualR},${y}`,
    `A ${actualR},${actualR} 0 0,1 ${x + w},${y + actualR}`,
    `L ${x + w},${y + actualH}`,
    'Z',
  ].join(' ');
}

export function MomentumChart({
  series,
  partnerSeries,
  labels,
  yourName,
  partnerName,
  expectedSeries,
  todayIndex,
  weekTotal,
  weekExpected,
}: MomentumChartProps) {
  const { copy } = useI18n();
  const d = copy.dashboard;
  // Self-identity in the legend always reads as "You" / "คุณ" regardless
  // of the supplied display name, so the chart speaks directly to the
  // viewer. The partner cell still uses the supplied display name.
  const resolvedYourName = d.youLabel;
  const resolvedPartnerName = partnerName ?? d.partnerLabel;
  const hasPartner = Array.isArray(partnerSeries) && partnerSeries.length === series.length;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Props preserved on the API for compatibility with existing
  // Dashboard / DashboardHero call sites; the reference visual does not
  // surface these.
  void yourName;
  void expectedSeries;
  void weekExpected;

  const rawMax = Math.max(
    1,
    ...series,
    ...(hasPartner ? partnerSeries! : []),
  );
  // Cap the y-axis at 1.25× the tallest bar so the chart hugs the data
  // and bars use more vertical space than a wide-rounded niceMax would.
  const max = rawMax * 1.25;

  const barCount = series.length;
  const groupGap = 2;
  const innerGap = hasPartner ? 1 : 0;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const groupW = (chartW - groupGap * (barCount - 3)) / barCount;
  const barW = hasPartner ? (groupW - innerGap) / 2.8 : groupW;
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const baselineY = PAD_TOP + chartH;

  const yourTotal = series.reduce((s, v) => s + v, 0);
  const partnerTotal = hasPartner ? partnerSeries!.reduce((s, v) => s + v, 0) : 0;
  // Header total: prefer the explicit weekTotal prop (your contribution)
  // when supplied, otherwise sum what the chart can see. The reference
  // shows a combined household total — when a partner series is present
  // we add the partner total in so the header matches that semantic.
  const headerTotal = typeof weekTotal === 'number'
    ? weekTotal + (hasPartner ? partnerTotal : 0)
    : yourTotal + partnerTotal;

  // Overlay polyline coordinates — through the top-centre of every
  // "you" bar so the trend line traces the primary series.
  const linePoints = series.map((v, i) => {
    const groupX = PAD_LEFT + i * (groupW + groupGap);
    const yourBarX = hasPartner ? groupX + barW + innerGap : groupX;
    const yourX = yourBarX + barW / 2;
    const yourH = (v / max) * chartH;
    const yourY = baselineY - yourH;
    return { x: yourX, y: yourY };
  });
  const trendCurveD = smoothPath(linePoints);

  const gridFractions = [0.25, 0.5, 0.75, 1];

  return (
    <section className="overflow-hidden rounded-[2rem] bg-surface px-6 pt-6 pb-5 text-ink shadow-soft">
      {/* Header + legend */}
      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="mb-2 flex items-center gap-2 font-mono text-lg font-bold leading-tight text-ink">
            <IconTrendingUp size={20} className="text-brand-500" />
            {d.dailyDepositTrend}
          </h2>
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-2xl font-bold leading-none text-ink">
              {formatCurrency(headerTotal)}
            </span>
            <span className="font-mono text-[12px] text-ink-muted/80">
              {d.last7Days}
            </span>
          </div>
        </div>

        <div className="mr-4 mt-0 flex shrink-0 flex-col gap-4">
          <LegendCell
            color={COLOR_YOU}
            glow="rgba(242,107,26,0.55)"
            name={resolvedYourName}
            total={yourTotal}
          />
          {hasPartner && (
            <LegendCell
              color={COLOR_PARTNER}
              glow="rgba(79,99,130,0.4)"
              name={resolvedPartnerName}
              total={partnerTotal}
            />
          )}
        </div>
      </div>

      {/* Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-0 h-[200px] w-full"
        role="img"
        aria-label={d.chartAriaLabel}
      >
        <title>{d.chartTitle(false)}</title>

        <defs>
          <linearGradient
            id="momYouFill"
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={PAD_TOP}
            x2={0}
            y2={baselineY}
          >
            <stop offset="0%" stopColor={COLOR_YOU} stopOpacity={1} />
            <stop offset="100%" stopColor={COLOR_YOU} stopOpacity={0.8} />
          </linearGradient>
          <linearGradient
            id="momPartnerFill"
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={PAD_TOP}
            x2={0}
            y2={baselineY}
          >
            <stop offset="0%" stopColor={COLOR_PARTNER} stopOpacity={1} />
            <stop offset="100%" stopColor={COLOR_PARTNER} stopOpacity={0.8} />
          </linearGradient>
        </defs>

        {/* Horizontal grid */}
        {gridFractions.map(t => {
          const y = baselineY - t * chartH;
          return (
            <line
              key={t}
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={y}
              y2={y}
              stroke="rgba(200,210,225,0.55)"
              strokeWidth={0.5}
            />
          );
        })}
        {/* Baseline */}
        <line
          x1={PAD_LEFT}
          x2={W - PAD_RIGHT}
          y1={baselineY}
          y2={baselineY}
          stroke="rgba(160,176,200,0.7)"
          strokeWidth={0.6}
        />

        {/* Y-axis labels — 0 / mid / max */}
        {[0, max / 2, max].map((tick, i) => {
          const y = baselineY - (tick / max) * chartH;
          return (
            <text
              key={`y-${i}`}
              x={PAD_LEFT - 0}
              y={y + 4.5}
              textAnchor="end"
              fontSize="10"
              fontWeight="300"
              fontFamily={SVG_MONO}
              fill={palette.ink}
            >
              {fmtShort(tick)}
            </text>
          );
        })}

        {/* Background dismiss layer — taps that miss a bar clear selection */}
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="transparent"
          onPointerDown={() => setSelectedIndex(null)}
        />

        {/* Bar groups */}
        {series.map((v, i) => {
          const groupX = PAD_LEFT + i * (groupW + groupGap);
          const partnerBarX = hasPartner ? groupX : null;
          const yourBarX = hasPartner ? groupX + barW + innerGap : groupX;
          const partnerVal = hasPartner ? partnerSeries![i] : 0;
          const yourH = (v / max) * chartH;
          const yourY = baselineY - yourH;
          const partnerH = (partnerVal / max) * chartH;
          const partnerY = baselineY - partnerH;
          const yourCenterX = yourBarX + barW / 2;
          const partnerCenterX = partnerBarX !== null ? partnerBarX + barW / 2 : 0;
          const dimmed = selectedIndex !== null && selectedIndex !== i;
          const barOpacity = dimmed ? 0.4 : 1;
          const delayBase = `${i * 60}ms`;

          return (
            <g key={i}>
              {/* Partner bar — left of the pair */}
              {hasPartner && (
                <g
                  className="animate-bar-grow"
                  style={{
                    transformOrigin: `${partnerCenterX}px ${baselineY}px`,
                    animationDelay: delayBase,
                  }}
                >
                  <path
                    d={roundedTopBar(partnerBarX!, partnerY, barW, Math.max(partnerH, 2), barW / 2)}
                    fill="url(#momPartnerFill)"
                    opacity={barOpacity}
                  />
                </g>
              )}
              {hasPartner && partnerVal > 0 && (
                <text
                  x={partnerCenterX}
                  y={partnerY - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="200"
                  fontFamily={SVG_MONO}
                  fill={COLOR_PARTNER}
                  opacity={barOpacity}
                  style={{ pointerEvents: 'none' }}
                >
                  {fmtShort(partnerVal)}
                </text>
              )}

              {/* You bar — right of the pair, or the only bar */}
              <g
                className="animate-bar-grow"
                style={{
                  transformOrigin: `${yourCenterX}px ${baselineY}px`,
                  animationDelay: `${i * 60 + 30}ms`,
                }}
              >
                <path
                  d={roundedTopBar(yourBarX, yourY, barW, Math.max(yourH, 2), barW / 2)}
                  fill="url(#momYouFill)"
                  opacity={barOpacity}
                />
              </g>
              {v > 0 && (
                <text
                  x={yourCenterX}
                  y={yourY - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="500"
                  fontFamily={SVG_MONO}
                  fill={COLOR_YOU}
                  opacity={barOpacity}
                  style={{ pointerEvents: 'none' }}
                >
                  {fmtShort(v)}
                </text>
              )}

              {/* X-axis label */}
              {labels?.[i] && (
                <text
                  x={groupX + groupW / 2}
                  y={H - 3}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight={todayIndex === i ? '1000' : '400'}
                  fontFamily={SVG_MONO}
                  fill={todayIndex === i ? COLOR_YOU : palette.ink}
                >
                  {labels[i]}
                </text>
              )}

              {/* Tap target — full group column for an easy hit area */}
              <rect
                x={groupX}
                y={PAD_TOP}
                width={groupW}
                height={chartH}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedIndex((prev) => (prev === i ? null : i));
                  haptic('success');
                }}
              />
            </g>
          );
        })}

        {/* Overlay trend line — a soft curve through every "you" bar top */}
        <path
          d={trendCurveD}
          fill="none"
          stroke={COLOR_YOU}
          strokeWidth={0.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0}
          style={{ pointerEvents: 'none' }}
        />
        {linePoints.map((p, i) => (
          <circle
            key={`pt-${i}`}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill="#FFFFFF"
            stroke={COLOR_YOU}
            strokeWidth={0.5}
            opacity={0}
            style={{ pointerEvents: 'none' }}
          />
        ))}

        {/* Today marker — slightly larger white pill on today's "you" bar */}
        {typeof todayIndex === 'number'
          && todayIndex >= 0
          && todayIndex < linePoints.length
          && (
            <circle
              cx={linePoints[todayIndex].x}
              cy={linePoints[todayIndex].y}
              r={3.2}
              fill="#FFFFFF"
              stroke={COLOR_YOU}
              strokeWidth={1.5}
              style={{ pointerEvents: 'none' }}
            />
          )}

        {/* Tooltip overlay */}
        {selectedIndex !== null && (() => {
          const i = selectedIndex;
          const v = series[i];
          const partnerVal = hasPartner ? partnerSeries![i] : 0;
          const groupX = PAD_LEFT + i * (groupW + groupGap);
          const anchorX = groupX + groupW / 2;
          const yourH = (v / max) * chartH;
          const yourY = baselineY - yourH;
          const partnerH = (partnerVal / max) * chartH;
          const partnerY = baselineY - partnerH;
          const topBarY = hasPartner ? Math.min(yourY, partnerY) : yourY;

          const lines = hasPartner
            ? [
              `${resolvedYourName} ${formatCurrency(v)}`,
              `${resolvedPartnerName} ${formatCurrency(partnerVal)}`,
            ]
            : [`${resolvedYourName} ${formatCurrency(v)}`];

          const fontSize = 9;
          const charW = 5.2;
          const rowH = 11;
          const padX = 6;
          const padY = 4;
          const longest = lines.reduce((m, s) => Math.max(m, s.length), 0);
          const boxW = Math.ceil(longest * charW) + padX * 2;
          const boxH = lines.length * rowH + padY * 2 - 2;
          const triH = 4;
          const gap = 4;
          const boxBottomY = topBarY - gap - triH;
          const boxTopY = boxBottomY - boxH;

          let boxX = anchorX - boxW / 2;
          const minX = PAD_LEFT - 2;
          const maxX = W - PAD_RIGHT + 2 - boxW;
          if (boxX < minX) boxX = minX;
          if (boxX > maxX) boxX = maxX;

          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={boxX}
                y={boxTopY}
                width={boxW}
                height={boxH}
                rx={4}
                ry={4}
                fill="#FFFFFF"
                stroke="rgba(160,176,200,0.7)"
                strokeWidth={0.75}
              />
              {lines.map((line, idx) => (
                <text
                  key={idx}
                  x={boxX + padX}
                  y={boxTopY + padY + (idx + 1) * rowH - 3}
                  fontSize={fontSize}
                  fontFamily={SVG_MONO}
                  fill={palette.ink}
                >
                  {line}
                </text>
              ))}
              <polygon
                points={`${anchorX - 3},${boxBottomY} ${anchorX + 3},${boxBottomY} ${anchorX},${boxBottomY + triH}`}
                fill="#FFFFFF"
                stroke="rgba(160,176,200,0.7)"
                strokeWidth={0.75}
              />
            </g>
          );
        })()}
      </svg>
    </section>
  );
}

interface LegendCellProps {
  color: string;
  glow: string;
  name: string;
  total: number;
}

function LegendCell({ color, glow, name, total }: LegendCellProps) {
  return (
    <div className="min-w-0">
      <div className="mb-0 flex items-center gap-2.5 font-mono text-[12px] text-ink-muted">
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${glow}` }}
        />
        <span className="truncate">{name}</span>
      </div>
      <div className="font-mono text-[14px] font-bold leading-tight text-ink">
        {formatCurrency(total)}
      </div>
    </div>
  );
}
