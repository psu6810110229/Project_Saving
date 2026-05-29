import { addDays } from './savingPlan';

/**
 * Pure builder for the Dashboard savings heatmap (a GitHub-style
 * contributions calendar of the current user's own daily deposits).
 *
 * All inputs are Asia/Bangkok `YYYY-MM-DD` day keys so the grid lines up
 * with the rest of the app's day logic. The caller converts deposit
 * timestamps to Bangkok keys (e.g. via `todayBangkokKey(new Date(iso))`)
 * and supplies the per-day totals plus the project window.
 */

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatmapCell {
  dateKey: string;
  amount: number;
  level: HeatLevel;
  isToday: boolean;
  /** Within the real project window (start..end inclusive). */
  inRange: boolean;
  isFuture: boolean;
  /** A bucket's start day (bucket created_at). */
  bucketStart: boolean;
  /** A bucket's due day (bucket deadline). */
  bucketDue: boolean;
}

export interface HeatmapModel {
  /** Columns, each exactly 7 cells ordered Monday..Sunday. */
  weeks: HeatmapCell[][];
  /** Column index whose week contains today, or -1 when out of range. */
  todayColumnIndex: number;
  /** Quartile thresholds of non-zero days, for the legend. */
  thresholds: number[];
}

function parse(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

/** ISO weekday for a day key: 1 = Monday .. 7 = Sunday. */
function isoDow(key: string): number {
  const { y, m, d } = parse(key);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

function mondayOf(key: string): string {
  return addDays(key, 1 - isoDow(key));
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.round((sortedAsc.length - 1) * p)));
  return sortedAsc[idx];
}

function levelFor(amount: number, q1: number, q2: number, q3: number): HeatLevel {
  if (amount <= 0) return 0;
  if (amount <= q1) return 1;
  if (amount <= q2) return 2;
  if (amount <= q3) return 3;
  return 4;
}

export interface BuildHeatmapParams {
  /** Per-day deposit totals, keyed by Bangkok day key. */
  dailyTotals: Map<string, number>;
  /** Project window start day key (inclusive). */
  startKey: string;
  /** Project window end day key (inclusive). */
  endKey: string;
  todayKey: string;
  /** Bucket start day keys (created_at). */
  bucketStartKeys: Set<string>;
  /** Bucket due day keys (deadline). */
  bucketDueKeys: Set<string>;
}

export function buildSavingsHeatmap({
  dailyTotals,
  startKey,
  endKey,
  todayKey,
  bucketStartKeys,
  bucketDueKeys,
}: BuildHeatmapParams): HeatmapModel {
  // Snap the grid to whole ISO weeks (Mon..Sun) so columns are uniform.
  const gridStart = mondayOf(startKey);
  // Last column ends on the Sunday of the end week.
  const gridEnd = addDays(mondayOf(endKey), 6);

  const nonZero: number[] = [];
  for (const value of dailyTotals.values()) {
    if (value > 0) nonZero.push(value);
  }
  nonZero.sort((a, b) => a - b);
  const q1 = percentile(nonZero, 0.25);
  const q2 = percentile(nonZero, 0.5);
  const q3 = percentile(nonZero, 0.75);

  const weeks: HeatmapCell[][] = [];
  let column: HeatmapCell[] = [];
  let cursor = gridStart;
  let todayColumnIndex = -1;

  while (cursor <= gridEnd) {
    const amount = dailyTotals.get(cursor) ?? 0;
    const inRange = cursor >= startKey && cursor <= endKey;
    const cell: HeatmapCell = {
      dateKey: cursor,
      amount,
      level: levelFor(amount, q1, q2, q3),
      isToday: cursor === todayKey,
      inRange,
      isFuture: cursor > todayKey,
      bucketStart: bucketStartKeys.has(cursor),
      bucketDue: bucketDueKeys.has(cursor),
    };
    column.push(cell);
    if (cell.isToday) todayColumnIndex = weeks.length;
    if (column.length === 7) {
      weeks.push(column);
      column = [];
    }
    cursor = addDays(cursor, 1);
  }
  if (column.length > 0) weeks.push(column);

  return { weeks, todayColumnIndex, thresholds: [q1, q2, q3] };
}
