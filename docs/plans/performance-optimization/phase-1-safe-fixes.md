# Phase 1: Safe Fixes

## Purpose

Phase 1 is intentionally narrow. It should reduce obvious frame pressure without changing visuals, product behavior, timing feel, backend logic, navigation, data semantics, or UI copy.

Every Phase 1 change should be reversible, locally scoped, and easy to verify. Do not group too many unrelated changes into this phase.

## Low-Risk, High-Impact Fixes

### 1. Add Trace Discipline Before Changes

Create a before/after measurement routine before any implementation begins.

Likely involved files:

- No source changes required.
- Store trace notes under a future `test-results/perf/` folder if implementation is approved.
- Reference this checklist: `docs/plans/performance-optimization/verification-checklist.md`.

Implementation checklist:

- Capture baseline traces for Dashboard, Team, sheet open/close, chart mode switch, pull-to-refresh, and drag.
- Record visible stutter notes in plain language.
- Record viewport, device/browser/WebView, route, account state, and build mode.
- Keep reduced-motion traces separate.

Expected benefit:

- Prevents guessing.
- Makes later changes easier to approve or roll back.

Risk level:

- Very low.

Verification steps:

- Confirm baseline artifacts exist before implementation.
- Confirm test conditions are repeatable.

Rollback notes:

- No app rollback needed.

### 2. Throttle Pull-To-Refresh Touch State With requestAnimationFrame

`usePullToRefresh` currently updates React state directly during touch movement. On weaker WebViews, that can compete with scrolling and content transforms.

Likely involved files:

- `src/hooks/usePullToRefresh.ts`
- `src/components/PullToRefresh/PullToRefresh.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Team.tsx`

Implementation checklist:

- Keep the same gesture behavior, threshold, resistance, haptics, indicator, and visual output.
- Batch touch-move updates through one requestAnimationFrame per frame.
- Avoid setting state when the rounded pull distance has not meaningfully changed.
- Keep existing `preventDefault` behavior where it is required for the gesture.
- Keep reduced-motion behavior unchanged.
- Do not change the visual height, spring duration, indicator style, or content transform.

Expected benefit:

- Less React work during finger movement.
- Smoother pull gestures on Dashboard and Team.
- Fewer frame drops while heavy content is underneath the transformed layer.

Risk level:

- Low.

Verification steps:

- Pull slowly and quickly at 320px and 390px widths.
- Confirm threshold trigger is unchanged.
- Confirm haptic still fires only when crossing the threshold.
- Confirm normal vertical scroll still works.
- Confirm horizontal gestures are not captured.
- Confirm reduced-motion remains calm.

Rollback notes:

- Revert the hook change only. No data or visual rollback needed.

### 3. Throttle Heatmap Scroll Side Effects

`SavingsHeatmap` updates scroll hint state and session storage from scroll events. This should be rAF-batched and storage writes should not run on every scroll tick.

Likely involved files:

- `src/components/SavingsHeatmap/SavingsHeatmap.tsx`

Implementation checklist:

- Preserve the exact heatmap UI, cell layout, popover behavior, scroll position persistence, and copy.
- Batch `canScrollRight` updates with requestAnimationFrame.
- Avoid setting state when the value does not change.
- Debounce or idle-delay session storage writes so scrolling is not blocked.
- Keep initial auto-scroll behavior unchanged.

Expected benefit:

- Smoother horizontal heatmap scroll.
- Less main-thread work while scrolling Dashboard.

Risk level:

- Low.

Verification steps:

- Scroll heatmap horizontally several times.
- Leave Dashboard and return; confirm saved heatmap position still restores.
- Tap amount cells and deadline cells; confirm popovers position correctly.
- Confirm no visual change to month labels, boundaries, or cells.

Rollback notes:

- Revert only the scroll batching change.

### 4. Avoid Redundant Animated Number Work During Route Entry

`useAnimatedNumber` already checks `isPageTransitioning()` and has an animation slot budget. Phase 1 should tighten usage without changing the visible number result.

Likely involved files:

- `src/hooks/useAnimatedNumber.ts`
- `src/lib/animationBudget.ts`
- `src/components/HeroCard/HeroCard.tsx`
- `src/components/TotalVaultCard/TotalVaultCard.tsx`
- `src/components/BucketRow/BucketRow.tsx`
- `src/components/SavingPlanCard/SavingPlanCard.tsx`
- `src/components/ProjectedProgressCard/ProjectedProgressCard.tsx`

Implementation checklist:

- Keep the same displayed numbers and formatting.
- Do not remove number animation.
- Ensure small deltas still snap when visually indistinguishable.
- Ensure values snap during page transitions instead of competing with route motion.
- Confirm slots are always released on cancel/unmount.
- Do not increase concurrent animation slots in Phase 1.

Expected benefit:

- Fewer React commits during page entry and data refresh.
- Lower chance that Dashboard cards and route transitions stutter together.

Risk level:

- Low if limited to guard tightening and cleanup correctness.

Verification steps:

- Navigate to Dashboard repeatedly.
- Confirm numbers are correct immediately after load.
- Add a deposit and confirm number animation still appears after the sheet closes.
- Check reduced-motion.

Rollback notes:

- Revert only the number hook changes.

### 5. Trim Long-Lived `will-change`

Long-lived `will-change` can consume memory and pressure compositing on weak devices. Phase 1 should ensure it exists only while an element is actively animating.

Likely involved files:

- `src/components/PageTransition/PageTransition.tsx`
- `src/styles/global.css`
- Animation-related components that set inline `will-change`

Implementation checklist:

- Keep the same route transition movement and opacity.
- Keep `will-change` during the transition.
- Clear it after the transition completes.
- Do not add broad `will-change` to static glass, cards, charts, or lists.
- Do not change transition duration, easing, or direction.

Expected benefit:

- Lower memory/compositor pressure on lower-end devices.

Risk level:

- Low.

Verification steps:

- Navigate Dashboard, Team, Profile, and back.
- Confirm direction still matches forward/back.
- Confirm no horizontal scroll leak.
- Confirm route transition looks identical.

Rollback notes:

- Revert only the `will-change` lifetime change.

## What Phase 1 Must Not Do

- Do not remove blur, glass, shadow, gradients, shimmer, rings, or chart animation.
- Do not change motion timing or easing unless a change is purely internal and visually identical.
- Do not redesign Dashboard, Team, cards, sheets, or charts.
- Do not alter route behavior.
- Do not touch backend, money logic, i18n, haptics, notifications, or Android widgets.

## Phase 1 Acceptance Criteria

- Pull-to-refresh feels smoother on Dashboard and Team.
- Heatmap scroll does not stutter as easily.
- Route entry has fewer overlapping number updates.
- Visual output is unchanged.
- Product behavior is unchanged.
- Baseline and after notes exist.

