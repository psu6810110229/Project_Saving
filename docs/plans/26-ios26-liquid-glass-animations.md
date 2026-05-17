# Task 26 — iOS 26 Liquid Glass Animations

Inspired by Apple's iOS 26 Liquid Glass design language. The goal is to
deepen GO-OUT's existing warm identity with translucent depth, spring
physics, and ambient material effects — without turning it into a cold
iOS clone.

For implementation, read:

- For 26.1: sections 1, 2, 3.
- For 26.2: sections 1, 2, 4.
- For 26.3: sections 1, 2, 5.
- For 26.4: sections 1, 2, 6.
- For 26.5: sections 1, 2, 7.
- For 26.6: sections 1, 2, 8.
- For 26.7: sections 1, 2, 9.
- For 26.8: sections 1, 2, 10.

## 1. Current Repo Observations

Existing motion infrastructure (from Task 25):

- `src/lib/motion.ts` exports shared spring/tween tokens.
- `src/components/PageTransition/PageTransition.tsx` uses framer-motion
  `AnimatePresence` with directional push variants.
- `src/components/Skeleton/Skeleton.tsx` has warm shimmer animation.
- `src/components/BottomNav/BottomNav.tsx` uses `bg-bg/80`,
  `backdrop-blur-xl`, and a rounded inner surface (`bg-surface/85`).
- `src/components/BottomTabItem/BottomTabItem.tsx` uses `layoutId`,
  `SPRING.tab`, and `active:scale-[0.96]`.
- `src/components/Modal/Modal.tsx` and `BucketSheet/BucketSheet.tsx`
  already use staggered content reveals with spring constants.
- `src/styles/global.css` has `prefers-reduced-motion` guard, warm
  background gradients, and `.reveal-section` animation.
- `tailwind.config.js` defines warm palette (`bg`, `surface`, `well`,
  `brand-*`), neumorphic shadows, and existing keyframes.
- Dashboard uses CSS `animation-delay`-based stagger via
  `.reveal-section` + `revealStyle()`.

Design guardrails:

- Palette stays warm cream/terracotta/cocoa — no cold gray or blue glass.
- Max 3–4 elements with `backdrop-filter` visible simultaneously.
- All new animations must degrade under `prefers-reduced-motion: reduce`.
- No layout shifts from glass borders or shadows.
- Thai text labels must still fit without clipping.
- Use existing `framer-motion` dependency. No new libraries.

## 2. Motion Principles (iOS 26 Additions)

Building on Task 25's principles, add:

- **Material awareness**: surfaces feel translucent, not opaque. Light
  passes through and around them.
- **Spring-first interaction**: every tappable element responds
  physically to press/release with spring overshoot.
- **Layered depth**: background, content, and chrome exist at different
  visual depths. Scroll changes depth cues.
- **Ambient life**: subtle, slow-cycle highlights on hero surfaces
  suggest a living, light-responsive material.
- **Restraint**: effects are felt, not noticed. If a user can describe
  the animation, it is too much.

## 3. Task 26.1 — Liquid Glass Utility Classes

Goal: add reusable CSS glass surface utilities that blend with the warm
palette.

Target files:

- `src/styles/global.css`

Implementation plan:

- Add `.liquid-glass` utility in `@layer utilities`:
  - `background: rgba(255, 255, 255, 0.12)`
  - `backdrop-filter: blur(20px) saturate(180%)`
  - `-webkit-backdrop-filter` prefixed version
  - `border: 1px solid rgba(255, 255, 255, 0.35)`
  - `border-radius: 20px`
  - Dual box-shadow: outer depth + inner top highlight
  - Transition on transform and box-shadow (0.28s emphasized ease)
- Add `.liquid-glass-warm` variant:
  - `background: rgba(253, 242, 233, 0.45)` (brand-50 translucent)
  - `backdrop-filter: blur(24px) saturate(160%)`
  - `border: 1px solid rgba(250, 217, 189, 0.4)` (brand-100 edge)
  - Inner top highlight + bottom subtle terracotta shadow
- Add `.liquid-glass-dark` variant for surfaces over dark/image BGs:
  - `background: rgba(42, 26, 14, 0.35)` (ink translucent)
  - Higher blur, white edge highlight
