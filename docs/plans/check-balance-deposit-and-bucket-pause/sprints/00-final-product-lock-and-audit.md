# Sprint 0: Final Product Lock And Audit

## Branch

`feat/check-balance-bucket-pause-audit`

## Goal

Lock the remaining product decisions and inspect exact source files before any schema or behavior change. This sprint exists to prevent guessing.

## Global Rules

- Run `npm run build`
- Do not run MCP Browser or in-app browser
- Do not change product behavior
- Do not create migrations yet unless the audit discovers a blocking missing note that must be documented

## Context To Read

Read these files before making any conclusion:

- `src/hooks/useLogs.ts`
- `src/hooks/useReconcile.ts`
- `src/components/CheckBalanceSheet/CheckBalanceSheet.tsx`
- `src/pages/Dashboard.tsx`
- `src/lib/streakCalculation.ts`
- `src/lib/bucketDailySummary.ts`
- `src/lib/paceCalculation.ts`
- `src/lib/savingsHeatmap.ts`
- `src/components/SavingsHeatmap/SavingsHeatmap.tsx`
- `src/lib/momentumPurpose.ts`
- latest Supabase migrations
- migration `0051_streak_freeze.sql`
- migrations `0078_balance_allocations.sql`, `0079_balance_deallocations.sql`, `0085_room_visible_momentum_flows.sql`

## Product Decisions To Lock

1. Resume pressure threshold
   - Candidate: `300/day`
   - Candidate: `> 2x` previous daily equivalent
   - Decide if either condition triggers suggestion, or only one.

2. Check Balance split deposit release scope
   - Option A: single bucket in first release, split in Sprint 7
   - Option B: split in first release

3. Check Balance surplus allocation and streak
   - Confirm whether positive `balance_allocations` should count only in heatmap/activity or also in streak.
   - Plan recommendation: not streak, unless product approves a new source rule.

4. Partner visibility for bucket pause
   - Decide if partner can see paused status for a bucket.
   - If yes, decide whether they see only status or also paused date.

## Tasks

- Confirm current branch/status before changes.
- Identify latest migration number.
- Confirm whether existing `buckets` RLS allows partner select and owner update.
- Confirm whether scheduled reminders use legacy plan pauses only.
- Confirm whether any bucket-level reminder pipeline exists.
- Confirm all callers of:
  - `calcPeriodAwareStreak`
  - `calcDailySummary`
  - `calcBucketPace`
  - `bucketSaved`
- Confirm heatmap currently includes positive allocation and ignores negative allocation.
- Confirm momentum chart can or cannot render negative bars correctly.
- Update the main plan README if any product decision is locked.

## Files Allowed

- `docs/plans/check-balance-deposit-and-bucket-pause/README.md`
- sprint docs only

## Verification

- `npm run build`
- No MCP Browser

## Done Criteria

- All product decisions needed for Sprint 1 and Sprint 2 are either locked or explicitly marked blocking.
- Latest migration number is known.
- No code behavior changed.
