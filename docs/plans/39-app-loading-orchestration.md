# Task 39 - App Loading Orchestration

Status: Planning only. No app code, migrations, RLS, auth rules, data queries, Saving Plan math, notification fan-out, or route semantics change in this task.
Date drafted: 2026-05-21.

This task plans an app-wide loading behavior pass. The goal is not to make the app feel slower. If the app can render immediately, it should render immediately with a smooth entrance. Loading UI should appear only when there is an actual wait, and any intentional "fake" waiting should be short, capped, and clearly bounded.

This plan builds on Task 25's existing loading polish work. Task 25 already introduced shared loading primitives such as `LoadingState`, refined `Spinner`, page transitions, and skeleton styling. Task 39 should define when those primitives appear, how long they may stay visible, and which loading surface is appropriate for each kind of wait.

## 1. Goals

- Make whole-app loading feel intentional instead of blank, jumpy, or randomly flashing.
- Avoid showing a spinner for loads that resolve immediately.
- Add a short, polished spinner state with changing loading messages only when the user would otherwise see an awkward wait.
- Cap intentional fake loading at 3 seconds.
- Use skeletons only where the page or section contains enough structured data that a skeleton preserves layout better than a message.
- Do not show loading messages inside skeleton states.
- Keep existing data, auth, room, and route behavior unchanged.
- Keep Thai and English copy supported.

## 2. Non-Goals And Hard Rules

- Do not implement in this planning task.
- Do not change SQL, migrations, RLS, RPCs, triggers, Supabase policies, auth providers, or edge functions.
- Do not change money logic, Saving Plan math, balance checks, deposits, buckets, goals, or notification fan-out.
- Do not change route semantics or protected-route access rules.
- Do not introduce a new UI library.
- Do not use browser-default loading dialogs.
- Do not use emoji.
- Do not delay ready content for more than 3 seconds for presentation reasons.
- Do not hide real long-load/error states behind fake optimism.
- Do not add loading messages to skeleton-only page states.

## 3. Current Repo Observations

Existing loading primitives:

- `src/components/LoadingState/LoadingState.tsx`
  - Shared loading surface with `fullscreen`, `card`, and `inline` variants.
  - Uses `Spinner` and localized labels.
- `src/components/Spinner/Spinner.tsx`
  - Shared activity indicator with size and tone props.
  - Respects reduced motion by disabling spin animation.
- `src/components/Skeleton/Skeleton.tsx`
  - Shared skeleton block.
- `src/components/PageTransition/PageTransition.tsx`
  - Existing route transition wrapper from Task 25.

Existing route/loading surfaces:

- `src/components/ProtectedRoute/ProtectedRoute.tsx`
  - Auth hydration currently uses fullscreen `LoadingState`.
- `src/pages/AuthCallback.tsx`
  - OAuth callback currently uses fullscreen `LoadingState`.
- `src/pages/AppLayout.tsx`
  - Room/project loading currently uses card `LoadingState`.
- Data-heavy pages already have skeletons:
  - `Dashboard`
  - `AddMoney`
  - `SavingPlan`
  - `Profile`
  - `CheckBalance`
  - `Notifications`
  - `NotificationSettings`
  - `ManageProject`
  - `ArchivedProjects`
  - `MemberDetail`

## 4. Loading Surface Decision Model

Use three categories.

### 4.1 Immediate Render

Use when:

- Auth, room, and page data are ready before the visual delay threshold.
- Cached data is already available and safe to render.
- A background refetch is happening but the current content is still valid.

Behavior:

- Render the real app content immediately.
- Use the existing page transition/fade so the load feels smooth.
- Do not show a spinner.
- Do not show a skeleton.
- Do not intentionally wait.

Acceptance rule:

- Fast loads should not flash a loading surface.

### 4.2 Spinner With Changing Message

Use when:

- The app cannot render real content yet.
- The pending state is app-shell/auth/project oriented rather than page-layout oriented.
- The expected wait is short.

Examples:

- Initial auth hydration.
- OAuth callback exchange.
- Loading the active project/room shell before protected route content can mount.
- Any future whole-app bootstrap wait.

Behavior:

- Delay showing the spinner briefly to avoid flicker.
- Once visible, show a calm spinner and one short localized message.
- Rotate to another short message during the fake-loading window.
- Keep message changes infrequent enough to feel alive, not noisy.
- Stop intentional fake loading as soon as real content is ready and the minimum visible duration is satisfied.
- Never intentionally hold ready content past 3 seconds.

Recommended timing contract:

- `showAfterMs`: 120-200 ms.
- `minimumVisibleMs`: 400-700 ms after the spinner first appears.
- `messageRotateMs`: 900-1200 ms.
- `maxFakeLoadingMs`: 3000 ms.

Important distinction:

- The 3-second cap applies to fake or presentation delay.
- If the real network/auth load is still pending after 3 seconds, stop rotating playful messages and switch to an honest slow-load state such as "Still loading..." or "This is taking longer than usual."
- Do not pretend the app is ready before it is actually ready.