- All three variants must include `position: relative` for `::after`
  pseudo-element usage in later tasks.
- Under `prefers-reduced-motion`, disable transition on transform.

Do not:

- Apply the classes to any component yet — that happens in task 26.2.
- Change existing surface/shadow tokens.

Acceptance criteria:

- Three new utility classes exist and build without errors.
- Classes do not affect any existing component.
- `npm run build` and `npm run lint` pass.

## 4. Task 26.2 — Apply Liquid Glass to Hero Cards

Goal: upgrade the three primary Dashboard cards to use warm Liquid Glass.

Target files:

- `src/components/TotalVaultCard/TotalVaultCard.tsx`
- `src/components/HeadToHeadCard/HeadToHeadCard.tsx`
- `src/components/SavingPlanCard/SavingPlanCard.tsx`

Implementation plan:

- Replace the existing `bg-surface shadow-neuRaised` (or similar) card
  wrapper with `liquid-glass-warm` on each component.
- Keep `rounded-xl` or `rounded-2xl` as-is — the utility's
  `border-radius: 20px` is a default that can be overridden.
- Ensure text contrast remains readable against the translucent BG.
  Test with both light body BG and the warm radial gradient visible.
- If any card uses `overflow-hidden`, make sure the glass border is not
  clipped. Move `overflow-hidden` to an inner wrapper if needed.
- Keep all existing padding, gap, and layout unchanged.
- Verify Thai labels still fit.

Do not:

- Change card data logic or props.
- Add framer-motion to cards that do not already use it.

Acceptance criteria:

- Three hero cards render with translucent glass surfaces.
- Text is readable over the glass.
- No layout shift compared to before.
- Mobile (360px) still looks correct.
- `npm run build` and `npm run lint` pass.

## 5. Task 26.3 — Pressable Spring Interaction Wrapper

Goal: add physical press/release spring feedback to tappable cards.

Target files:

- Create `src/components/Pressable/Pressable.tsx`
- `src/lib/motion.ts` (add `SPRING.press` token)

Implementation plan:

- Create a `Pressable` wrapper component:
  - Renders a `motion.div` with `whileTap={{ scale: 0.97, y: 2 }}`
    and `whileHover={{ scale: 1.01, y: -1 }}`.
  - Uses a new `SPRING.press` token: `{ type: 'spring', damping: 20,
    stiffness: 400, mass: 0.8 }`.
  - Accepts `children`, `onClick`, `className`, `disabled`, and
    `ariaLabel` props.
  - When `disabled`, skip motion props.
  - Under reduced motion (via `useReducedMotion`), set whileTap to
    `{ opacity: 0.85 }` only.
- Add `SPRING.press` to `src/lib/motion.ts`.
- Do NOT apply `Pressable` to any existing component yet — that
  happens in 26.4.

Acceptance criteria:

- `Pressable` component exists, exports, and type-checks.
- `SPRING.press` is exported from motion tokens.
- No existing component is changed.
- `npm run build` and `npm run lint` pass.

## 6. Task 26.4 — Apply Pressable to Dashboard Cards

Goal: wrap interactive Dashboard cards with `Pressable` for tactile
spring feedback.

Target files:

- `src/components/BucketRow/BucketRow.tsx` (if it has `onClick`)
- `src/components/TotalVaultCard/TotalVaultCard.tsx`
- `src/components/SavingPlanCard/SavingPlanCard.tsx`
- `src/components/MicroGoalCard/MicroGoalCard.tsx`

Implementation plan:

- Wrap the root element of each card with `Pressable` only when the
  card has an `onClick`/`onConfigure`/`onEdit` handler.
- If the card already uses `motion.div` at the root, merge whileTap /
  whileHover into the existing motion element instead of double-
  wrapping.
- Remove any existing `active:scale-[0.98]` CSS on these cards since
  the spring animation replaces it.
- Keep `active:scale-[0.96]` on `BottomTabItem` — that is CSS-driven
  and already tuned.

Do not:

- Add Pressable to non-interactive cards or read-only displays.
- Change any data/logic props.

Acceptance criteria:

- Tapping a card produces visible spring sink + release.
- Hovering (desktop) produces subtle lift.
- Reduced-motion users get opacity feedback only.
- No double-animation or jank.
- `npm run build` and `npm run lint` pass.

