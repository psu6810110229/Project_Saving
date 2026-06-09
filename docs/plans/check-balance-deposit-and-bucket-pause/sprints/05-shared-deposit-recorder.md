# Sprint 5: Shared Deposit Recorder

## Branch

`feat/shared-deposit-recorder`

## Goal

Extract deposit orchestration so bucket deposit and Check Balance deposit mode use the same behavior.

## Global Rules

- Run `npm run build`
- Do not run MCP Browser or in-app browser
- Do not change Check Balance UI yet
- Do not create a second deposit logic path

## Required Context

- `src/hooks/useLogs.ts`
- `src/pages/Dashboard.tsx`
- `src/components/BucketSheet/BucketSheet.tsx`
- `src/lib/notifyEvents.ts`
- `src/hooks/useRoomVisibleMomentumFlows.ts`
- `src/components/VaultUpdatePreviewModal/VaultUpdatePreviewModal.tsx`

## Existing Behavior To Preserve

Bucket deposit currently:

- calls `useLogs.insert`
- writes positive `savings_logs`
- fires partner deposit notification through existing hook path
- evaluates smart events
- adds optimistic momentum flow
- triggers haptic feedback
- may open vault preview
- closes BucketSheet on success

## Tasks

- Extract reusable deposit recorder in Dashboard or a focused hook.
- Keep existing `BucketSheet` user behavior unchanged.
- Add result shape that can tell callers:
  - amount
  - bucket id
  - bucket name
  - reached target
  - was paused at deposit time
  - error
- Ensure paused deposit can suppress streak-specific copy.
- Keep optimistic flow behavior centralized.
- Keep notification/smart event behavior in `useLogs.insert`.
- Do not add batch insert yet.

## Files Likely Touched

- `src/pages/Dashboard.tsx`
- maybe `src/hooks/useDepositRecorder.ts`
- maybe types in `src/types/index.ts`

## Verification

- `npm run build`
- No MCP Browser

## Manual Test Checklist

- Existing bucket deposit still works.
- Existing bucket deposit still updates Dashboard totals.
- Existing vault preview still appears.
- Partner notification still appears.
- Smart events still trigger.
- Paused deposit result is identifiable for future UI.

## Done Criteria

- There is one shared deposit orchestration path ready for Check Balance deposit mode.

## Risks

- Moving Dashboard logic can cause subtle UI regressions. Keep extraction minimal.
