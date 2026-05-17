import type { CSSProperties } from 'react';
import { palette } from '../../lib/theme';
import { SectionLabel } from '../SectionLabel/SectionLabel';

/**
 * Confirm Deposit two-line trend chart. Phan vs Art cumulative savings
 * over the last N days, each rendered as a sparkline. The user's line is
 * brand-500 + filled below; the opponent's line is muted ink dashed.
 *
 * Pure SVG. Mobile-first: scales to container width via viewBox.
 */

interface ComparisonTrendChartProps {
  mineSeries: number[];
  theirSeries: number[];
  mineLabel: string;
  theirLabel: string;
}

const W = 280;
const H = 80;
const PAD = 6;

function pathFor(series: number[], max: number) {
  if (series.length === 0) return '';
  const step = (W - PAD * 2) / Math.max(1, series.length - 1);
  return series
    .map((v, i) => {
      const x = PAD + i * step;
      const y = PAD + (H - PAD * 2) * (1 - v / Math.max(1, max));
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function pathLength(series: number[], max: number) {
  if (series.length < 2) return 50;
  const step = (W - PAD * 2) / Math.max(1, series.length - 1);
  let total = 0;
  let prevY = PAD + (H - PAD * 2) * (1 - series[0] / Math.max(1, max));
  for (let i = 1; i < series.length; i++) {
    const y = PAD + (H - PAD * 2) * (1 - series[i] / Math.max(1, max));
    const dy = y - prevY;
    total += Math.sqrt(step * step + dy * dy);
    prevY = y;
  }
  return Math.max(50, Math.ceil(total) + 4);
}

export function ComparisonTrendChart({
  mineSeries,
  theirSeries,
  mineLabel,
  theirLabel,
}: ComparisonTrendChartProps) {
  const max = Math.max(1, ...mineSeries, ...theirSeries);
  const minePath = pathFor(mineSeries, max);
  const theirPath = pathFor(theirSeries, max);
  const minePathClosed = minePath
    ? `${minePath} L ${(W - PAD).toFixed(1)} ${(H - PAD).toFixed(1)} L ${PAD} ${(H - PAD).toFixed(1)} Z`
    : '';
  const mineLength = pathLength(mineSeries, max);
  const mineDrawStyle: CSSProperties = {
    strokeDasharray: mineLength,
    strokeDashoffset: mineLength,
    ['--path-length' as never]: mineLength,
    animation: 'line-draw 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    animationDelay: '0.1s',
  };
  // The opponent's line is intrinsically dashed; fading it in keeps the
  // dash pattern intact while still feeling animated.
  const theirFadeStyle: CSSProperties = {
    opacity: 0,
    animation: 'line-fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    animationDelay: '0.9s',
  };
  // Area fill fades in after the primary line finishes drawing so the
  // translucent wash doesn't obscure the draw-on motion.
  const areaFadeStyle: CSSProperties = {
    opacity: 0,
    animation: 'line-fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    animationDelay: '0.9s',
  };

  return (
    <section className="liquid-glass-warm p-5">
      <div className="flex items-center justify-between">
        <SectionLabel tone="muted">Trend vs {theirLabel}</SectionLabel>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-brand-800">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />{mineLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <span className="w-2.5 h-2.5 rounded-full bg-ink-muted" />{theirLabel}
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-3 w-full h-20"
        role="img"
        aria-label={`${mineLabel} vs ${theirLabel} cumulative savings`}
      >
        <path d={minePathClosed} fill={palette.brand500} fillOpacity={0.18} style={areaFadeStyle} />
        <path d={minePath} fill="none" stroke={palette.brand500} strokeWidth={2} strokeLinecap="round" style={mineDrawStyle} />
        <path d={theirPath} fill="none" stroke={palette.inkMuted} strokeWidth={1.5} strokeDasharray="4 3" strokeLinecap="round" style={theirFadeStyle} />
      </svg>
    </section>
  );
}
