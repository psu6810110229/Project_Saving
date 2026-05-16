# Task 25 - Apple-Style Page Transitions And Loading
For implementation, read:

- For 25.1: sections 1, 2, 3, and 11.
- For 25.2: sections 1, 4, 5, and 11.
- For 25.3 and 25.4: sections 1, 6, 7, and 11.
- For final polish: sections 8, 9, 10, and 12.

GO-OUT is a mobile-first shared savings tracker. The goal is an Apple-inspired interaction pass: calm, crisp, physical, and native-feeling. This means using iOS-like motion principles and soft material surfaces, not copying Apple UI assets or replacing the product's warm GO-OUT visual identity.

## Goal

Make page navigation and loading states feel more polished and app-like:

- Route changes should feel like a native mobile push transition.
- Full-page loading should feel calm and intentional instead of blank plus spinner.
- Skeletons should shimmer softly instead of pulsing harshly.
- Bottom navigation should feel tactile without shifting layout.
- Motion should stay subtle, quick, and respectful of reduced-motion settings.

## Scope And Guardrails

In scope:

- Page transition behavior between protected app routes.
- App/auth/project full-screen loading states.
- Existing data-loading skeleton states.
- Spinner visual behavior.
- Bottom navigation press and active-state motion.
- Shared motion constants if useful.
- Reduced-motion support.

Out of scope:

- Any money logic.
- Saving Plan calculations.
- Database or Supabase migrations.
- i18n copy rewrites beyond using existing loading labels.
- New design system or UI library.
- New routing architecture.
- Large color palette rewrite.
- Landing-page or marketing redesign.
- Notification system changes except ensuring existing notification pages use updated loading primitives.

Use existing dependencies. `framer-motion` is already installed and should remain the motion library.

## 1. Current Repo Observations

Existing files and patterns:

- `src/components/PageTransition/PageTransition.tsx` already wraps protected route content with `AnimatePresence` and uses browser history index to infer direction.
- `src/pages/AppLayout.tsx` renders `PageTransition` around `<Outlet />` only after room data has loaded.
- `src/components/Skeleton/Skeleton.tsx` is a small Tailwind pulse block.
- `src/components/Spinner/Spinner.tsx` is a simple border spinner.
- `src/components/BottomTabItem/BottomTabItem.tsx` already uses a shared-layout `motion.span` indicator and spring constants.
- `src/components/Modal/Modal.tsx` and `src/components/BucketSheet/BucketSheet.tsx` already define local spring constants and staggered content reveals.
- `src/styles/global.css` already has a global `prefers-reduced-motion` guard.
- `src/pages/Dashboard.tsx`, `src/pages/AddMoney.tsx`, `src/pages/SavingPlan.tsx`, `src/pages/Profile.tsx`, `src/pages/CheckBalance.tsx`, `src/pages/Notifications.tsx`, and `src/pages/NotificationSettings.tsx` already use skeletons for data loading.
- `src/components/ProtectedRoute/ProtectedRoute.tsx` and `src/pages/AuthCallback.tsx` use centered spinners for full-page loading.

Important design context:

- The app is warm, cream, peach, and terracotta. Do not turn the interface into a cold gray iOS clone.
- The app is mobile-first with a fixed bottom nav and max-width app shell.
- Thai copy is supported, so loading components must accept labels and avoid tight text containers.

## 2. Motion Principles

Use an Apple-inspired motion system:

- Fast enough to feel responsive.
- Smooth enough to feel physical.
- Small opacity and depth shifts for hierarchy.
- Directional page motion for navigation.
- Spring motion for controls and sheets.
- Short tweens for opacity and material changes.
- No bouncing, confetti, repeated pulsing, or attention-seeking animation.

Recommended timing:

- Page push: `0.32s` to `0.38s`.
- Quick fades: `0.14s` to `0.22s`.
- Skeleton shimmer cycle: `1.4s` to `1.8s`.
- Button press scale: immediate CSS `active:scale-[0.97]` or short spring.

Recommended easing:

- Page transition: `[0.22, 1, 0.36, 1]`.
- Exit fade: `[0.4, 0, 1, 1]`.
- Spring controls: damping around `26-32`, stiffness around `260-380`.

