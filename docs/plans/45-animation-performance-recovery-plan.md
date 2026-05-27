# 45 - Animation Performance Recovery Plan

## Problem

The app is janky across multiple screens when animations run. The current implementation has several expensive effects that can compete for the same frame budget:

- Full-page route transitions in `src/components/PageTransition/PageTransition.tsx` animate large scroll containers with `x`, `scale`, `opacity`, and `boxShadow`.
- Dashboard mounts a fixed mesh background with multiple large radial gradients and an SVG noise overlay in `src/styles/global.css`.
- `TotalVaultCard` combines an image-backed card, animated sweep, blurred decorative layers, several `backdrop-blur` chips, drop shadows, progress width transitions, and three RAF-driven counters.
- `useAnimatedNumber` is used in several high-visibility cards, creating React state updates every frame per number.
- `MomentumChart` combines RAF value tweening with CSS `animate-bar-grow`, so some chart changes can animate twice.
- Several modal/sheet backdrops use `backdrop-blur`, and the bottom nav uses `backdrop-blur-xl`.
- Drag hints animate `filter: drop-shadow(...)`, which is costly while moving.
- Ambient and shimmer animations are infinite, so they can keep the compositor busy even when the user is not interacting.

## Goal

Make motion feel responsive rather than decorative. Target:

- Route changes and sheet opens feel stable on mobile viewport widths `320`, `375`, and `390`.
- No visible app-wide stutter when a single component animates.
- Keep all recurring motion transform/opacity-only where possible.
- Avoid animating paint-heavy properties: `filter`, `backdrop-filter`, `box-shadow`, `width`, large gradients, and layout/grid properties.
- Respect `prefers-reduced-motion` and add an internal low-motion/perf mode if needed.

## Phase 0 - Measure First

1. Capture baseline traces on Dashboard, Add Money, Profile, and modal/sheet flows.
2. Record three scenarios:
   - route transition into Dashboard,
   - opening and closing BucketSheet / BucketTransferSheet,
   - changing Daily Deposit Trend mode and compare member.
3. Track:
   - dropped frames / FPS,
   - long tasks,
   - layout + paint time,
   - React commit frequency,
   - GPU raster spikes.
4. Keep screenshots or trace notes in `test-results/perf/` so each phase can prove improvement.

## Trace Protocol - Before And After

Purpose: every performance change must have a comparable trace. Use the same viewport, account state, route, and interaction script before and after each phase.

### Trace Storage

Store all captures under:

- `test-results/perf/before/`
- `test-results/perf/after-phase-1/`
- `test-results/perf/after-phase-2/`
- `test-results/perf/after-phase-3/`
- `test-results/perf/after-phase-4/`

Suggested file names:

- `dashboard-route-transition-390.trace.json`
- `dashboard-scroll-390.trace.json`
- `bucket-sheet-open-close-390.trace.json`
- `momentum-chart-mode-switch-390.trace.json`
- `profile-route-transition-390.trace.json`
- `summary.md`

### Baseline Trace - Before Any Fix

1. Build or run the app in the same mode used for verification.
2. Use mobile viewport `390x844` first. If time allows, repeat `320x700`.
3. Capture these baseline traces:
   - Dashboard route entry: navigate from `/profile` to `/dashboard`.
   - Dashboard scroll: slowly scroll top to bottom and back to top.
   - BucketSheet open/close: tap a bucket, open sheet, close it.
   - BucketTransferSheet open/close if available in the current data state.
   - MomentumChart switch: Room -> Me -> Compare -> Room.
4. In `test-results/perf/before/summary.md`, write:
   - average FPS or observed FPS range,
   - worst frame time,
   - long task count,
   - total scripting time,
   - total rendering/layout time,
   - total painting/raster time,
   - visible stutter notes.

### After Trace - After Each Phase

After completing each phase, repeat the same trace set and save it in that phase's folder.

For every `after-phase-* / summary.md`, include:

- phase changes included in the trace,
- same metrics as baseline,
- percent change vs baseline,
- percent change vs previous phase,
- any visual regressions,
- whether the next phase is still needed.

Use this format for each scenario:

| Scenario | Before | After | Change | Pass/Fail | Notes |
| --- | ---: | ---: | ---: | --- | --- |
| Route transition worst frame | TBD | TBD | TBD | TBD | TBD |
| Dashboard scroll dropped frames | TBD | TBD | TBD | TBD | TBD |
| Sheet open long tasks | TBD | TBD | TBD | TBD | TBD |
| Chart switch scripting time | TBD | TBD | TBD | TBD | TBD |

### Trace Rules

- Do not compare dev-server traces against production-build traces.
- Do not compare logged-out traces against logged-in Dashboard traces.
- Keep the same viewport and browser for before/after.
- Wait for initial data loading to settle before starting each recording.
- Run each scenario twice if results look noisy; keep the cleaner second run and note it.
- Record reduced-motion separately. Do not mix it with normal-motion metrics.

### Improvement Formula

Use this when filling `summary.md`:

```text
improvement_percent = ((before - after) / before) * 100
```

This works for metrics where lower is better, such as dropped frames, long tasks, scripting time, rendering time, and paint/raster time.

For FPS, use:

```text
fps_gain_percent = ((after - before) / before) * 100
```

