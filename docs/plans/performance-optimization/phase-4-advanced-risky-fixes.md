# Phase 4: Advanced Risky Fixes

## Purpose

Phase 4 is deferred. Do not start this phase unless Phases 1-3 are measured and still insufficient.

These changes can improve performance, but they carry higher risk because they may affect architecture, gesture behavior, layout, accessibility, or visual output.

## Rule For Entering Phase 4

Only enter Phase 4 if:

- Before/after traces from Phases 1-3 still show visible jank.
- The remaining bottleneck is clearly attributable to one of the risky areas below.
- The proposed change has a rollback plan.
- The visual and product behavior no-touch list remains protected.

## Risky Area 1: DnD Architecture

Likely involved files:

- `src/pages/Dashboard.tsx`
- `src/components/BucketDragCard/BucketDragCard.tsx`
- `src/components/SortableBucketCard/SortableBucketCard.tsx`
- `src/components/BucketGrid/BucketGrid.tsx`
- `src/components/BucketRow/BucketRow.tsx`

Why risky:

- dnd-kit behavior is gesture-sensitive.
- Bucket drag must preserve tap-to-open behavior.
- Reorder and transfer flows have different semantics.
- Bounding/clamping logic uses DOM measurement.
- Post-drag click suppression is user-visible if broken.

Possible advanced options:

- Cache drag bounds more aggressively.
- Reduce measurement frequency during drag.
- Split drag overlay from source card rendering.
- Render a lightweight drag preview while preserving the same visible card quality.
- Suspend nonessential bucket animations during drag.

Do not do unless needed:

- Replacing dnd-kit.
- Changing drag activation delay.
- Changing transfer/reorder behavior.
- Changing bucket layout.

Verification:

- Tap card opens sheet.
- Long press starts drag.
- Drag between buckets opens correct transfer sheet.
- Edit mode reorder persists.
- Remove flow still works.
- Completed bucket section still works.

## Risky Area 2: Chart Architecture

Likely involved files:

- `src/components/MomentumChart/MomentumChart.tsx`
- `src/components/ComparisonTrendChart/ComparisonTrendChart.tsx`
- `src/components/SavingRaceChart/SavingRaceChart.tsx`
- `src/pages/Team.tsx`

Why risky:

- Charts are financial progress communication.
- Axis labels, markers, popovers, and category disclosure must remain correct.
- Mode and purpose filters interact with room/member visibility rules.

Possible advanced options:

- Move SVG geometry calculation into memoized pure model objects.
- Move animation interpolation out of React state and into motion values.
- Precompute paths/rounded bars for target states.
- Split chart into memoized static layers and animated layers.
- Use transform-based bar scaling only if the rounded-top visual remains identical.

Do not do unless needed:

- Canvas rewrite.
- Chart library introduction.
- Visual redesign.
- Removing labels, popovers, markers, or category icons.

Verification:

- Data correctness before/after.
- Visual comparison for every chart mode.
- Popover edge cases.
- Empty states.
- Thai and English labels.

## Risky Area 3: Framer Motion Architecture

Likely involved files:

- `src/components/PageTransition/PageTransition.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Team.tsx`
- `src/components/Modal/Modal.tsx`
- `src/components/BucketSheet/BucketSheet.tsx`
- `src/components/BucketTransferSheet/BucketTransferSheet.tsx`
- `src/components/Pressable/Pressable.tsx`
- `src/lib/motion.ts`

Why risky:

- Motion architecture affects the whole app feel.
- Existing transitions are part of the product's native-feeling polish.
- Route direction and AnimatePresence behavior are sensitive.

Possible advanced options:

- Replace large wrapper animation with narrower route viewport animation.
- Split route transition from page scroll container.
- Centralize AnimatePresence policies.
- Use LazyMotion or stricter motion feature loading only if bundle/runtime evidence supports it.
- Replace layout animations with explicit transform where possible.

Do not do unless needed:

- Broad rewrite of all motion components.
- Removing Framer Motion.
- Changing route transition style or timing.
- Changing bottom nav behavior.

Verification:

- Forward/back route direction.
- Browser back.
- Modal and sheet stacking.
- Reduced-motion.
- No horizontal scrollbar.
- No page height collapse.

## Risky Area 4: Virtualization

Likely involved files:

- `src/components/SavingsHeatmap/SavingsHeatmap.tsx`
- `src/components/BucketGrid/BucketGrid.tsx`
- Activity feed components.
- Member detail bucket lists.

Why risky:

- Virtualization can change scroll behavior, focus behavior, popover positioning, and layout measurement.
- Heatmap has month labels, boundaries, today markers, and persisted scroll position.
- Bucket grids are DnD surfaces.

Possible advanced options:

- Virtualize only the heatmap horizontal columns for extremely long project timelines.
- Window long activity lists only where list size is proven large.
- Avoid virtualizing DnD bucket grids unless absolutely necessary.

Do not do unless needed:

- Virtualize Dashboard bucket grid in Phase 4 unless DnD traces demand it.
- Add a new virtualization library.
- Change heatmap visual density or marker semantics.

Verification:

- Scroll restoration.
- Popover positioning.
- Month labels and boundaries.
- Keyboard/focus behavior.
- DnD if bucket grid is touched.

## Risky Area 5: Route Transition Changes

Likely involved files:

- `src/components/PageTransition/PageTransition.tsx`
- `src/pages/AppLayout.tsx`
- `src/components/AppShell/AppShell.tsx`

Why risky:

- Route transition behavior is foundational.
- Page scroll containers, bottom nav, data providers, and loading branches interact.
- Incorrect absolute/pop layout can cause height collapse or horizontal scroll.

Possible advanced options:

- Separate animated page shell from scroll container.
- Pre-promote route pages only for transition lifetime.
- Change AnimatePresence mode only with trace evidence.
- Use smaller composited transition surface while preserving the same perceived motion.

Do not do unless needed:

- Change navigation behavior.
- Change route keys.
- Animate bottom nav with the page.
- Remove native-feeling push transition.

Verification:

- Dashboard, Team, Profile, Notifications, Create Room, Join Room.
- Forward and back navigation.
- Loading states.
- No active room state.
- Private-data-free member route branch.
- Reduced-motion.

## Phase 4 Acceptance Criteria

- A Phase 4 change is only accepted if traces show it solves a remaining bottleneck.
- Visual output remains unchanged.
- Product behavior remains unchanged.
- Rollback is straightforward.
- No backend or data semantics are touched.