## 3. Task 25.1 - Shared Motion Tokens

Goal: make transition values consistent before changing multiple components.

Likely files:

- Create `src/lib/motion.ts` or `src/components/motion.ts`.
- Touch `PageTransition`, `BottomTabItem`, `Modal`, and `BucketSheet` only if centralizing constants stays simple.

Implementation notes:

- Export named constants for page tweens, springs, and reduced-motion fallback durations.
- Keep the file framework-agnostic enough to import from components.
- Do not overbuild variants for every component.
- If centralizing all existing modal/sheet constants causes churn, only add tokens for new page/loading work and leave existing modal constants in place.

Acceptance criteria:

- Page/loading work can reuse a small set of motion constants.
- No behavior changes are required in this task unless imports are updated.
- TypeScript accepts the exported constants without unsafe casts everywhere.

## 4. Task 25.2 - Native-Feeling Page Push Transition

Goal: upgrade protected route transitions from a simple slide to a more native app push.

Target file:

- `src/components/PageTransition/PageTransition.tsx`

Implementation plan:

- Keep the existing `transitionKey={location.pathname}` integration in `AppLayout`.
- Keep direction detection from browser history state.
- New page:
  - enters from `24%` to `100%` horizontal offset depending final feel testing.
  - fades from around `0.96` to `1`.
  - optionally starts with a tiny scale such as `0.995`.
  - gets a subtle left/right shadow while entering.
- Old page:
  - moves only slightly in the opposite direction, around `8%` to `18%`.
  - fades to around `0.75` to `0.9`.
  - stays visually underneath the incoming page.
- Use `position: absolute` only if needed to avoid layout collisions. If absolute positioning is used, preserve wrapper height so pages do not collapse during transition.
- Keep `overflow-x-hidden` on the transition boundary.
- Add `will-change: transform, opacity` on the animated page only.
- For reduced motion, use a short opacity fade only.

Watchouts:

- `AnimatePresence mode="popLayout"` may interact with page height. Test pages with long content and skeleton states.
- Fixed `BottomNav` should not animate with page content.
- Do not animate the entire `AppShell`, version chip, or bottom nav.
- Back navigation must move in the opposite direction from forward navigation.

Acceptance criteria:

- Forward navigation feels like moving deeper into the app.
- Back navigation feels like returning to the previous page.
- No horizontal scrollbar appears during transition.
- Page content does not collapse or jump during transition.
- Reduced motion users get fade-only behavior.

## 5. Task 25.3 - Route Loading Surface

Goal: replace bare full-page spinner screens with a calm app loading surface.

Likely files:

- Create `src/components/LoadingState/LoadingState.tsx`.
- Touch `src/components/ProtectedRoute/ProtectedRoute.tsx`.
- Touch `src/pages/AuthCallback.tsx`.
- Touch `src/pages/AppLayout.tsx` for room/project loading.

Component shape:

```ts
interface LoadingStateProps {
  label?: string;
  title?: string;
  body?: string;
  variant?: 'fullscreen' | 'card' | 'inline';
}
```

Visual direction:

- Fullscreen variant centers content in `min-h-[100dvh]`.
- Use warm material styling: `bg-bg`, subtle `backdrop-blur`, soft shadow if carded.
- Spinner sits above or beside short loading text.
- Text should be optional and localized through existing copy.
- Keep the component quiet; no large hero/card layout.

Usage:

- `ProtectedRoute`: fullscreen loading while auth hydrates.
- `AuthCallback`: fullscreen loading during OAuth exchange.
- `AppLayout`: card or inline loading while rooms load.

Acceptance criteria:

- No protected/auth loading path shows a bare spinner on an empty screen.
- Existing localized labels are preserved or improved using existing i18n keys.
- Loading UI fits on mobile and desktop.
- No route logic changes.

## 6. Task 25.4 - Apple-Like Activity Indicator

Goal: make the spinner feel more like a native activity indicator while staying accessible.

Target file:

- `src/components/Spinner/Spinner.tsx`

Implementation plan:

- Add optional props:
  - `tone?: 'brand' | 'neutral' | 'inverse'`
  - `size?: 'sm' | 'md' | 'lg'`
