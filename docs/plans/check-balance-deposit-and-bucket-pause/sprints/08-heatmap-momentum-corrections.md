# Sprint 8: Heatmap And Momentum Corrections

## Branch

`feat/heatmap-momentum-corrections`

## Goal

Make charts reflect the final product semantics for deposit, Check Balance surplus, Check Balance shortfall, and pause.

## Global Rules

- Run `npm run build`
- Do not run MCP Browser or in-app browser
- Do not change financial ledgers
- Preserve partner privacy

## Required Context

- `src/lib/savingsHeatmap.ts`
- `src/components/SavingsHeatmap/SavingsHeatmap.tsx`
- `src/lib/momentumPurpose.ts`
- `src/components/MomentumChart/MomentumChart.tsx`
- `src/pages/Team.tsx`
- `supabase/migrations/0085_room_visible_momentum_flows.sql`
- pause state helpers from Sprint 2

## Heatmap Semantics

Cell model should support:

- `positiveAmount`
- `negativeAmount`
- `netAmount`
- `hasDeposit`
- `hasSurplusAdjustment`
- `hasShortfallCorrection`
- `hasPausedActivity`
- markers

Rules:

- deposit +250: normal heat from +250
- surplus allocation +250: normal heat from +250 plus marker
- shortfall/write-down -250: correction/anomaly tone plus marker
- deposit +500 and correction -250: heat from net +250 plus marker
- net 0 with correction: neutral correction marker, not unexplained blank
- paused deposit: normal heat plus pause marker

Tooltip breakdown:

- deposits
- surplus allocation
- shortfall/write-down
- net
- paused note if relevant

## Momentum Semantics

- positive deposit/surplus above baseline
- negative shortfall/write-down below baseline
- transfer out can be negative in bucket scope
- if a day has positive and negative, tooltip shows breakdown
- marker indicates adjustment/correction source

## Tasks

- Replace heatmap daily total builder with richer movement builder.
- Include signed allocation data.
- Add marker rendering without causing tiny-cell overlap.
- Update heatmap legend and copy.
- Ensure negative correction cells are visually distinct from no-activity days.
- Audit MomentumChart negative-value support.
- Add baseline/negative bar support if missing.
- Update marker tooltips.
- Ensure purpose filters still work.

## Files Likely Touched

- `src/lib/savingsHeatmap.ts`
- `src/components/SavingsHeatmap/SavingsHeatmap.tsx`
- `src/lib/momentumPurpose.ts`
- `src/components/MomentumChart/MomentumChart.tsx`
- `src/pages/Team.tsx`
- `src/pages/Dashboard.tsx`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`

## Verification

- `npm run build`
- No MCP Browser

## Manual Test Checklist

- Deposit-only day has normal heat.
- Surplus allocation day has normal heat and marker.
- Shortfall-only day has correction color and marker.
- Deposit + shortfall same day has net heat and marker.
- Paused deposit day has normal heat and pause marker.
- Momentum shows negative write-down below baseline.
- Tooltip explains every unusual marker.

## Risks

- Heatmap cells are small. Marker design must be legible but not noisy.
- Momentum negative values can alter chart scaling.
