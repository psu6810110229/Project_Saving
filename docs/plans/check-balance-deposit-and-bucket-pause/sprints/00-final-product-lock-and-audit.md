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

## Sprint 0 Audit Result

Status: complete as documentation-only audit.

Branch/status:

- Started from clean branch `docs/check-balance-deposit-bucket-pause-plan`.
- Created and switched to `feat/check-balance-bucket-pause-audit`.
- No source behavior changes were made.

Latest migration:

- Latest Supabase migration is `0087_native_push_subscriptions.sql`.
- Recent tail checked: `0085_room_visible_momentum_flows.sql`, `0086_room_member_theme_colors.sql`, `0087_native_push_subscriptions.sql`.

Bucket RLS:

- `0019_partner_buckets_visibility.sql` replaces own-only bucket select with `buckets_select_co_member`, so room co-members can select bucket rows.
- `0058_bucket_transfers_archive.sql` recreates `buckets_own_update` with `user_id = auth.uid()` and active-bucket checks, so bucket updates remain owner-only.
- Result: partner select is already allowed for `buckets`; owner update is already enforced.

Reminders:

- `scheduled-saving-reminders` calls `public.enqueue_saving_plan_reminders()` and `public.enqueue_plan_start_notifications()`.
- Latest `enqueue_saving_plan_reminders()` definition is `0046_fix_saving_reminder_eligibility.sql`.
- That RPC excludes rows covered by `saving_plan_pauses`; it does not know bucket-level pause data.
- No existing `bucket_plan_pauses`, `bucket_pause`, `bucket_reminder`, or bucket-level scheduled reminder pipeline exists in source or migrations.

Calculation callers:

- `calcPeriodAwareStreak`: `src/pages/Dashboard.tsx`, `src/hooks/useStreak.ts`.
- `calcDailySummary`: `src/pages/Dashboard.tsx`, `src/hooks/useWidgetSync.ts`.
- `calcBucketPace`: `src/pages/Dashboard.tsx`.
- `bucketSaved`: Dashboard bucket status/removal/micro-goal paths, widget sync, bucket manager/edit form, check balance shortfall candidates, heatmap due popovers, migration wizard, bucket intent/focus helpers, and team/member snapshot paths.

Current calculation semantics:

- `calcPeriodAwareStreak` counts positive `savings_logs` plus bucket transfers only. It does not accept or count `balance_allocations`.
- `calcDailySummary` counts positive `savings_logs` plus bucket transfers only. It does not accept or count `balance_allocations`.
- `calcBucketPace` uses `bucketSaved(...)`; Dashboard passes transfers and allocations, so pace/display balance can include positive and negative allocation rows.
- `bucketSaved(...)` sums deposits + incoming transfers - outgoing transfers + signed allocations when allocations are provided.

Heatmap:

- `SavingsHeatmap` includes positive `balance_allocations` as daily saving activity.
- `SavingsHeatmap` ignores negative `balance_allocations`, so write-downs do not reduce displayed heat.

Momentum:

- `0085_room_visible_momentum_flows.sql` exposes deposits, transfer-in, transfer-out, and signed allocation rows to room-visible momentum.
- `purposeVisibleFlowDailySeries` sums signed flow amounts, so negative days can reach the chart data.
- `MomentumChart.chartValue()` clamps values to `Math.max(0, value ?? 0)`.
- Result: the current chart cannot render negative bars below baseline. It can show a negative-adjustment badge through markers, but negative amounts are visually flattened to zero-height bars.

## Locked Product Decisions

1. Resume pressure threshold
   - Lock: show the resume pressure suggestion if either condition is true:
     - recalculated daily equivalent is `>= 300/day`
     - recalculated daily equivalent is `> 2x` the previous daily equivalent

2. Check Balance split deposit release scope
   - Lock: first release is single-bucket deposit from Check Balance.
   - Multi-bucket split deposit stays in Sprint 7.

3. Check Balance surplus allocation and streak
   - Lock: positive `balance_allocations` count in heatmap/activity/momentum where already wired.
   - They do not count toward streak unless a future product decision adds a new explicit streak source rule.

4. Partner visibility for bucket pause
   - Lock: partners may see that a bucket is paused/resumed.
   - Partners must not see raw paused/resumed dates in the first release.
   - Use sanitized status/read models or notification payloads for partner visibility rather than direct co-member select of full pause history rows.

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
