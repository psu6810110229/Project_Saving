export const APP_TZ = 'Asia/Bangkok';

export function localDateKey(iso: string, tz = APP_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function yesterday(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function calcStreak(
  logs: { created_at: string }[],
  todayKey: string,
): number {
  const days = new Set(
    logs
      .map(l => localDateKey(l.created_at))
      .filter(k => k <= todayKey), // ignore future-dated logs
  );

  if (days.size === 0) return 0;

  // Start from today; if today has no log, try yesterday
  let cursor = todayKey;
  if (!days.has(cursor)) {
    cursor = yesterday(cursor);
    if (!days.has(cursor)) return 0;
  }

  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = yesterday(cursor);
  }
  return count;
}
