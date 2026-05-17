import type { CSSProperties } from 'react';
import { palette } from '../../lib/theme';
import { formatCurrency } from '../../lib/format';
import { chartIdentityColors, chartLegendLabel } from '../../lib/chartIdentity';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { useI18n } from '../../i18n/useI18n';

/**
 * "Deposit Race" — cumulative 7-day line chart showing you vs. partner.
 * Two SVG polylines drawn on the same y-axis (max of both series).
 * Pure presentational; parent computes cumulative series + chooses the
 * scope (all buckets / per-bucket) via the parent-owned filter chip.
 * Chart colors are perspective-based: orange = You/current account,
 * green = Partner.
 *
 * The legend doubles as a totals readout so a glance gives both rank
 * and absolute value (each player's recorded deposits for the scope).
 */

interface SavingRaceChartProps {
  yourSeries: number[];
  partnerSeries: number[];
  labels: string[];
  yourName: string;
  partnerName: string;
  scopeLabel: string;
  /**
   * Optional Saving Plan Expected cumulative for the same 7-day
   * window. Drawn as a subtle dashed polyline so users can see how
   * their recorded curve compares to the plan. Not a deposit value.
   */
  expectedSeries?: number[];
}

const W = 280;
const H = 110;
const PAD_X = 12;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;

export function SavingRaceChart({
  yourSeries,
  partnerSeries,
  labels,
  yourName,
  partnerName,
  scopeLabel,
  expectedSeries,
}: SavingRaceChartProps) {
  const { copy } = useI18n();
  const d = copy.dashboard;
  const hasExpected = Array.isArray(expectedSeries) && expectedSeries.length === yourSeries.length;
  const max = Math.max(
    1,
    ...yourSeries,
    ...partnerSeries,
    ...(hasExpected ? expectedSeries! : []),
  );
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const chartW = W - PAD_X * 2;
  const step = yourSeries.length > 1 ? chartW / (yourSeries.length - 1) : 0;
  const coordsFor = (series: number[]) => series
    .map((v, i) => [PAD_X + i * step, PAD_TOP + chartH - (v / max) * chartH] as const);
  const pointsFor = (series: number[]) => coordsFor(series)
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
  const lengthFor = (series: number[]) => {
    const pts = coordsFor(series);
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = pts[i][1] - pts[i - 1][1];
      total += Math.sqrt(dx * dx + dy * dy);
    }
    // Add a small buffer so the line never visually pre-clips on the
    // final pixel of the animation, and never falls below a usable
    // minimum for very-flat series.
    return Math.max(50, Math.ceil(total) + 4);
  };
  const yourLength = lengthFor(yourSeries);
  const partnerLength = lengthFor(partnerSeries);
  const drawStyle = (length: number, delay: string): CSSProperties => ({
    strokeDasharray: length,
    strokeDashoffset: length,
    ['--path-length' as never]: length,
    animation: 'line-draw 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    animationDelay: delay,
  });
  // The expected-plan polyline is intrinsically dashed, so we cannot
  // animate it via stroke-dashoffset without destroying its dash
  // pattern. Fade it in after the solid lines finish drawing instead.
  const expectedFadeStyle: CSSProperties = {
    opacity: 0,
    animation: 'line-fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    animationDelay: '0.9s',
  };
  const yourTotal = yourSeries[yourSeries.length - 1] ?? 0;
  const partnerTotal = partnerSeries[partnerSeries.length - 1] ?? 0;

  return (
    <section className="liquid-glass-warm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel tone="muted">{d.depositRace}</SectionLabel>
          <p className="mt-1 font-mono text-[11px] text-ink-muted">{scopeLabel}</p>
        </div>
        <div className="flex max-w-[58%] flex-col items-end gap-1 font-mono text-[10px] text-ink-muted">
          <span className="inline-flex max-w-full items-center gap-1">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chartIdentityColors.you }} />
            <span className="truncate">{chartLegendLabel(d.youLabel, yourName)}:</span>
            <span className="shrink-0">{formatCurrency(yourTotal)}</span>
          </span>
          <span className="inline-flex max-w-full items-center gap-1">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chartIdentityColors.partner }} />
            <span className="truncate">{chartLegendLabel(d.partnerLabel, partnerName)}:</span>
            <span className="shrink-0">{formatCurrency(partnerTotal)}</span>
          </span>
          {hasExpected && (
            <span className="inline-flex max-w-full items-center gap-1">
              <span
                className="inline-block h-[2px] w-3 shrink-0 rounded-full"
                style={{ backgroundColor: palette.inkMuted }}
              />
              <span className="truncate">{d.yourPlan}</span>
            </span>
          )}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-3 w-full h-28"
        role="img"
        aria-label={d.cumulativeRaceAria}
      >
        <title>{d.cumulativeRaceTitle(hasExpected)}</title>
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
          stroke={chartIdentityColors.you}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pointsFor(yourSeries)}
          style={drawStyle(yourLength, '0.1s')}
        />
        <polyline
          fill="none"
          stroke={chartIdentityColors.partner}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pointsFor(partnerSeries)}
          style={drawStyle(partnerLength, '0.2s')}
        />
        {hasExpected && (
          <polyline
            fill="none"
            stroke={palette.inkMuted}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={pointsFor(expectedSeries!)}
            style={expectedFadeStyle}
          />
        )}
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
