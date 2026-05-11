# Task 5 — Dynamic Goal & Smart Timeline

## Goal
Each user can set their own target amount and date range, and sees countdown + daily-required + predicted-completion calculations on the dashboard.

## Files Created / Edited
- `src/pages/Settings.tsx` — form to set/edit `target_amount`, `start_date`, `end_date`.
- `src/pages/Dashboard.tsx` — placeholder from Task 4, now hosts the timeline widgets.
- `src/components/GoalForm/GoalForm.tsx` — controlled form, used inside Settings.
- `src/components/CountdownCard/CountdownCard.tsx` — days until trip date.
- `src/components/ForecastCard/ForecastCard.tsx` — daily required + predicted completion.
- `src/hooks/useGoal.ts` — fetch/update current user's goal row.
- `src/hooks/useSavingsTotal.ts` — sum of `savings_logs.amount` for current user.
- `src/lib/forecast.ts` — pure math helpers (testable, no React).
- `src/types/index.ts` — `Goal` interface.

## Constants
- `TRIP_DATE = '2027-11-01'` (countdown target — independent of per-user `end_date`).

## Types
```ts
interface Goal {
  user_id: string;
  target_amount: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  updated_at: string;
}
```

## lib/forecast.ts (pure functions)
```ts
daysBetween(a: Date, b: Date): number          // floor((b-a)/86400000)
dailyRequired(goal: Goal, savedSoFar: number, today: Date): number
predictedCompletion(goal: Goal, savedSoFar: number, daysElapsed: number): Date | null
tripCountdown(today: Date): number             // days until 2027-11-01
```
- `dailyRequired` = `(target - saved) / max(1, daysRemaining)`; clamp negative to 0.
- `predictedCompletion` = if daily velocity > 0, `today + (target - saved) / velocity` days; else `null`.
- All functions take `today` as parameter (no `new Date()` inside) → easier unit tests.

## Hooks
- `useGoal()`:
  - `select * from goals where user_id = auth.uid()` (RLS enforces).
  - `upsert` on save.
  - Returns `{ goal, loading, error, save(values) }`.
- `useSavingsTotal(userId)`:
  - `select sum(amount) from savings_logs where user_id = ?`.
  - Re-fetch after a log insert (Task 7 will swap to realtime).

## Settings Page UI
- Number input for amount (validate > 0).
- Two date inputs (`<input type="date">`).
- Save button — disabled while submitting.
- Inline success/error toast.

## Dashboard Widgets
Three stacked cards on mobile, row on `md:`+
1. Countdown — large number "DAYS" until Nov 2027.
2. Progress — saved / target with % and remaining.
3. Forecast — daily required + predicted completion date (or "Set a goal first").

## Edge Cases / Risks
- User has no goal yet → forecast cards show CTA "Set your goal" linking to Settings.
- `end_date` in the past → daily required becomes huge; clamp display, show warning "Goal date passed — extend it".
- Velocity = 0 (no logs yet) → predicted completion is `null`; render "—".
- Date math in JS uses local TZ; using string `YYYY-MM-DD` + constructed `new Date(s + 'T00:00:00')` to be explicit.
- `target_amount` numeric from Postgres comes back as string in some clients — coerce with `Number()` once at fetch boundary.

## Acceptance Criteria
- [ ] Settings form persists values; reload shows them back.
- [ ] Countdown matches actual days to 2027-11-01.
- [ ] Daily required updates after editing target / dates.
- [ ] Forecast handles 0 velocity gracefully.
- [ ] Pure functions in `lib/forecast.ts` are unit-test-friendly (take `today` as arg).
- [ ] No hex colors; only Tailwind tokens.
