export type FixedScheduleRule = 'fixed_daily' | 'fixed_weekly' | 'fixed_monthly';

export interface FixedSchedulePeriod {
  anchor: string;
  start: string;
  end: string;
  index: number;
}

function parseYmd(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
}

function addDays(dateKey: string, offsetDays: number): string {
  const { year, month, day } = parseYmd(dateKey);
  const next = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return [
    String(next.getUTCFullYear()).padStart(4, '0'),
    String(next.getUTCMonth() + 1).padStart(2, '0'),
    String(next.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function daysBetween(startKey: string, endKey: string): number {
  const start = parseYmd(startKey);
  const end = parseYmd(endKey);
  const diff = Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day);
  return Math.round(diff / 86_400_000);
}

function daysInclusive(startKey: string, endKey: string): number {
  if (endKey < startKey) return 0;
  return daysBetween(startKey, endKey) + 1;
}

export function addMonthsClamped(dateKey: string, offsetMonths: number): string {
  const { year, month, day } = parseYmd(dateKey);
  const targetMonthIndex = month - 1 + offsetMonths;
  const firstOfTarget = new Date(Date.UTC(year, targetMonthIndex, 1));
  const targetYear = firstOfTarget.getUTCFullYear();
  const targetMonth = firstOfTarget.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return [
    String(targetYear).padStart(4, '0'),
    String(targetMonth + 1).padStart(2, '0'),
    String(clampedDay).padStart(2, '0'),
  ].join('-');
}

export function fixedScheduleAnchorAtIndex(
  startKey: string,
  index: number,
  rule: FixedScheduleRule,
): string {
  if (index <= 0) return startKey;
  switch (rule) {
    case 'fixed_daily':
      return addDays(startKey, index);
    case 'fixed_weekly':
      return addDays(startKey, index * 7);
    case 'fixed_monthly':
      return addMonthsClamped(startKey, index);
  }
}

export function fixedSchedulePeriodForDate(
  startKey: string,
  dateKey: string,
  rule: FixedScheduleRule,
): FixedSchedulePeriod | null {
  if (dateKey < startKey) return null;

  if (rule === 'fixed_daily') {
    const index = daysBetween(startKey, dateKey);
    return { anchor: dateKey, start: dateKey, end: dateKey, index };
  }

  if (rule === 'fixed_weekly') {
    const index = Math.floor(daysBetween(startKey, dateKey) / 7);
    const anchor = fixedScheduleAnchorAtIndex(startKey, index, rule);
    return {
      anchor,
      start: anchor,
      end: addDays(anchor, 6),
      index,
    };
  }

  let index = 0;
  let anchor = startKey;
  let nextAnchor = fixedScheduleAnchorAtIndex(startKey, 1, rule);
  while (nextAnchor <= dateKey) {
    index += 1;
    anchor = nextAnchor;
    nextAnchor = fixedScheduleAnchorAtIndex(startKey, index + 1, rule);
  }

  return {
    anchor,
    start: anchor,
    end: addDays(nextAnchor, -1),
    index,
  };
}

export function isFixedScheduleAnchorDate(
  startKey: string,
  dateKey: string,
  rule: FixedScheduleRule,
): boolean {
  const period = fixedSchedulePeriodForDate(startKey, dateKey, rule);
  return period?.anchor === dateKey;
}

export function summarizeFixedScheduleInRange(
  startKey: string,
  endKey: string,
  rule: FixedScheduleRule,
): { periods: number; minActiveDays: number } {
  if (endKey < startKey) return { periods: 0, minActiveDays: 0 };

  let periods = 0;
  let minActiveDays = Number.POSITIVE_INFINITY;

  for (let index = 0; ; index += 1) {
    const anchor = fixedScheduleAnchorAtIndex(startKey, index, rule);
    if (anchor > endKey) break;
    const nextAnchor = fixedScheduleAnchorAtIndex(startKey, index + 1, rule);
    const periodEnd = nextAnchor <= endKey ? addDays(nextAnchor, -1) : endKey;
    periods += 1;
    minActiveDays = Math.min(minActiveDays, daysInclusive(anchor, periodEnd));
  }

  return {
    periods,
    minActiveDays: Number.isFinite(minActiveDays) ? minActiveDays : 0,
  };
}
