# Task 9 — Daily Streak System

## Goal
A flame icon that shows each user's current consecutive-day logging streak. Resets visually the moment a calendar day passes with no log.

## Files Created / Edited
- `src/lib/streak.ts` — pure streak calculation.
- `src/hooks/useStreak.ts` — derives streak from realtime logs for a given user.
- `src/components/StreakFlame/StreakFlame.tsx` — flame icon + number.
- Wire into `PlayerProgress` (Task 8) so each player's card shows their streak.

## Definitions
- A "day" = the local-TZ calendar date of `created_at` (use `Asia/Bangkok` since both users are there; export as constant).
- Streak = number of consecutive days, ending at TODAY, where the user has at least one log.
- If today has no log → streak counts up to and including yesterday only IF yesterday had a log; else streak = 0.

## lib/streak.ts
```ts
export const APP_TZ = 'Asia/Bangkok';

// Convert a UTC ISO timestamp to its local YYYY-MM-DD in APP_TZ.
export function localDateKey(iso: string, tz = APP_TZ): string;

// Given sorted logs (desc by created_at) for ONE user and "today" key,
// return current streak count.
export function calcStreak(logs: { created_at: string }[], todayKey: string): number;
```
Algorithm:
1. Build a `Set<string>` of distinct local-date keys from logs.
2. Start cursor at `todayKey`.
3. If cursor not in set → cursor = yesterday(cursor); if still not in set → return 0.
4. Else: walk back day by day (`yesterday(cursor)`) while in set, incrementing count.
5. Return count.

## useStreak
- Filters realtime logs by user.
- Recomputes whenever logs change OR when local midnight passes (set a `setInterval` that checks `localDateKey(now)` and triggers recompute on change).
- Returns `{ streak, hasLoggedToday }`.

## StreakFlame UI
- Active (streak > 0): orange flame emoji 🔥 + bold number.
- Inactive (streak = 0): gray flame outline + "—".
- `hasLoggedToday=false` and streak > 0: still show flame but with a small "log today!" hint.

## Edge Cases / Risks
- Time zones: never compare raw `created_at` substrings — always go through `localDateKey`. Server is UTC; users are in Bangkok.
- DST: Bangkok has no DST → safe, but keep TZ logic via `Intl.DateTimeFormat({ timeZone })` so future relocation is one-line change.
- Midnight tick: a user looking at the screen at 11:59 PM should see streak drop at 12:00 AM if they don't log. Hence the interval-based midnight watcher.
- Bulk-logging the same day multiple times is still one streak day (Set dedups).
- Future-dated logs (clock skew): clamp `localDateKey > todayKey` to ignore.

## Acceptance Criteria
- [ ] Logging today when yesterday had a log → streak increases by 1 (or starts at 1 if first).
- [ ] Skipping a day → next render after midnight shows streak = 0 (without manual reload).
- [ ] Multiple logs in one day count as one streak day.
- [ ] Bangkok-local boundary respected (verified by inserting `created_at` near 23:30 UTC, which is 06:30 Bangkok next day).
- [ ] Pure `calcStreak` is unit-testable with synthetic dates.