Accessibility:

- Keep one stable `aria-label` for the loading region.
- Consider marking the changing decorative message `aria-hidden` or avoid announcing every rotation.
- Use `aria-busy="true"` on the containing region.
- Respect reduced motion: the spinner may become static, but the loading state must remain visible.

### 4.3 Skeleton Loading

Use when:

- The page or section has a lot of structured data.
- The user benefits from seeing the eventual layout before content arrives.
- The skeleton prevents layout shift better than a generic spinner message.

Examples:

- Dashboard cards, charts, activity rows, and buckets.
- Saving Plan controls and summary blocks.
- Check Balance reconciliation content.
- Notification list rows.
- Manage Project member rows.
- Member detail profile and statistics blocks.
- Add Money form sections when bucket/log data is not ready.

Behavior:

- Show skeletons only after a short anti-flicker delay if the implementation can do that without churn.
- Skeleton states must not show rotating loading messages.
- Skeleton states may use an `aria-label` or `aria-busy`, but visible loading copy should stay out of the skeleton surface.
- Preserve the final layout dimensions as closely as practical.
- Do not replace data-dense skeletons with a generic spinner.

Acceptance rule:

- Skeletons are for data-rich UI shape, not for every small wait.

## 5. Proposed Future Implementation Shape

Create a small app-loading coordinator layer instead of scattering timeout logic across pages.

Likely new files:

- `src/hooks/useLoadingGate.ts`
  - Encapsulates delay-before-show, minimum-visible duration, and max fake-loading cap.
- `src/components/AppLoadingBoundary/AppLoadingBoundary.tsx`
  - Optional wrapper for whole-app/auth/project loading surfaces if it keeps route code simple.
- `src/components/LoadingState/loadingMessages.ts`
  - Optional localized message selection helper, if copy arrays are not kept directly in i18n.

Likely modified files:

- `src/components/LoadingState/LoadingState.tsx`
  - Accept optional changing message content or a message key, while keeping existing call sites working.
- `src/components/ProtectedRoute/ProtectedRoute.tsx`
  - Use spinner loading gate for auth hydration.
- `src/pages/AuthCallback.tsx`
  - Use spinner loading gate for OAuth callback.
- `src/pages/AppLayout.tsx`
  - Use spinner loading gate for room/project shell loading.
