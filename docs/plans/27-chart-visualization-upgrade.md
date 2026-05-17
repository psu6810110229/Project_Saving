# Task 27 — Chart Visualization Upgrade

Upgrade the three chart components (MomentumChart, SavingRaceChart,
ComparisonTrendChart) from flat static SVG to polished, animated,
interactive visualizations that match the iOS 26 Liquid Glass aesthetic
established in Task 26.

For implementation, read:

- For 27.1: sections 1, 2, 3.
- For 27.2: sections 1, 2, 4.
- For 27.3: sections 1, 2, 5.
- For 27.4: sections 1, 2, 6.
- For 27.5: sections 1, 2, 7.
- For 27.6: sections 1, 2, 8.
- For 27.7: sections 1, 2, 9.

## 1. Current Repo Observations

Chart infrastructure:

- `src/components/MomentumChart/MomentumChart.tsx`: 7-day bar chart
  (daily deposits). Pure SVG with `roundedTopBar()` path helper.
  Supports side-by-side you/partner bars and dashed expected-plan
  tick lines. Uses `chartIdentityColors` (brand-500 = you,
  accentTeal = partner). Y-axis has `niceMax()` rounding. No
  animation, no interactivity.
- `src/components/SavingRaceChart/SavingRaceChart.tsx`: cumulative
  7-day line chart (you vs partner). SVG polylines, no fill, no
  animation. Legend includes running totals.
- `src/components/ComparisonTrendChart/ComparisonTrendChart.tsx`:
  two-line sparkline with a brand-500 area fill. Minimal, no
  interactivity.
- `src/lib/chartIdentity.ts`: shared identity colors
  (`you: palette.brand500`, `partner: palette.accentTeal`).
- `src/lib/theme.ts`: full palette tokens used by SVG code.
- SVG viewBox uses `W=280`, rendered at full container width via CSS.
- Charts are wrapped in `rounded-xl bg-surface shadow-soft p-5`
  cards.
- Dashboard renders MomentumChart inside a `motion.div` that already
  has staggered cascade variants from Task 26.5.

Existing animation tokens (from Task 25/26):

- `tailwind.config.js` keyframes: `fade-in-up`, `fade-in`,
  `scale-in`, `fill-bar`, `shimmer`, `success-ring`.
- `src/lib/motion.ts` SPRING tokens: `tab`, `modal`, `sheet`,
  `content`, `outcome`, `press`.
- `src/styles/global.css`: `.liquid-glass-warm`, `.ambient-glass`,
  `prefers-reduced-motion` global guard.

Design guardrails (carried from Task 26):

- Palette stays warm cream/terracotta/cocoa.
- All new animations must degrade under `prefers-reduced-motion`.
- No layout shifts from new visual treatments.
- Thai text labels must still fit without clipping.
- No new dependencies — use existing framer-motion + CSS + SVG.
- Max 3–4 `backdrop-filter` elements visible simultaneously.

## 2. Chart Design Principles

- **Depth over decoration**: gradients and shadows suggest 3D depth,
  not flat coloring. Bars should feel like physical columns.
- **Motion reveals data**: bars grow on mount, lines draw themselves.
  Animation serves comprehension, not showmanship.
- **Touch responds**: tapping a data point shows its value. Haptic
  feedback confirms interaction.
- **Context at a glance**: the chart should answer "am I on track?"
  without mental arithmetic. Visual cues (today marker, weekly
  summary) reduce cognitive load.
- **Consistency**: all three charts share the same card treatment,
  gradient language, and animation timing.
- **Restraint**: if the animation distracts from the data, remove it.

## 3. Task 27.1 — SVG Gradient Definitions & Chart Bar Gradients

Goal: replace flat bar fills in MomentumChart with vertical gradients
that give bars a lit-from-above depth, and add a subtle drop shadow
filter to bar groups.

Target files:

- `src/components/MomentumChart/MomentumChart.tsx`

Implementation plan:

- Add a `<defs>` block inside the existing `<svg>`:
  - `linearGradient#barGradYou`: vertical, from `brand500` (top) to
    `brand500` at 20% opacity (bottom).
  - `linearGradient#barGradPartner`: vertical, from `accentTeal`
    (top) to `accentTeal` at 20% opacity (bottom).
  - `filter#barShadow`: `feDropShadow` with `dx=0 dy=2 stdDeviation=3
    flood-color=rgba(42,26,14,0.12)`.
