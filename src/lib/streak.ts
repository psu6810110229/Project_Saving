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

/**
 * Streak helper that honours auto-spent freezes (SPRINT1-003).
 *
 * `frozenDates` is the set of Bangkok-local `YYYY-MM-DD` dates for which
 * `streak_freeze_usages` has already recorded an auto-freeze. Such dates
 * count as in-chain days for the streak length, so a user who missed
 * yesterday but has a freeze covering it still sees their streak grow
 * once they save today.
 *
 * The chain still requires today (or yesterday) to have a raw save —
 * the freeze can fill an interior gap, not the leading edge — which
 * matches the spec: freezes are spent only between two save days.
 */
export function calcStreakWithFreezes(
  logs: { created_at: string }[],
  todayKey: string,
  frozenDates: ReadonlySet<string>,
): number {
  const saveDays = new Set(
    logs
      .map(l => localDateKey(l.created_at))
      .filter(k => k <= todayKey),
  );

  if (saveDays.size === 0) return 0;

  // Start from today; if today has no save, try yesterday. A frozen
  // day cannot be the leading edge of the streak — the user has to
  // save at least once recently for the chain to be considered alive.
  let cursor = todayKey;
  if (!saveDays.has(cursor)) {
    cursor = yesterday(cursor);
    if (!saveDays.has(cursor)) return 0;
  }

  let count = 0;
  while (saveDays.has(cursor) || frozenDates.has(cursor)) {
    count++;
    cursor = yesterday(cursor);
  }
  return count;
}