- `src/components/Skeleton/Skeleton.tsx`
  - No change required unless skeleton delay or shimmer behavior needs a shared helper.
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`
  - Add short loading message arrays and slow-load fallback copy only if needed.

Do not modify in this task:

- `supabase/migrations/*`
- SQL/RLS/RPC files
- Notification functions or edge functions
- Saving Plan calculation libraries
- Deposit, goal, bucket, or balance mutation logic

## 6. Loading Gate Contract

The future hook should be deterministic and easy to test.

Suggested input:

```ts
interface LoadingGateOptions {
  loading: boolean;
  showAfterMs?: number;
  minimumVisibleMs?: number;
  maxFakeLoadingMs?: number;
}
```

Suggested output:

```ts
interface LoadingGateState {
  shouldShowLoader: boolean;
  fakeLoadingExpired: boolean;
  elapsedMs: number;
}
```

Rules:

- If `loading` becomes false before `showAfterMs`, never show the loader.
- If the loader becomes visible, keep it visible for at least `minimumVisibleMs` unless the component unmounts.
- If `loading` is false, release content after the minimum visible duration.
- If `maxFakeLoadingMs` is reached while real loading is still true, set `fakeLoadingExpired` so the UI can show honest slow-load copy.
- Do not add arbitrary waits when the app is already ready.
- Clear timers on unmount and dependency changes.
- Keep behavior stable under React Strict Mode.

## 7. Message Strategy

Spinner messages should be short, localized, and low-pressure.

English examples:

- `Getting things ready`
- `Opening your project`
- `Syncing the latest room`
- `Almost there`

Thai examples should be natural and similarly short. Avoid overly formal or long sentences because loading surfaces are narrow on mobile.

Message rules:

- Use random initial selection per loading session.
- Rotate to a different message only while the spinner fake-loading window is active.
- Do not rotate messages after the 3-second fake-loading cap.
- Do not use messages for skeleton states.
- Do not promise specific data has loaded unless that is true.
- Do not use humor that could feel wrong during an actual delay or error.

## 8. Page-Level Policy

Recommended policy by surface:

- App bootstrap/auth unknown:
  - Spinner with changing message after the anti-flicker delay.
- OAuth callback:
  - Spinner with changing message, then honest slow-load copy if it exceeds 3 seconds.
- Room/project shell loading:
  - Spinner with changing message if the app cannot mount route content yet.
- Dashboard initial data:
  - Skeleton, no visible message.
- Add Money initial data:
  - Skeleton, no visible message.
- Saving Plan initial data:
  - Skeleton, no visible message.
- Check Balance initial reconciliation data:
  - Skeleton, no visible message.
- Notifications and settings:
  - Skeleton rows/cards, no visible message.
- Manage Project member list:
  - Skeleton rows, no visible message.
- Member Detail:
  - Skeleton profile/stat blocks, no visible message.
- Background refetch with valid existing data:
  - Keep current content visible; optionally use small inline busy affordance only if already established by the page.

## 9. Smoothness Rules

- Avoid a blank screen between route transition and loading state.
- Avoid showing a loader for a single frame.
- Avoid swapping spinner to skeleton to content in rapid succession.
- Prefer one loading surface per screen at a time.
- Keep bottom navigation stable during protected app loading where possible.
- Do not create body-level horizontal overflow.
- Do not make loading surfaces taller than the mobile viewport.
- Keep copy inside bounded containers for English and Thai.
- Respect reduced motion.

## 10. Testing And QA Plan

Manual QA:

- Fast connection / cached app state:
  - App renders real content without spinner flash.
- Slow auth hydration:
  - Fullscreen spinner appears after a short delay.
  - Message changes at most a few times.
  - Ready content appears as soon as the real state is ready, subject only to the minimum visible duration.
- OAuth callback:
  - Spinner does not exceed the fake-loading cap for presentation delay.
  - If still waiting after 3 seconds, copy changes to an honest slow-load message.
- Dashboard:
  - Uses skeleton only, with no visible loading message.
- Saving Plan, Check Balance, Notifications, Manage Project, Member Detail:
  - Data-heavy loading states use skeletons and no visible loading message.
- Background refetch:
  - Existing content does not disappear into a spinner if stale content is still valid.

Viewport QA:

- 320 px smoke check.
- 375 px main mobile target.
- 390 px common iPhone width.
- Desktop narrow app shell.

Language QA:

- English loading messages fit in one or two short lines.
- Thai loading messages fit without awkward clipping.
- Rotating messages do not cause layout shift.

Accessibility QA:

- Loading surfaces expose a stable accessible label.
- Changing messages do not spam screen reader announcements.
- Reduced-motion mode does not leave users with an invisible loading indicator.

## 11. Acceptance Criteria

- Immediate loads render content smoothly without spinner flash.
- App/auth/project waits use a shared spinner loading surface after a short anti-flicker delay.
- Spinner fake-loading behavior is capped at 3 seconds.
- Ready content is never intentionally delayed past 3 seconds.
- If real loading continues beyond 3 seconds, the UI switches from rotating fake-loading messages to honest slow-load copy.
- Rotating messages are localized, short, and not used in skeleton states.
- Skeletons are used only for data-heavy pages or sections where they preserve layout.
- Skeleton states do not show visible loading messages.
- Background refetches do not unnecessarily blank loaded content.
- Existing route, auth, data, and money behavior remains unchanged.
- No migrations, SQL, RLS, notification fan-out, or Saving Plan math changes.
- `npm run build` passes when the future implementation is done.
- Existing lint/type checks used by the repo pass when available.

## 12. Rollback Plan

This future work should be frontend-only.

Rollback steps:

1. Revert the loading gate hook or app-loading boundary.
2. Restore `ProtectedRoute`, `AuthCallback`, and `AppLayout` to direct `LoadingState` usage.
3. Remove any new loading message i18n keys if unused.
4. Restore any page skeleton loading gates to their previous direct loading checks.

No data rollback is needed:

- No migrations are added.
- No auth records change.
- No room membership rows change.
- No deposits, buckets, goals, balance checks, notifications, or Saving Plan records change.

## 13. Risks

- Too much fake loading can make the app feel slower. Mitigation: no loader for immediate loads and a strict 3-second presentation cap.
- Rotating messages can annoy users or screen readers. Mitigation: rotate slowly, keep accessible labels stable, and stop rotation after the fake-loading cap.
- A shared loading gate can accidentally delay pages that already have good skeletons. Mitigation: apply it first to whole-app/auth/project waits, then only to skeleton pages if flicker remains.
- Background refetches can regress by hiding valid content. Mitigation: distinguish first-load pending states from refetch pending states.
- Timer logic can be flaky in React Strict Mode. Mitigation: keep the hook small, clear timers carefully, and add focused tests if the repo test setup supports them.

## 14. Future Implementation Order

1. Add a small `useLoadingGate` hook with anti-flicker, minimum-visible, and max fake-loading timing.
2. Add localized short spinner message arrays and slow-load fallback copy.
3. Extend `LoadingState` to support changing visual messages while preserving stable accessibility labels.
4. Wire the gate into `ProtectedRoute`.
5. Wire the gate into `AuthCallback`.
6. Wire the gate into `AppLayout` room/project loading.
7. Review data-heavy page skeletons and add only anti-flicker gating where current skeletons visibly flash.
8. Verify Dashboard, Saving Plan, Check Balance, Notifications, Manage Project, Member Detail, Add Money, and Archived Projects still use skeletons without visible messages.
9. QA fast and slow loading paths at 320, 375, and 390 px.
10. Run build and available lint/type checks.
