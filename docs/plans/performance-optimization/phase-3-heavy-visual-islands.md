# Phase 3: Heavy Visual Islands

## Purpose

Phase 3 targets expensive visual regions without reducing their quality. The goal is to keep the same blur, shadow, glass, gradients, card depth, chart design, and motion feel while reducing the amount of the page that repaints or re-renders when those regions animate.

Think of these areas as visual islands:

- Hero card.
- Dashboard bucket grid.
- Momentum chart.
- Team podium and rings.
- Savings heatmap.
- Sheets and modals.
- Glass/blur/shadow surfaces.

## Hero Card Plan

Likely involved files:

- `src/components/HeroCard/HeroCard.tsx`
- `src/components/TotalVaultCard/TotalVaultCard.tsx`
- `src/styles/global.css`
- `src/hooks/useAnimatedNumber.ts`

Observed risk:

- Image-backed card.
- Blurred feather layer.
- Pattern overlay.
- Multiple drop shadows.
- Animated numbers.
- Progress fill animation.
- Rotating goal line.

Plan:

- Keep the hero image, scrim, feather blur, pattern, text shadows, and progress glow visually identical.
- Ensure expensive layers are contained to the card boundary.
- Avoid parent layout invalidation when progress or line ticker changes.
- Defer number/progress animation until route transition is complete.
- Avoid starting ticker line animation during page entry.
- Audit whether progress fill can be transform-based while looking identical.
- Memoize computed style objects and derived time labels only where traces show unnecessary rerenders.

Risk:

- Medium if containment affects overflow, feathering, or z-index.

Verification:

- Compare screenshots of custom cover, fallback cover, and category fallback.
- Confirm feathered edge and scrim look unchanged.
- Confirm edit/change-cover buttons remain clickable.
- Confirm Thai text remains readable and unclipped.

## Charts Plan

Likely involved files:

- `src/components/MomentumChart/MomentumChart.tsx`
- `src/components/ComparisonTrendChart/ComparisonTrendChart.tsx`
- `src/components/SavingRaceChart/SavingRaceChart.tsx`
- `src/pages/Team.tsx`

Observed risk:

- `MomentumChart` runs a requestAnimationFrame value tween.
- SVG paths and text are recalculated during tween.
- Compare controls animate max-width and dropdown layout.
- Popovers measure DOM size and position.
- Line charts use draw-on animations.

Plan:

- Keep chart visuals, labels, gradients, colors, popovers, and mode behavior identical.
- Avoid chart morph during route transition or sheet open.
- Batch chart state updates through the motion scheduler.
- Avoid recalculating static chart geometry during every animated frame.
- Memoize derived markers, labels, layout constants, and path helpers where they currently recalculate without data changes.
- Keep popover measurement only when popover is open.
- Avoid layout-affecting compare control animation during chart morph if transform/opacity can match the same look.

Risk:

- Medium. Chart correctness and labels are user-facing.

Verification:

- Room, Me, Compare mode switching.
- Purpose filter changes.
- Empty-state message.
- Popover positioning at left, middle, and right bars.
- Thai and English labels.
- Before/after visual screenshots.

## Team Plan

Likely involved files:

- `src/pages/Team.tsx`
- `src/components/TeamSection/TeamSection.tsx`
- `src/components/ProgressRing/ProgressRing.tsx`
- `src/components/LeaderProgressRing/LeaderProgressRing.tsx`
- `src/components/ProgressBar/ProgressBar.tsx`
- `src/components/MomentumChart/MomentumChart.tsx`

Observed risk:

- Team shell uses large glass/backdrop blur.
- Member menu uses `backdrop-blur-2xl`.
- Leader ring uses SVG filters and repeating shimmer.
- Room progress bar can shimmer.
- Team page also mounts MomentumChart and activity feed.

Plan:

- Keep glass, blur, ring glow, shimmer, podium, and chart visual output unchanged.
- Delay ring sweep and shimmer until page transition completes.
- Pause ring shimmer when the Team section is offscreen.
- Ensure SVG filter area does not invalidate more than the ring island.
- Memoize sorted leaderboard entries and member rows only if they rerender from unrelated data updates.
- Avoid running Team ring animation while chart mode is morphing.

Risk:

- Medium because ring/glass effects are part of the premium visual feel.

Verification:

