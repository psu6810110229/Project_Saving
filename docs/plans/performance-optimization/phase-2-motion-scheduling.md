# Phase 2: Motion Scheduling

## Purpose

Phase 2 coordinates animation starts. The target is not fewer animations and not lower visual quality. The target is fewer expensive animations competing in the same 200-800ms window.

GO-OUT's individual motions are mostly reasonable. The jank risk comes from overlap:

- Route transition begins.
- Dashboard section stagger begins.
- Hero card numbers tween.
- Progress bars animate width.
- Chart values tween.
- Team rings sweep.
- Shimmer or infinite effects continue.
- Sheet/modal opens.
- Touch gesture updates state.

On stronger devices this feels fine. On weaker devices, the overlap can exceed the frame budget.

## Animation Budget / Scheduling Plan

### Scheduling States

Introduce or extend a small animation scheduling model around existing `src/lib/animationBudget.ts`.

Suggested conceptual states:

- `route-transitioning`
- `sheet-opening`
- `sheet-closing`
- `dragging`
- `scroll-gesture-active`
- `chart-morphing`
- `primary-motion-idle`

This is a coordination layer, not a visual layer. It should not change design tokens, easing, copy, or product behavior.

### Animation Classes

Classify animation work by urgency:

| Class | Examples | Scheduling Rule |
| --- | --- | --- |
| Primary interaction | Route push, sheet open, active drag, button press | Run immediately. |
| Secondary feedback | Number tweens, progress fill, chart morph, ring sweep | Defer until primary motion settles. |
| Ambient/decorative | shimmer, ring shimmer, sweep, hint glint | Delay, pause offscreen, or skip during primary motion without removing the effect generally. |
| Data correctness | Final number values, final chart values, final layout state | Render immediately; animation can be deferred. |

## How To Defer Nonessential Animations

### Route Entry

During `PageTransition`:

- Render final values immediately.
- Defer number tweens until route transition completes.
- Delay Dashboard section child animation until page container is centered, or keep section stagger but defer inner counters/charts.
- Do not start chart morphs during route push.
- Do not start Team ring shimmer during route push.

Likely involved files:

- `src/components/PageTransition/PageTransition.tsx`
- `src/lib/animationBudget.ts`
- `src/hooks/useAnimatedNumber.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/Team.tsx`
- `src/components/HeroCard/HeroCard.tsx`
- `src/components/MomentumChart/MomentumChart.tsx`
- `src/components/TeamSection/TeamSection.tsx`

### Sheet Open/Close

When a sheet opens:

- Sheet transform is primary.
- Backdrop opacity is primary.
- Sheet content stagger is secondary.
- Chart previews inside sheets are secondary.
- Number/progress tweens inside the sheet should wait until the sheet is mostly open.

Likely involved files:

- `src/components/BucketSheet/BucketSheet.tsx`
- `src/components/BucketTransferSheet/BucketTransferSheet.tsx`
- `src/components/CheckBalanceSheet/CheckBalanceSheet.tsx`
- `src/components/ComparisonTrendChart/ComparisonTrendChart.tsx`
- `src/components/ProjectedProgressCard/ProjectedProgressCard.tsx`

### Drag

During active drag:

- Drag transform is primary.
- Drop target highlight is primary.
- Number tweens, badge flips, ambient highlights, and nonessential progress animations should not start.
- DnD measuring should not be paired with unrelated React animation work.

Likely involved files:

- `src/pages/Dashboard.tsx`
- `src/components/BucketDragCard/BucketDragCard.tsx`
- `src/components/SortableBucketCard/SortableBucketCard.tsx`
- `src/components/BucketRow/BucketRow.tsx`
- `src/lib/animationBudget.ts`

### Chart Morph

When `MomentumChart` changes mode:

- Chart value tween is primary for that card.
- Compare chips and dropdown motion are secondary.
- Legend value animation should not add separate per-frame React work unless measured safe.
- Popover positioning should not run during the morph unless a popover is open.

Likely involved files:

- `src/components/MomentumChart/MomentumChart.tsx`
- `src/pages/Team.tsx`
- `src/components/MomentumPurposePicker/MomentumPurposePicker.tsx`

## How To Avoid Overlapping Expensive Motion

### Centralize "Can Animate Now"

All secondary animation hooks/components should ask one central scheduler whether animation is allowed now.

Candidates:

- `useAnimatedNumber`
- `useAnimatedNumbers`
- `MomentumChart` series tween
- `ProgressRing` sweep
- `LeaderProgressRing` shimmer
- Dashboard section stagger
- Sheet content stagger

Rules:

- If primary motion is active, render final state and skip the secondary tween.
- If too many secondary animations are active, render final state for lower-priority items.
- If the component is offscreen, delay until visible.
- Always preserve final visual state.

### Use Delays Carefully

Preferred delays:

- Route complete + 50-100ms before secondary counters.
- Sheet open complete or 80% complete before inner content/chart work.
- Drag end + settle before badge alternation resumes.
- Team page entry complete before ring shimmer.

Avoid:

- Arbitrary long delays that make the app feel unresponsive.
- Delays that change perceived product behavior.
- Delays that leave placeholder or incorrect values visible.

## Files/Components Likely Involved

- `src/lib/animationBudget.ts`
- `src/lib/motion.ts`
- `src/hooks/useAnimatedNumber.ts`
- `src/components/PageTransition/PageTransition.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Team.tsx`
- `src/components/HeroCard/HeroCard.tsx`
- `src/components/TotalVaultCard/TotalVaultCard.tsx`
- `src/components/BucketRow/BucketRow.tsx`
- `src/components/MomentumChart/MomentumChart.tsx`
- `src/components/ProgressRing/ProgressRing.tsx`
- `src/components/LeaderProgressRing/LeaderProgressRing.tsx`
- `src/components/BucketSheet/BucketSheet.tsx`
- `src/components/BucketTransferSheet/BucketTransferSheet.tsx`

## Risk

Risk level: low to medium.

Main risks:

- Secondary animations might feel less lively if delayed too aggressively.
- Incorrect scheduler cleanup could block animations after navigation.
- Skipped tweens could be noticed if the final state appears too abruptly.

Mitigations:

- Keep final values correct immediately.
- Use trace evidence to decide what to defer.
- Use short deferrals.
- Log or inspect active scheduler state during development.
- Verify every cleanup path.

## Verification

Scenarios:

- Dashboard route entry with fresh data.
- Dashboard route entry after data changes.
- Team route entry with 1, 2, 3, and 4+ members.
- Team chart mode switch.
- Bucket sheet open, confirm, success, close.
- Bucket drag start, drag over target, drop, and post-drop sheet open.

Pass criteria:

- No visible loss of visual quality.
- No missing animation for primary interactions.
- Fewer visible stutters during route and sheet transitions.
- Counters and charts end at correct values.
- Animations resume after route/sheet/drag completes.
- Reduced-motion still shows near-static UI.