- Replace the `fill={chartIdentityColors.you}` on the your-bar
  `<path>` with `fill="url(#barGradYou)"`.
- Replace the `fill={chartIdentityColors.partner}` on the partner-bar
  `<path>` with `fill="url(#barGradPartner)"`.
- Apply `filter="url(#barShadow)"` to each bar `<path>`.
- Keep the existing value labels (`fmtShort`) and their fill colors
  unchanged — they use the solid identity color for readability.
- Keep the legend dots in the header using the solid identity colors.

Do not:

- Change any props, data logic, or component API.
- Touch SavingRaceChart or ComparisonTrendChart yet.
- Add framer-motion to this component.

Acceptance criteria:

- Bars render with a top-to-bottom gradient (solid → translucent).
- Bars have a subtle drop shadow visible against the card background.
- Legend dots remain solid colors.
- Value labels remain readable.
- Chart layout and sizing are identical to before.
- `npm run build` and `npm run lint` pass.

## 4. Task 27.2 — Bar Mount Animation (CSS Keyframes)

Goal: animate MomentumChart bars growing from the baseline on mount,
with a per-bar stagger that cascades left to right.

Target files:

- `src/components/MomentumChart/MomentumChart.tsx`
- `tailwind.config.js` (new keyframe)

Implementation plan:

- Add a `bar-grow` keyframe to `tailwind.config.js`:
  - `0%`: `transform: scaleY(0); transform-origin: bottom`
  - `100%`: `transform: scaleY(1); transform-origin: bottom`
- Add corresponding animation: `bar-grow 0.5s
  cubic-bezier(0.16, 1, 0.3, 1) both`.
- In MomentumChart, wrap each bar `<path>` in a `<g>` with:
  - `className="animate-bar-grow"` (Tailwind utility).
  - Inline `style={{ animationDelay: '${i * 60}ms' }}` where `i` is
    the bar index (0–6).
  - Set `transform-origin` to the bottom-center of the bar via a
    `transform` attribute so `scaleY` grows upward from the baseline.
- Because SVG `transform-origin` needs explicit coordinates, compute
  the origin as `transform-origin: ${barCenterX}px ${baselineY}px`
  where `baselineY = PAD_TOP + chartH`.
- The expected-plan dashed tick lines should appear without animation
  (they are reference marks, not data).
- Under `prefers-reduced-motion`, the global guard in `global.css`
  already collapses animation duration to 0.001ms — no extra work
  needed.

Do not:

- Add framer-motion. CSS keyframes are sufficient and lighter.
- Animate Y-axis grid lines or X-axis labels.
- Change the bar gradient work from 27.1.

Acceptance criteria:

- On mount, bars grow upward from the baseline with 60ms stagger.
- The cascade completes within ~500ms total (7 bars × 60ms + 500ms).
- Re-mounting the component (route change) re-triggers the animation.
- Under reduced motion, bars appear instantly.
- No layout shift during or after the animation.
- `npm run build` and `npm run lint` pass.

## 5. Task 27.3 — Liquid Glass Chart Card

Goal: upgrade the chart section card wrapper from `bg-surface
shadow-soft` to the `liquid-glass-warm` treatment, matching the hero
cards from Task 26.2.

Target files:

- `src/components/MomentumChart/MomentumChart.tsx`
- `src/components/SavingRaceChart/SavingRaceChart.tsx`
- `src/components/ComparisonTrendChart/ComparisonTrendChart.tsx`

Implementation plan:

- In MomentumChart, replace `className="rounded-xl bg-surface
  shadow-soft p-5"` on the outer `<section>` with
  `className="liquid-glass-warm p-5"`. The `liquid-glass-warm` utility
  already includes `border-radius: 20px`, matching `rounded-xl`.
- Apply the same swap in SavingRaceChart (`<section>` wrapper).
- Apply the same swap in ComparisonTrendChart (`<section>` wrapper).
- Verify that the SVG `<text>` labels (y-axis, x-axis, value labels)
  remain legible against the translucent glass background. If any
  label has poor contrast, adjust its `fill` from `palette.inkMuted`
  to `palette.ink` or add a slightly more opaque variant.
- Ensure `overflow: hidden` is NOT on the section — the glass border
  and shadow must not be clipped.