### Go / No-Go Gates

Proceed to the next phase only if one of these is true:

- the current phase improves at least one major jank metric by `15%+`,
- the current phase fixes a visible stutter even if the trace is noisy,
- the trace shows the remaining bottleneck clearly belongs to the next phase.

Stop and reassess if:

- total scripting/rendering/painting time gets worse by `10%+`,
- the UI visually regresses,
- the app still stutters but traces do not show where the time is going.

## Phase 1 - Quick Stabilizers

Purpose: remove the largest app-wide frame killers with minimal visual risk.

1. Simplify `PageTransition`:
   - Remove animated `boxShadow`.
   - Remove `scale`.
   - Reduce travel from `96%` to a small `24px` to `32px` slide plus opacity.
   - Keep `will-change` only during the transition, not forever on every page scroll container.
2. Disable infinite ambient work by default:
   - Turn off `.ambient-glass::after`.
   - Turn off `.vault-credit-card::before` sweep.
   - Keep shimmer only on short-lived loading skeletons.
3. Replace expensive backdrop blur in persistent UI:
   - Change BottomNav from `backdrop-blur-xl` to a solid or near-solid background.
   - Keep modal blur only if the open modal is the only moving layer.
4. Remove `filter: drop-shadow(...)` from drag hint keyframes. Use static `box-shadow` or opacity/transform only.

## Phase 2 - Dashboard-Specific Recovery

Purpose: Dashboard is the densest screen and likely the worst offender.

1. Replace fixed `dashboard-mesh-bg` with a static lightweight background:
   - Remove SVG noise overlay.
   - Reduce radial gradients to 1-2 static layers or use a flat warm canvas.
2. Audit Dashboard entrance animation:
   - Keep stagger only for first mount.
   - Do not replay stagger on every data refresh.
   - Reduce child count animated by Framer Motion.
3. Remove double chart animation:
   - In `MomentumChart`, choose either RAF tweening or CSS `animate-bar-grow`, not both.
   - Prefer one RAF tween for the SVG values and remove per-bar CSS animation.
4. Avoid animating layout/grid where possible:
   - Replace `grid-template-*` transitions in compare controls with opacity/transform and fixed-height wrappers.

## Phase 3 - React Render Budget

Purpose: stop animations from causing too many React commits.

1. Refactor `useAnimatedNumber`:
   - Add a global/concurrent animation budget.
   - Batch card numbers into one hook per card where possible.
   - Skip number tweening when the value delta is small or when the page is entering.
2. Memoize heavy Dashboard sections:
   - Split dense areas into memoized components: vault, race chart, bucket list, activity feed.
   - Ensure unrelated realtime updates do not re-render animated cards.
3. Keep display numbers stable during route transitions:
   - Render final values during initial page enter.
   - Start number morphs only after the page transition completes, or not at all on initial mount.

## Phase 4 - Surface And Glass Policy

Purpose: keep the style without making every layer expensive.

1. Define a `perf-surface` rule:
   - persistent chrome: no `backdrop-filter`,
   - scrolling lists: no `backdrop-filter`,
   - animated elements: no animated shadow/filter/blur,
   - modal overlay: at most one blur layer.
2. Replace `liquid-glass*` usage with static surface tokens unless a screen has a clear need.
3. Remove internal `backdrop-blur-md` chips from `TotalVaultCard`; use translucent fill + border only.
4. Keep decorative blur blobs static and rare; remove them from components that already animate.

## Phase 5 - Verification

1. Run build and lint:
   - `npm run build`
   - `npm run lint`
2. Capture final after traces:
   - save final traces in `test-results/perf/after-final/`,
   - compare against `test-results/perf/before/summary.md`,
   - write the final measured improvement range in `test-results/perf/after-final/summary.md`.
3. Use Browser/Playwright to verify:
   - `320x700`, `375x812`, `390x844`, desktop width.
   - route changes,
   - Dashboard scroll,
   - BucketSheet open/close,
   - MomentumChart mode switch,
   - reduced-motion mode.
4. Acceptance criteria:
   - no visible stutter during route transition,
   - bottom nav stays stable,
   - sheets open without freezing Dashboard behind them,
   - chart mode switch does not make the whole app hitch,
   - reduced-motion users get near-static UI.
5. Final reporting:
   - report the measured percent improvement per scenario,
   - call out which phase produced the biggest win,
   - keep any unresolved bottlenecks as follow-up tasks.

## Suggested Order

1. Phase 1 first. It should produce the biggest immediate improvement.
2. Then Phase 2, because Dashboard has the highest animation density.
3. Then Phase 3 if traces still show React commit pressure.
4. Phase 4 can run alongside the visual polish pass once performance is stable.

## Initial Hotspot Files

- `src/components/PageTransition/PageTransition.tsx`
- `src/styles/global.css`
- `src/components/TotalVaultCard/TotalVaultCard.tsx`
- `src/hooks/useAnimatedNumber.ts`
- `src/components/MomentumChart/MomentumChart.tsx`
- `src/components/BottomNav/BottomNav.tsx`
- `src/components/BucketSheet/BucketSheet.tsx`
- `src/components/BucketTransferSheet/BucketTransferSheet.tsx`
- `src/components/BucketDragCard/BucketDragCard.tsx`
