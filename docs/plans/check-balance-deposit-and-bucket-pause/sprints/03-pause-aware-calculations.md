# Sprint 3: Pause-Aware Calculations

## Branch

`feat/bucket-pause-calculations`

## Goal

Make due, pace, streak, and freeze behavior respect bucket-level pause.

## Global Rules

- Run `npm run build`
- Do not run MCP Browser or in-app browser
- Treat streak changes as high risk
- Do not change money totals

## Required Context

- `src/lib/streakCalculation.ts`
- `src/lib/bucketDailySummary.ts`
- `src/lib/paceCalculation.ts`
- `src/hooks/useStreak.ts`
- `src/hooks/useStreakFreeze.ts`
- `supabase/migrations/0051_streak_freeze.sql`
- `src/pages/Dashboard.tsx`
- Sprint 2 helpers

## Calculation Rules

### Pause Interval

Pause covers Bangkok dates `[paused_from, resumed_from)`.

- same-day pause/resume is no-op
- open pause covers from paused date onward

### Due

Paused bucket:

- no due amount
- no reminder due state
- no action alert
- money progress still visible

### Streak

- Paused bucket has no obligation during paused periods.
- Deposit during paused period affects money but does not satisfy streak.
- If all trackable focus buckets are paused today:
  - state is paused
  - streak is preserved
  - streak does not increment
  - streak does not break
- If some focus buckets are paused:
  - active focus buckets still count
  - paused buckets are excluded
- Misses before pause remain meaningful.

### Freeze

- Paused days must not consume streak freeze budget.
- If existing freeze RPC cannot know bucket pause safely, add a migration to make it pause-aware before enabling pause UI.

## Tasks

- Update `calcDailySummary` to accept pause data and omit paused bucket due.
- Update `calcBucketPace` or callers to skip paused buckets from action alerts.
- Update `calcPeriodAwareStreak` signature to accept pause/revision data.
- Add paused return state or metadata:
  - `hasPausedCurrentPeriod`
  - `allTrackedPaused`
  - `pausedBucketIds`
- Update Dashboard `displayedHabitStatus`.
- Audit `useStreak` for widget/dashboard uses.
- Audit leaderboard behavior:
  - current user has freeze data
  - partner streak may remain raw unless partner pause visibility is implemented
- Audit `consume_streak_freezes_if_needed`.
- Add migration if freeze RPC must skip paused days server-side.

## Files Likely Touched

- `src/lib/bucketDailySummary.ts`
- `src/lib/paceCalculation.ts`
- `src/lib/streakCalculation.ts`
- `src/hooks/useStreak.ts`
- `src/hooks/useStreakFreeze.ts`
- `src/pages/Dashboard.tsx`
- maybe `src/hooks/useWidgetSync.ts`
- maybe Supabase migration for freeze RPC

## Verification

- `npm run build`
- No MCP Browser

## Manual Test Checklist

- All focus buckets paused: streak visible and preserved.
- All focus buckets paused: no due shown.
- One active and one paused bucket: active bucket due remains.
- Deposit into paused bucket does not advance streak.
- Paused day without deposit does not consume freeze.
- Miss before pause still affects streak.
- Action alert excludes paused bucket.

## Done Criteria

- Pause-aware calculation APIs are wired into Dashboard.
- No visible UI polish required yet, but states must be available.

## Risks

- Streak math can regress dashboard, widget, leaderboard, and reminders.
- If partner pause visibility is not implemented, partner streak display may be intentionally unchanged.