- Do not add `.ambient-glass` to chart cards — the drifting highlight
  would compete visually with animated bars. Keep ambient effects on
  hero cards only.

Do not:

- Change chart data, props, or SVG structure.
- Add `backdrop-filter` anywhere new (the utility handles it).

Acceptance criteria:

- All three chart cards render with warm Liquid Glass translucency.
- Text labels on all charts remain readable over the glass.
- Cards render correctly on 360px mobile viewport.
- No additional `backdrop-filter` elements beyond what the utility
  adds (respecting the 3–4 element limit).
- `npm run build` and `npm run lint` pass.

## 6. Task 27.4 — Today Indicator & Improved X-Axis

Goal: add a "today" visual marker to the MomentumChart so the user
instantly knows which bar represents today, and improve x-axis label
weight/contrast.

Target files:

- `src/components/MomentumChart/MomentumChart.tsx`

Implementation plan:

- Accept a new optional prop `todayIndex?: number` — the 0-based index
  of today's bar within the 7-day series. The parent (Dashboard)
  already knows this (it's always index 6 for "most recent = today"
  in `lastSevenDateKeys()`).
- When `todayIndex` is defined, render a small indicator below
  today's x-axis label:
  - A filled circle (radius 2px) in `brand500` centered under the
    label.
  - Optionally a subtle vertical dashed line from the baseline down
    to the label area, in `brand200` at 40% opacity, to create a
    "column highlight" effect.
- Make today's x-axis label bold (`fontWeight="700"`) and use
  `palette.ink` instead of `palette.inkMuted` to stand out.
- All other x-axis labels remain `fontWeight="600"` with
  `palette.inkMuted`.
- In `Dashboard.tsx`, pass `todayIndex={6}` to `<MomentumChart>`.
  (The last element in the series is always today per
  `lastSevenDateKeys()`.)
- In `DashboardHero.tsx`, if it renders `<MomentumChart>`, pass
  `todayIndex={6}` there too.

Do not:

- Change the series data or its ordering.
- Add interactivity (tap handling comes in 27.5).
- Modify the partner bar or expected plan overlay.

Acceptance criteria:

- Today's bar has a small branded dot below its x-axis label.
- Today's label is visually heavier than other day labels.
- The indicator is not rendered when `todayIndex` is undefined.
- Layout does not shift — the dot fits within existing padding.
- Thai day-of-week labels still fit without clipping.
- `npm run build` and `npm run lint` pass.

## 7. Task 27.5 — Tap-to-Reveal Tooltip

Goal: tapping a bar in MomentumChart reveals a floating tooltip
showing the exact deposit value and day label.

Target files:

- `src/components/MomentumChart/MomentumChart.tsx`

Implementation plan:

- Add `useState<number | null>(null)` for `selectedIndex`.
- Add a transparent `<rect>` hit-area over each bar group that
  handles `onClick` / `onPointerDown` to set `selectedIndex`.
  - The rect should cover the full group width × chart height so
    tapping near a short bar still registers.
  - Use `cursor: pointer` and `fill="transparent"` on the rect.
- Tapping the same bar again (or tapping outside) clears the
  selection (`setSelectedIndex(null)`).
- When `selectedIndex` is set, render a tooltip above the selected
  bar:
  - Use SVG `<g>` containing a `<rect>` (pill-shaped via `rx/ry`)
    with `fill=palette.surface` and a subtle shadow filter, plus a
    `<text>` showing the formatted value.
  - Position the tooltip centered above the bar, clamped so it does
    not overflow the SVG viewBox horizontally.
  - If partner bars exist, show both values stacked:
    ```
    คุณ ฿1,600
    พี่เกรีโม ฿5,300
    ```
  - Add a small downward-pointing triangle (SVG `<polygon>`) from
    the tooltip to the bar.
- When selected, dim unselected bars to 40% opacity using
  `opacity={selectedIndex === null || selectedIndex === i ? 1 : 0.4}`
  on each bar `<path>`.
- Fire `haptic('light')` on bar tap for tactile feedback.
- Under reduced motion, the tooltip appears instantly (no transition
  needed — it is a state change, not an animation).

Do not:

- Use `<foreignObject>` — it has inconsistent support in mobile
  Safari. Pure SVG elements only.
