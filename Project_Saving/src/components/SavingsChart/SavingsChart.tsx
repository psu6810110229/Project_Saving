import type { DailyTotal } from '../../lib/comparisonStats';
import { formatCurrency } from '../../lib/format';

interface SavingsChartProps {
  myName: string;
  theirName: string;
  mySeries: DailyTotal[];
  theirSeries: DailyTotal[];
}

const MY_COLOR = '#D4651A';      // terracotta
const THEIR_COLOR = '#7A6E66';   // ink-muted

function toPoints(series: DailyTotal[], xMax: number, yMax: number): string {
  if (series.length === 0 || yMax === 0) return '';
  return series
    .map((d, i) => {
      const x = xMax > 0 ? (i / xMax) * 100 : 50;
      const y = 100 - (d.total / yMax) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function SavingsChart({ myName, theirName, mySeries, theirSeries }: SavingsChartProps) {
  const hasData = mySeries.length >= 2 || theirSeries.length >= 2;

  if (!hasData) {
    return (
      <div className="w-full h-48 flex items-center justify-center">
        <p className="text-sm text-ink-muted text-center px-4">
          Not enough data yet — start logging!
        </p>
      </div>
    );
  }

  const allTotals = [...mySeries.map(d => d.total), ...theirSeries.map(d => d.total)];
  const rawYMax = Math.max(...allTotals, 1);
  const yMax = rawYMax * 1.1; // 10% headroom

  const xMax = Math.max(mySeries.length, theirSeries.length) - 1;

  const myPoints = toPoints(mySeries, xMax, yMax);
  const theirPoints = toPoints(theirSeries, xMax, yMax);

  const firstDate = mySeries[0]?.date ?? theirSeries[0]?.date ?? '';
  const lastDate = mySeries[mySeries.length - 1]?.date ?? theirSeries[theirSeries.length - 1]?.date ?? '';
  const topLabel = formatCurrency(Math.round(rawYMax));

  return (
    <div className="w-full flex flex-col gap-1">
      {/* SVG chart */}
      <div className="relative w-full h-48">
        {/* Y max label */}
        <span className="absolute top-1 left-1 text-xs text-ink-muted leading-none">
          {topLabel}
        </span>

        <svg
          className="w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-label="Cumulative savings comparison chart"
        >
          {/* Their line */}
          {theirPoints && (
            <polyline
              points={theirPoints}
              stroke={THEIR_COLOR}
              strokeWidth="2"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* My line */}
          {myPoints && (
            <polyline
              points={myPoints}
              stroke={MY_COLOR}
              strokeWidth="2"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>

      {/* X-axis date labels */}
      <div className="flex justify-between text-xs text-ink-muted px-1">
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </div>

      {/* Legend */}
      <div className="flex gap-4 justify-center mt-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: MY_COLOR }} />
          <span className="text-xs text-ink-muted">{myName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: THEIR_COLOR }} />
          <span className="text-xs text-ink-muted">{theirName}</span>
        </div>
      </div>
    </div>
  );
}
