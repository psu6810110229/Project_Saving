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
  /** Amount cutoffs between colour levels (⅓ and ⅔ of the biggest day). */
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

/**
 * Colour level for a day's deposit total, scaled against the member's own
 * biggest day. Any deposit floors at level 2 — a solid, encouraging tone — so
 * infrequent savers (once a week / once a month) never see faint cells, while
 * bigger days still climb toward the darkest. A member who always saves the
 * same amount has every day at the top level.
 */
function levelFor(amount: number, maxDaily: number): HeatLevel {
  if (amount <= 0 || maxDaily <= 0) return 0;
  const ratio = amount / maxDaily;
  if (ratio <= 1 / 3) return 2;
  if (ratio <= 2 / 3) return 3;
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

  // Intensity scales against the member's own biggest deposit day.
  let maxDaily = 0;
  for (const value of dailyTotals.values()) {
    if (value > maxDaily) maxDaily = value;
  }

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
      level: levelFor(amount, maxDaily),
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

  return { weeks, todayColumnIndex, thresholds: [maxDaily / 3, (maxDaily * 2) / 3] };
}