- Change chart data or add new data props.
- Modify the chart card wrapper or gradients.

Acceptance criteria:

- Tapping a bar shows a tooltip with the exact value(s).
- Tapping again dismisses the tooltip.
- Unselected bars dim when a bar is selected.
- Tooltip does not overflow the SVG boundary.
- Haptic fires on tap (via existing `haptic()` helper).
- Thai value formatting works correctly in the tooltip.
- `npm run build` and `npm run lint` pass.

## 8. Task 27.6 — SVG Line Drawing Animation

Goal: animate the SavingRaceChart and ComparisonTrendChart polylines
so they appear to draw themselves from left to right on mount.

Target files:

- `src/components/SavingRaceChart/SavingRaceChart.tsx`
- `src/components/ComparisonTrendChart/ComparisonTrendChart.tsx`
- `src/styles/global.css` (new keyframe)

Implementation plan:

- Add a `line-draw` keyframe in `global.css` (inside `@layer
  utilities` or after existing keyframes):
  - `0%`: `stroke-dashoffset: var(--path-length)`
  - `100%`: `stroke-dashoffset: 0`
- In SavingRaceChart:
  - After computing the polyline points string, calculate the
    approximate path length: for N points, length ≈ sum of segment
    distances. Store as a constant.
  - Alternatively, use a generous fixed estimate (e.g. 500) since
    the viewBox is always 280 wide.
  - Set `stroke-dasharray={pathLength}` and
    `stroke-dashoffset={pathLength}` on each `<polyline>`.
  - Apply inline animation:
    `style={{ animation: 'line-draw 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards', animationDelay: '0.1s' }}`.
  - The partner line gets a slightly longer delay (0.2s) so they
    cascade.
  - The expected plan dashed line (when present) gets 0.3s delay.
- In ComparisonTrendChart:
  - Apply the same `stroke-dasharray` / `stroke-dashoffset` technique
    to both `<path>` lines.
  - The area fill `<path>` (brand-500 at 18% opacity) should fade in
    with a simple `opacity` animation (0 → 1 over 0.5s) after the
    line finishes drawing, to avoid visual noise during the draw.
- Under `prefers-reduced-motion`, the global guard already collapses
  all animation durations. The lines appear instantly with their
  final stroke-dashoffset (0), which is the correct visual.

Do not:

- Use JavaScript `requestAnimationFrame` for the draw — CSS
  `stroke-dashoffset` animation is sufficient and GPU-composited.
- Add framer-motion to these components.
- Change the polyline point computation or chart layout.

Acceptance criteria:

- SavingRaceChart lines draw left-to-right on mount (~0.8s).
- ComparisonTrendChart lines draw similarly.
- Area fill in ComparisonTrendChart fades in after the line.
- Partner/expected lines are staggered slightly behind the primary.
- Under reduced motion, all lines appear instantly.
- No layout shift or flicker during the animation.
- `npm run build` and `npm run lint` pass.

## 9. Task 27.7 — Weekly Summary Strip

Goal: add a compact progress bar above the MomentumChart showing the
current week's total vs. the expected plan total, answering "am I on
track this week?" at a glance.

Target files:

- `src/components/MomentumChart/MomentumChart.tsx`

Implementation plan:

- Accept two new optional props:
  - `weekTotal?: number` — sum of the 7-day series (recorded
    deposits this week).
  - `weekExpected?: number` — sum of the 7-day expected plan series
    (planned deposits this week).
- When both props are provided and `weekExpected > 0`, render a
  summary strip between the legend and the SVG:
  - A single row with:
    - Left: "สัปดาห์นี้" label (use `copy.dashboard` — add new copy
      key if needed).
    - Right: `฿{weekTotal} / ฿{weekExpected}` formatted with
      `formatCurrency`.
  - Below the row: a thin progress bar (height 4px, rounded-pill)
    showing `weekTotal / weekExpected` as a percentage.
    - Bar fill: `brand500` if ≥ 80% of expected, `brand200` if below.
    - Bar background: `well` color.
    - Bar width capped at 100% (do not overflow if weekTotal >
      weekExpected).
    - Use `animate-fill-bar` (existing Tailwind animation) with
      `--target-width` CSS variable for the fill animation.
  - Add `mt-2 mb-1` spacing to separate from the legend above and
    SVG below.