- Team with 1, 2, 3, and 4+ members.
- Open/close member menu.
- Tap member to open detail modal.
- Nudge flow remains unchanged.
- Compare ring glow and shimmer before/after.

## Heatmap Plan

Likely involved files:

- `src/components/SavingsHeatmap/SavingsHeatmap.tsx`
- `src/lib/savingsHeatmap.ts`

Observed risk:

- Large number of cells.
- Horizontal scroll.
- Month boundaries and labels.
- Popover positioning with DOM reads.
- Scroll state updates and session storage writes.

Plan:

- Keep all cells, labels, colors, markers, and popovers visually identical.
- Batch scroll side effects through requestAnimationFrame.
- Debounce persistence writes.
- Memoize heatmap build inputs and due-date maps where useful.
- Use containment carefully so popovers and fade affordances still render correctly.
- Do not virtualize in Phase 3 unless traces prove heatmap DOM size is a primary bottleneck.

Risk:

- Low to medium.

Verification:

- Scroll heatmap.
- Restore saved scroll position.
- Tap normal day cell.
- Tap bucket due cell.
- Test short and long project timelines.

## Sheets And Modals Plan

Likely involved files:

- `src/components/Modal/Modal.tsx`
- `src/components/BucketSheet/BucketSheet.tsx`
- `src/components/BucketTransferSheet/BucketTransferSheet.tsx`
- `src/components/CheckBalanceSheet/CheckBalanceSheet.tsx`
- `src/components/VaultUpdatePreviewModal/VaultUpdatePreviewModal.tsx`
- `src/components/OutcomeModal/OutcomeModal.tsx`

Observed risk:

- Sheet transform is good, but inner stagger, chart preview, shadows, success ring, and backdrop all begin close together.
- Some sheet content can include SVG charts and animated projected progress.

Plan:

- Keep backdrop, spring, drag-to-dismiss, success ring, and content layout unchanged.
- Make sheet movement primary and inner content stagger secondary.
- Defer chart preview animation until sheet is open.
- Avoid animating expensive child content during closing.
- Keep modal body scroll and body scroll lock behavior unchanged.
- Consider containment on panel body only if it does not break sticky, focus, or scroll behavior.

Risk:

- Medium because dialogs are interaction-critical.

Verification:

- Bucket sheet open/close.
- Drag-dismiss.
- Confirm deposit success ring and close.
- Bucket transfer edit, review, success.
- Check balance sheet.
- Nested confirm modal.
- Keyboard/focus behavior.

## Glass, Blur, Shadow Containment Plan

Likely involved files:

- `src/styles/global.css`
- `src/components/TeamSection/TeamSection.tsx`
- `src/components/FirstRunProfileWizard/FirstRunProfileWizard.tsx`
- `src/components/CreateRoomWizard/CreateRoomWizard.tsx`
- `src/components/JoinRoomWizard/JoinRoomWizard.tsx`
- `src/components/HeroCard/HeroCardDeposit.tsx`
- Shared surface components using `shadow-*`, `backdrop-blur-*`, and SVG filters.

Plan:

- Do not reduce blur radius, shadow strength, opacity, or glass quality.
- Isolate expensive surfaces so repaint damage stays local.
- Avoid stacking multiple active animated layers over multiple backdrop-filter regions.
- Pause or delay nonessential animations when a blur-heavy overlay is open.
- Do not apply containment blindly to containers that rely on overflow, popovers, sticky headers, fixed children, or z-index escape.

Risk:

- Medium to high if containment is broad.

Verification:

- Visual screenshots before/after for glass surfaces.
- Check popovers and menus.
- Check sticky headers in wizards.
- Check modal overlays.
- Check safe-area and bottom nav.

## Offscreen Effect Pause/Delay Plan

Effects to consider:

- Ring shimmer.
- Progress shimmer.
- Ambient highlights.
- Badge alternation.
- Hero line ticker.
- Chart draw-on.
- Skeleton shimmer.

Rules:

- Do not remove effects.
- Pause only when offscreen, hidden, or during primary interaction.
- Resume when visible and idle.
- Preserve final visual state.
- Avoid IntersectionObserver overuse on tiny components; apply to major islands only.

Risk:

- Medium.

Verification:

- Scroll away and back.
- Navigate away and back.
- Open and close sheets while effects are paused.
- Confirm no animation gets permanently stuck.

