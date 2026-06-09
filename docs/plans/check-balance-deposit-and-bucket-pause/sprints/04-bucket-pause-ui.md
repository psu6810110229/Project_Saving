# Sprint 4: Bucket Pause UI

## Branch

`feat/bucket-pause-ui`

## Goal

Add complete UI for paused bucket state, pause action, and resume preview.

## Global Rules

- Run `npm run build`
- Do not run MCP Browser or in-app browser
- No red/orange warning treatment for normal pause state
- Do not disable deposits

## Required Context

- Sprint 2 hook/helper APIs
- Sprint 3 calculation metadata
- `src/pages/Dashboard.tsx`
- `src/components/BucketSheet/BucketSheet.tsx`
- `src/components/SavingPlanCard/SavingPlanCard.tsx`
- `src/components/BucketDragCard/BucketDragCard.tsx`
- `src/components/SortableBucketCard/SortableBucketCard.tsx`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`

## Visual Direction

Paused is a bucket state, not a one-line label.

Use:

- neutral/cool muted tone
- pause icon
- dashed or striped plan indicator
- paused pill in cadence/due area
- subtle helper text

Avoid:

- greyed-out whole card
- danger styling
- blocking deposit
- modal spam when depositing

## Tasks

### Dashboard Bucket Card

- Add paused state to bucket item model.
- Show paused pill.
- Keep money progress normal.
- Mutate only plan/pace visual treatment to muted/dashed.
- If deadline exists, show quiet helper:
  - `Paused · original deadline {date}`
- If resume preview is high pressure, optionally show:
  - `Resume would be about {amount}/day`

### Bucket Sheet

- Add paused banner below bucket header.
- Message:
  - money still enters bucket
  - streak/plan will not move while paused
- Keep deposit input enabled.
- Add secondary `Resume plan` action.
- After deposit into paused bucket, success copy says plan remains paused.

### Pause Control

- Add pause action for own active bucket with saving rule.
- Hide or disable for:
  - partner bucket
  - archived bucket
  - bucket without trackable plan, unless product says flexible buckets can pause
- Add pause confirm sheet/modal:
  - bucket name
  - pause starts today
  - confirm

### Resume Preview

- Add resume preview sheet:
  - saved
  - remaining
  - deadline
  - recalculated cadence amount
  - pressure suggestion
  - primary: keep original deadline
  - secondary: adjust deadline
- If user adjusts deadline, reuse existing deadline picker if practical.

### SavingPlanCard

- All focus buckets paused:
  - state `Plan paused`
  - streak preserved
  - due hidden
- Some paused:
  - due list excludes paused buckets
  - note `{n} buckets paused`

### i18n

Add Thai and English copy for:

- paused pill
- paused banner
- pause action
- resume action
- resume preview
- pressure suggestion
- paused deposit success

## Files Likely Touched

- `src/pages/Dashboard.tsx`
- `src/components/BucketSheet/BucketSheet.tsx`
- `src/components/SavingPlanCard/SavingPlanCard.tsx`
- new `src/components/BucketPauseSheet/BucketPauseSheet.tsx`
- new `src/components/BucketResumePreviewSheet/BucketResumePreviewSheet.tsx`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`

## Verification

- `npm run build`
- No MCP Browser

## Manual Test Checklist

- Pause button visible only where allowed.
- Paused card is clearly paused but tappable.
- Deposit into paused bucket works.
- Resume preview shows correct recalculated amount.
- High pressure suggestion appears when threshold is exceeded.
- All-paused Saving Plan card looks calm and professional.

## Risks

- Sheet stacking can conflict with existing BucketSheet.
- Long Thai copy can overflow compact controls.
