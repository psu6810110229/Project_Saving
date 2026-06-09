# Sprint 2: Bucket Pause Hooks And Helpers

## Branch

`feat/bucket-pause-hooks`

## Goal

Expose bucket pause/revision data to the app and add pure helpers for calculations and resume preview.

## Global Rules

- Run `npm run build`
- Do not run MCP Browser or in-app browser
- Do not change UI yet unless needed for compile-only wiring

## Required Context

- Sprint 1 migration and RPC return shapes
- `src/components/DataContext/DataContext.tsx`
- `src/components/DataContext/DataContextValue.ts`
- `src/hooks/useBuckets.ts`
- `src/types/index.ts`
- `src/lib/savingPlan.ts` date helpers
- `src/lib/buckets.ts`

## Tasks

### Types

Add types:

- `BucketPlanPause`
- `BucketPlanRevision`
- `PauseBucketPlanResult`
- `ResumeBucketPlanResult`
- `BucketPauseState`
- `ResumePreview`

### Hook

Add `src/hooks/useBucketPlanPauses.ts`.

Responsibilities:

- fetch pause rows for current room/user
- fetch revision rows if needed by calculations
- expose `pauseBucketPlan`
- expose `resumeBucketPlan`
- expose `refetch`
- subscribe to relevant realtime changes if needed
- keep errors typed and user-safe

### DataContext

Wire hook into shared data only if dashboard/sheets need it broadly.

Add to:

- `DataContext.tsx`
- `DataContextValue.ts`
- shared refresh path

### Pure Helpers

Create `src/lib/bucketPlanPause.ts`.

Required helpers:

- `isBucketPausedOnDate(pauses, bucketId, dateKey)`
- `openPauseForBucket(pauses, bucketId)`
- `pauseIntervalContainsDate(pause, dateKey)`
- `pausedDaysInRange(pauses, bucketId, startKey, endKey)`
- `bucketPauseStateForDate(bucket, pauses, dateKey)`
- `dailyEquivalentForRule(ruleSnapshot)`
- `previewResumePlan(input)`
- `classifyResumePressure(input)`

### Resume Preview Inputs

Use:

- bucket current target
- current bucket balance from `bucketSaved`
- current deadline
- resume date
- current rule/revision snapshot
- threshold constants locked in Sprint 0

## Files Likely Touched

- `src/types/index.ts`
- `src/hooks/useBucketPlanPauses.ts`
- `src/components/DataContext/DataContext.tsx`
- `src/components/DataContext/DataContextValue.ts`
- `src/lib/bucketPlanPause.ts`

## Verification

- `npm run build`
- No MCP Browser

## Manual Test Checklist

- App loads when there are no pause rows.
- App loads when there is one open pause.
- App loads with closed historical pauses.
- Hook refetch updates after pause/resume.
- Resume preview for deadline bucket returns remaining amount and cadence amount.
- Resume preview for no-deadline bucket does not show deadline pressure.

## Done Criteria

- UI can ask "is this bucket paused today?"
- UI can ask "what is the open pause?"
- Calculations can receive pause/revision data without querying Supabase directly.

## Risks

- Fetching revisions for all buckets can make Dashboard heavier. Keep selects narrow.
- Do not introduce circular imports between hooks and pure helpers.