- Prefer a finer stroke and softer neutral color for non-CTA loading.
- Keep `role="status"` and `aria-label`.
- Hide visual text if the parent already renders a loading label.
- Respect reduced motion. The global CSS guard already helps; make sure spinner still has a visible static state when animation is reduced.

Possible visual approaches:

- Keep border spinner, but refine stroke, color, and opacity.
- Or render a small ring with multiple fading segments if implemented simply in CSS.

Do not:

- Add SVG complexity unless it clearly improves the result.
- Use external assets.
- Remove accessibility labels.

Acceptance criteria:

- Spinner is calmer and thinner.
- Existing call sites still work.
- Brand and neutral contexts are supported.
- Reduced-motion users are not left with an invisible loader.

## 7. Task 25.5 - Soft Skeleton Shimmer

Goal: replace pulse skeletons with a soft, material-like shimmer.

Target files:

- `src/components/Skeleton/Skeleton.tsx`
- `src/styles/global.css`
- Possibly `tailwind.config.js` if adding reusable keyframes there is cleaner.

Implementation plan:

- Keep `Skeleton` API compatible: existing `className` prop should keep working.
- Use a warm base color from existing tokens, such as `bg-well/70`.
- Add a moving translucent highlight gradient through a pseudo-element or nested element.
- Keep rounded corners controlled by passed classes.
- Add `overflow-hidden` so shimmer stays within the skeleton shape.
- Under reduced motion, disable shimmer and render static skeleton blocks.

Optional enhancement:

- Add `SkeletonText` or `SkeletonStack` only if repeated page skeletons become cleaner. Do not refactor every page just to use it.

Acceptance criteria:

- All existing skeleton states still render with the same dimensions.
- The shimmer is subtle and not distracting.
- Reduced motion disables shimmer.
- No page layout shifts from the new skeleton implementation.

## 8. Task 25.6 - Bottom Navigation Interaction Polish

Goal: make the bottom nav feel more tactile and native without changing navigation.

Target files:

- `src/components/BottomNav/BottomNav.tsx`
- `src/components/BottomTabItem/BottomTabItem.tsx`

Implementation plan:

- Keep the three-tab structure.
- Add a slightly more material-like nav background:
  - `bg-surface/85`
  - `backdrop-blur-xl`
  - subtle border or shadow if it improves separation.
- Keep safe-area padding.
- Add press feedback to tab buttons:
  - `active:scale-[0.96]`
  - short transition.
- Avoid animating font weight if it causes text width changes. Prefer stable text dimensions, color changes, and icon container motion.
- Keep `layoutId="bottom-tab-indicator"` for the active capsule if it continues to feel good.
- Ensure Thai tab labels still fit.

Acceptance criteria:

- Active tab transition feels smooth.
- Pressing a tab gives immediate tactile feedback.
- Labels do not jump when active state changes.
- Bottom nav remains readable over the page background.

## 9. Task 25.7 - Page-Specific Loading Pass

Goal: apply the improved loading primitives where users actually see them.

Primary files to review:

- `src/pages/Dashboard.tsx`
- `src/pages/AddMoney.tsx`
- `src/pages/SavingPlan.tsx`
- `src/pages/Profile.tsx`
- `src/pages/CheckBalance.tsx`
- `src/pages/Notifications.tsx`
- `src/pages/NotificationSettings.tsx`

Implementation plan:

- Keep page-specific skeleton shapes. They already preserve layout well.
- Let the updated `Skeleton` improve the visual behavior globally.
- Add small `Spinner tone="neutral"` only where the skeleton header currently pairs with a spinner.
- Avoid delaying content behind fancy staged animations.
- Check `SavingPlan` loading because it is the currently active file and has simple stacked skeletons.
- Keep existing `aria-label` loading strings from i18n.

Acceptance criteria:

- Every production route has either skeleton content or the shared loading surface during fetch.
- Loading states do not flash harshly.
- Thai and English loading labels still fit.
- No data-fetching logic changes.

## 10. Task 25.8 - Modal And Sheet Motion Consistency

Goal: lightly align existing modal/sheet motion with the new motion direction if needed.

Target files:

- `src/components/Modal/Modal.tsx`
- `src/components/BucketSheet/BucketSheet.tsx`
- Possibly `src/components/OutcomeModal/OutcomeModal.tsx`

Implementation plan:

- Review existing springs after page/loading polish is done.
- Keep the bottom sheet drag behavior.
- Avoid changing modal structure unless motion feels inconsistent.
- Use shared spring tokens only if it reduces duplication without changing behavior unexpectedly.

Acceptance criteria:

- Modal and sheet animations still feel coherent with page transitions.
- Drag-to-dismiss still works in `BucketSheet`.
- No accessibility regressions in dialogs.

## 11. Suggested Implementation Order

1. Add or define shared motion constants.
2. Upgrade `PageTransition`.
3. Create `LoadingState`.
4. Update `ProtectedRoute`, `AuthCallback`, and `AppLayout` loading states.
5. Refine `Spinner`.
6. Refine `Skeleton`.
7. Polish `BottomNav` and `BottomTabItem`.
8. Review page-specific loading states, especially `SavingPlan`.
9. Optionally align modal/sheet motion.
10. Run build, lint, and manual mobile checks.

Reason for this order:

- Page motion is the most visible behavior change.
- The loading surface gives auth/project waits a finished feel early.
- Spinner and skeleton updates then improve all existing page loaders.
- Bottom nav polish should happen after page transition timing is known.

## 12. QA And Verification

Automated checks:

- Run `npm run build`.
- Run `npm run lint` when practical.

Manual checks:

- Navigate forward between `/dashboard`, `/add`, `/saving-plan`, `/profile`, `/manage-project`, `/notifications`, and `/notifications/settings`.
- Use browser back and confirm direction reverses.
- Confirm no horizontal scrollbar appears during route changes.
- Confirm bottom nav does not animate with page content.
- Test slow auth or room loading paths if possible.
- Test Dashboard, Add Money, Saving Plan, Profile, Check Balance, and Notification loading states.
- Test at mobile width around `360px`.
- Test at desktop width.
- Test with `prefers-reduced-motion: reduce`.
- Check Thai UI labels if language is set to Thai.

Visual acceptance:

- Motion feels smooth and quick, not theatrical.
- Loading states feel calm and designed.
- Skeleton shimmer is subtle.
- Spinner looks intentional and accessible.
- Bottom nav press and active states feel tactile.
- The app still reads as GO-OUT, not a generic iOS clone.

## 13. Risks

### Page Height Collapse During Transitions

Route pages have different heights. Absolute positioning inside `AnimatePresence` can collapse the wrapper if not handled carefully.

Mitigation:

- Prefer `popLayout` if it remains stable.
- If using absolute pages, preserve wrapper height or avoid absolute positioning for normal pages.

### Horizontal Scroll Leaks

Push transitions can create scrollbars on mobile.

Mitigation:

- Keep `overflow-x-hidden` on the transition wrapper.
- Avoid using huge offsets when a smaller push feels good.

### Motion Feels Too Slow

Native-feeling motion should not block frequent actions.

Mitigation:

- Keep page transition under `0.38s`.
- Avoid content stagger on route transitions.

### Reduced Motion Regression

New shimmer or page transforms may bypass the global reduced-motion guard.

Mitigation:

- Add component-level reduced-motion variants where needed.
- Check CSS pseudo-element animations under the media query.

### Layout Shift In Bottom Nav

Animating font weight or labels can change text width.

Mitigation:

- Keep label dimensions stable.
- Animate color and indicator position more than font metrics.

### Over-Apple-Fying The Brand

The app already has a warm identity. A cold glass/gray treatment would fight it.

Mitigation:

- Use existing color tokens.
- Treat Apple as motion/material inspiration, not a palette replacement.

## 14. Definition Of Done

Task 25 is complete when:

- Protected route transitions have native-feeling forward/back direction.
- Auth/project full-page loading uses a polished shared loading state.
- Spinner is refined and accessible.
- Skeletons shimmer softly and respect reduced motion.
- Bottom nav has tactile press/active feedback without label jump.
- Production route loading states still preserve layout.
- `npm run build` passes.
- `npm run lint` passes or remaining issues are documented as unrelated.
- Manual mobile checks pass around `360px`.
- Reduced-motion behavior is verified.