## 7. Task 26.5 — Staggered Content Cascade Upgrade

Goal: replace CSS `animation-delay` stagger on Dashboard with Framer
Motion spring stagger for interruptible, GPU-composited cascading.

Target files:

- `src/pages/Dashboard.tsx`

Implementation plan:

- Define `containerVariants` and `sectionVariants` using framer-motion:
  - `containerVariants`: `staggerChildren: 0.06`, `delayChildren: 0.04`
  - `sectionVariants`: enter from `{ opacity: 0, y: 16, scale: 0.995 }`
    to `{ opacity: 1, y: 0, scale: 1 }` with `SPRING.content`.
- Replace the outer `<div className="flex flex-col gap-6">` with
  `<motion.div variants={containerVariants} initial="hidden"
  animate="visible">`.
- Replace each `className="reveal-section"` and `style={revealStyle(N)}`
  with `<motion.div variants={sectionVariants}>` (or `motion.header`,
  `motion.section` as appropriate).
- Remove the `revealStyle()` helper function if it is no longer used
  anywhere else.
- Keep `.reveal-section` in `global.css` in case other pages use it.

Do not:

- Change data fetching, state, or child component props.
- Apply this to other pages yet.

Acceptance criteria:

- Dashboard sections cascade in with spring physics on mount.
- Navigating away mid-cascade does not cause jank.
- Content order and layout are identical to before.
- `npm run build` and `npm run lint` pass.

## 8. Task 26.6 — Haptic-Paired Success Micro-Animation

Goal: add a visible "success ring" pulse when a deposit is confirmed.

Target files:

- `src/styles/global.css` or `tailwind.config.js` (new keyframe)
- `src/components/BucketSheet/BucketSheet.tsx`

Implementation plan:

- Add `success-ring` keyframe to `tailwind.config.js`:
  - `0%`: `box-shadow: 0 0 0 0 rgba(242,107,26,0.3)`
  - `70%`: `box-shadow: 0 0 0 16px rgba(242,107,26,0)`
  - `100%`: `box-shadow: 0 0 0 0 rgba(242,107,26,0)`
- Add corresponding animation: `success-ring 0.5s ease-out both`.
- In `BucketSheet`, after successful `onConfirm` (before the micro-
  bounce close), briefly apply `animate-success-ring` to the Confirm
  button or the inner sheet wrapper via a state flag.
- The ring animation should fire once, then the sheet closes with its
  existing micro-bounce.
- Under reduced motion, the ring is suppressed by the global guard.

Do not:

- Change the confirm logic or error handling.
- Add confetti, particle effects, or anything attention-seeking.

Acceptance criteria:

- Confirming a deposit shows a brief brand-orange ring pulse.
- The ring resolves before the sheet exit animation starts.
- No new dependencies.
- `npm run build` and `npm run lint` pass.

## 9. Task 26.7 — Dynamic Blur Depth on Bottom Nav

Goal: make the BottomNav blur intensity respond to scroll position for
a depth-aware feel.

Target files:

- `src/components/BottomNav/BottomNav.tsx`
- `src/components/PageTransition/PageTransition.tsx` (add data
  attribute to scroll container)

Implementation plan:

- In `PageTransition`, add `data-page-scroll` attribute to the
  `motion.div` that has `overflow-y-auto`.
- In `BottomNav`, listen to the scroll event on
  `[data-page-scroll]` (passive listener).
- Compute blur intensity: `Math.min(20, 8 + scrollY * 0.04)`.
- Compute background opacity: `Math.min(0.92, 0.65 + scrollY * 0.001)`.
- Apply as inline style on the nav wrapper, overriding the static
  `backdrop-blur-xl` and `bg-bg/80`.
- Use `requestAnimationFrame` or throttle to avoid layout thrashing.
- Under reduced motion, keep static blur (skip scroll listener).
- Clean up listener on unmount.

Do not:

- Change tab items, layout, or routing logic.
- Add scroll listeners to `window` — use the scoped scroll container.

Acceptance criteria:

- BottomNav is more transparent at page top, more opaque when scrolled.
- Scrolling feels smooth with no jank.
- Reduced-motion users get static blur.
- `npm run build` and `npm run lint` pass.

## 10. Task 26.8 — Ambient Material Highlight on Hero Cards