- In `Dashboard.tsx`, compute and pass the two new props:
  - `weekTotal`: sum of `dailyAmountSeries(logs, user?.id)`.
  - `weekExpected`: sum of `expectedDailySeries` (already computed,
    may be undefined).
- In `DashboardHero.tsx`, do not pass these props (the hero variant
  does not have expected data).
- When either prop is missing or `weekExpected` is 0, do not render
  the strip (chart renders identically to before).
- Style the progress bar text with `font-mono text-[11px]` to match
  the legend.

Do not:

- Change the SVG chart structure, gradients, or animations.
- Add state or interactivity to the summary strip.
- Make the strip tappable.

Acceptance criteria:

- When plan data is available, a progress strip renders above the
  chart showing week total vs expected.
- The bar fills with the existing `fill-bar` animation.
- Color shifts based on the 80% threshold.
- When plan data is not available, the strip is hidden.
- Thai label text fits without overflow on 360px.
- `npm run build` and `npm run lint` pass.

## 10. Suggested Implementation Order

1. SVG gradient definitions & bar gradients (27.1)
2. Bar mount animation (27.2)
3. Liquid Glass chart card (27.3)
4. Today indicator (27.4)
5. Tap-to-reveal tooltip (27.5)
6. SVG line drawing animation (27.6)
7. Weekly summary strip (27.7)

Reason for this order:

- Gradients first — they change the visual foundation.
- Mount animation second — builds on the gradient work.
- Glass card third — pure card-wrapper swap, independent of SVG.
- Today indicator fourth — small additive feature.
- Tooltip fifth — most complex, benefits from all prior polish.
- Line drawing sixth — targets different components (line charts).
- Weekly summary last — adds new data flow, most risky for layout.

## 11. QA And Verification

After each task:

- Run `npm run build`.
- Run `npm run lint`.
- Commit with descriptive message.

After all tasks:

- Navigate all routes on mobile (360px).
- Verify bar chart renders with gradient + shadow + animation.
- Verify line charts draw on mount.
- Verify glass cards over warm gradient background.
- Test `prefers-reduced-motion: reduce` in browser DevTools.
- Verify Thai labels are not clipped.
- Confirm tooltip appears/dismisses correctly on tap.
- Confirm weekly strip shows correct totals.
- Check that no horizontal scrollbar appears.
- Verify no more than 3–4 backdrop-filter elements visible at once.

## 12. Risks

### SVG Transform-Origin Cross-Browser

SVG `transform-origin` behaves differently across browsers. Firefox
uses the SVG element's local coordinate system while Chrome uses the
viewBox origin.

Mitigation: use explicit `transform-origin` in pixels matching the
bar's baseline position, and test in both Chrome and Safari/Firefox.

### Tooltip Clipping at SVG Edges

The first and last bars are near the SVG viewBox boundaries. A
centered tooltip may overflow.

Mitigation: clamp tooltip X position so it stays within
`PAD_LEFT` to `W - PAD_RIGHT` bounds.

### Performance of stroke-dashoffset Animation

Very long polylines with many segments may stutter during the
dash-offset animation on low-end devices.

Mitigation: the series are always exactly 7 points, producing very
short polylines. No performance concern.

### Weekly Summary Strip Layout Pressure

Adding a row above the chart increases the card height. On very
small screens (320px) this could push the chart below the fold.

Mitigation: the strip is only ~28px tall and optional (hidden when
no plan data). Tested at 360px minimum.

### Gradient Fill on Rounded Bars

SVG `linearGradient` coordinates need `gradientUnits="userSpaceOnUse"`
or the gradient may not align properly across bars of different
heights.

Mitigation: use `gradientUnits="userSpaceOnUse"` with y1/y2
matching the chart's top and bottom padding so the gradient is
consistent across all bars.

## 13. Definition Of Done

Task 27 is complete when:

- All seven subtasks are implemented and committed.
- `npm run build` passes.
- `npm run lint` passes.
- MomentumChart bars render with gradients and mount animation.
- Chart cards use Liquid Glass warm treatment.
- Today indicator highlights the current day.
- Tapping a bar shows a tooltip with exact values.
- SavingRaceChart and ComparisonTrendChart lines draw on mount.
- Weekly summary strip shows progress when plan data is available.
- Reduced-motion behavior verified for all new animations.
- Thai labels verified on all chart components.