Goal: add a slow, drifting specular highlight to hero cards that
suggests a light-responsive material.

Target files:

- `src/styles/global.css` (new keyframe + utility)
- `src/components/TotalVaultCard/TotalVaultCard.tsx`
- `src/components/HeadToHeadCard/HeadToHeadCard.tsx`

Implementation plan:

- Add `ambient-highlight` keyframe to `global.css`:
  - Slides a thin translucent gradient band left-to-right over 8s,
    then returns.
- Add `.ambient-glass` utility that applies the highlight via `::after`
  pseudo-element:
  - `position: absolute; inset: 0; border-radius: inherit;`
  - Gradient: transparent → white/8% → white/15% → white/8% →
    transparent at a 105° angle.
  - `background-size: 300% 100%`
  - `animation: ambient-highlight 8s ease-in-out infinite`
  - `pointer-events: none`
- Apply `.ambient-glass` to `TotalVaultCard` and `HeadToHeadCard`
  root elements (which should already have `position: relative` from
  the liquid-glass utility).
- Under reduced motion, the global guard kills the animation
  automatically — the pseudo-element stays invisible since it starts at
  `-200%` off-canvas.

Do not:

- Use gyroscope or device orientation APIs.
- Make the highlight bright enough to distract from content.

Acceptance criteria:

- A very subtle light highlight slowly drifts across hero cards.
- Effect is invisible under reduced motion.
- No performance regression (single pseudo-element, CSS-only).
- `npm run build` and `npm run lint` pass.

## 11. Suggested Implementation Order

1. Liquid Glass utility classes (26.1)
2. Apply Liquid Glass to hero cards (26.2)
3. Pressable spring wrapper (26.3)
4. Apply Pressable to Dashboard cards (26.4)
5. Staggered content cascade upgrade (26.5)
6. Haptic-paired success micro-animation (26.6)
7. Dynamic blur depth on BottomNav (26.7)
8. Ambient material highlight (26.8)

Reason for this order:

- CSS utilities first, then apply them.
- Interaction components next (Pressable), then apply.
- Dashboard cascade is isolated and can be done anytime.
- Success animation is self-contained.
- Dynamic blur and ambient highlight are polish layers on top.

## 12. QA And Verification

After each task:

- Run `npm run build`.
- Run `npm run lint`.
- Commit with descriptive message.

After all tasks:

- Navigate all routes on mobile (360px).
- Check glass surfaces over warm gradient backgrounds.
- Test `prefers-reduced-motion: reduce` in browser DevTools.
- Verify Thai labels are not clipped by glass borders.
- Confirm no horizontal scrollbar appears.
- Check BottomNav scroll blur on long pages (Dashboard).
- Time full Dashboard cascade — should be under 400ms total.

## 13. Risks

### Backdrop-Filter Performance

Multiple `backdrop-filter` elements stacked can cause frame drops on
low-end mobile devices.

Mitigation: limit to 3–4 visible elements max. Hero cards are rarely
all visible simultaneously due to scroll position.

### Text Contrast on Glass

Translucent backgrounds may reduce text contrast below WCAG AA.

Mitigation: use warm-tinted glass (`liquid-glass-warm`) with higher
opacity (0.45) so the cream canvas still provides contrast.

### Layout Shift from Glass Borders

Adding `border: 1px solid ...` to elements that previously had no
border shifts layout by 1px.

Mitigation: use `outline` or `box-shadow` instead if border-box
calculations change dimensions.

### Framer Motion Stagger vs CSS Stagger

Replacing CSS `animation-delay` with Framer Motion stagger in Dashboard
changes the animation engine. Edge cases with `AnimatePresence` or
route re-mounts could behave differently.

Mitigation: test route transitions into and out of Dashboard.

## 14. Definition Of Done

Task 26 is complete when:

- All eight subtasks are implemented and committed.
- `npm run build` passes.
- `npm run lint` passes.
- Glass surfaces render correctly on mobile and desktop.
- Spring press feedback feels tactile but not excessive.
- Dashboard cascade uses spring physics.
- Success ring animates on deposit confirm.
- BottomNav blur depth responds to scroll.
- Ambient highlight drifts on hero cards.
- Reduced-motion behavior verified for all new animations.
- Thai labels verified on glass surfaces.
