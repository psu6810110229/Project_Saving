# UI Redesign Porting Plan — v0 Reference Screens → Real App

Plan owner: front-end pairing session.
Status: draft (planning only, no code changes).
Created: 2026-05-19.

This document maps the visual design from the merged v0 preview routes
(`/reference/dashboard`, `/reference/buckets`, `/reference/add-money`) into the
real, logic-bearing pages of GO-OUT: `Dashboard`, the buckets section inside
the Dashboard, and the Add Money page. All real logic, hooks, Supabase calls,
routing, i18n, validation, and money-state guardrails must be preserved.

---

## 1. Source material

### 1.1 v0 preview routes (added by PR #27 — commit `be3dc27`)

These are static, dummy-data screens. They are NOT wired to Supabase, RoomContext,
useAuth, i18n, useSharedData, or any real hooks. They are pure visual references
and ship under `/reference/*` so they never collide with protected routes.

| Reference route                  | File                                         | Purpose                                                                 |
| -------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| `/reference/dashboard`           | `src/pages/DashboardReferenceScreen.tsx`     | Main savings dashboard layout (Total Vault hero, member progress, plan, recent check) |
| `/reference/buckets`             | `src/pages/DashboardBucketsScreen.tsx`       | Buckets grid + daily trend chart                                        |
| `/reference/add-money`           | `src/pages/AddMoneyReferenceScreen.tsx`      | Deposit form (bucket pills, quick amounts, custom amount, projection)   |

Each file declares a local `DUMMY_DATA` const, local SVG icon components, a local
`ProgressBar`, and (in two cases) a static bottom nav. None of these locals will
be used in the real app — they exist only as drawing references.

### 1.2 Design PNGs

`docs/design-references/app-redesign/`:
- `dashboard-reference.png`
- `dashboard-2-reference.png`
- `add-reference.png`

These confirm the intended look, spacing, and copy direction.

### 1.3 Real pages and their wiring

| Real page                  | File                              | Wires                                                                                                       |
| -------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Dashboard                  | `src/pages/Dashboard.tsx`         | `useAuth`, `useRoom`, `useRooms`, `useSharedData` (goal, buckets, logs, leaderboard, reconcile, savingPlan, streakFreeze, profile, partnerBuckets), `useUnreadNotificationsCount`, `useSavingsTotal`, `useI18n`, framer-motion, modals, NudgeButton, etc. |
| Buckets (dashboard section) | inside `Dashboard.tsx`            | `BucketGrid` + `BucketRow` + `BucketSheet`, `Segmented` (mine/partner), `MomentumChart`, `CreateBucketForm` modal, capacity validation against `goal.target_amount`. |
| Add Money                  | `src/pages/AddMoney.tsx`          | `useSharedData` (buckets, logs, quickAmounts), `useSmartDefaultAmount`, `AddMoneyForm`, `ConfirmDepositPanel`, `OutcomeModal`, `QuickAmountsEditor`, `SHOW_ATTACHED_SLIP` flag, haptics, `BucketPicker` pills. |

These are the only three flows in scope for this redesign port. Other pages
(SavingPlan, CheckBalance, ManageProject, Profile, Notifications) are out of scope.

---

## 2. Goals and non-goals

### 2.1 Goals
- Adopt the v0 visual language (cards, spacing, halo orange CTA, pill chips,
  category bubbles, projected-progress two-column, daily trend chart styling)
  in the **real** Dashboard, buckets section, and Add Money page.
- Keep all existing real behavior intact: data fetching, RLS, deposit flow speed,
  goal edit / goal-request gating, partner read-only buckets, smart defaults,
  outcome modal, slip flag, haptics, i18n.
- Reuse existing components where the v0 design only changes visuals; modify
  shared components only when the redesign is broadly applicable.

### 2.2 Non-goals
- No new product features. No new routes. No new tables, RPCs, or migrations.
- No replacement of the bottom nav (real app already has `BottomNav`; the v0
  fixed nav is a discardable mock).
- No changes to deposit/finance semantics (positive-only `savings_logs`, no
  negative entries, no allocation of reconcile differences into buckets).
- No new design system. No CSS Modules. No new top-level folders.
- Reference routes (`/reference/*`) stay as-is during the port — they become
  the visual oracle. They can be removed in a final cleanup task after sign-off.

---

## 3. Visual mapping (v0 → real)

### 3.1 Dashboard (`/dashboard` ← `/reference/dashboard`)

| v0 block                                                             | Real target                                                                                                                                                | Action                                                                                                                                                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header: project name + chevron, "N คนในห้องนี้", icon buttons        | `<motion.header>` block in `Dashboard.tsx` (around lines 468–486)                                                                                          | Restyle to match: keep `activeRoom.name`, real bell button (`BellIconButton` with unread count). The chevron-dropdown and right-side avatar/dots buttons in v0 are **decorative dummies**; do NOT add room-switcher or menu here — that lives elsewhere. Add the "N members in this room" subtitle backed by `leaderboard.entries.length`. |
| Total Vault hero card (orange filled, big number, white progress, sub-stats "เก็บไปแล้ว" / "เป้าหมาย") | `<TotalVaultCard>` (`src/components/TotalVaultCard/TotalVaultCard.tsx`)                                                                                    | Restyle `TotalVaultCard` to the filled-orange hero variant. Keep its props (`saved`, `target`, `onEdit`, `editAriaLabel`) and the existing `isCreator`/openGoalEditor / openGoalRequest wiring. The two sub-stat icons in v0 are visual only — drive from `saved` / `target`. |
| Member progress: two cards, leader crown, avatar, "สะกิด" (nudge) button, big saved amount, per-member progress | `<HeadToHeadCard>` (`src/components/HeadToHeadCard/HeadToHeadCard.tsx`) and `PlayerProgressRow`                                                              | Restyle to match the v0 stacked card look (leader crown + halo on avatar). Keep `NudgeButton` in the partner slot (already wired). Do NOT introduce a new "nudge" implementation. |
| Saving Plan card (status text, edit FAB, 3-column meta: today's goal / days left / progress%) | `<SavingPlanCard>` (used in `Dashboard.tsx` line 527)                                                                                                       | Restyle `SavingPlanCard` to the new layout. Keep all real inputs: `ruleType`, `money`, `habit`, `verifiedBalance`, pauses, plan summary, streak freeze. Navigate to `/saving-plan` on edit. |
| Recent balance check row                                             | The Verified Balance is currently folded into `SavingPlanCard` via `verifiedBalanceSlot`; a fallback `BalanceCheckStatus` shows when there is no checkpoint  | Keep the folded slot. If the design clearly intends a separate row, render `BalanceCheckStatus` after the plan card. Decide during implementation step 1.                              |
| Bottom nav                                                           | `BottomNav` rendered by `AppLayout`                                                                                                                        | DISCARD v0 nav. Do not duplicate.                                                                                                                                                     |

Discard from v0 file: local `Avatar`, local `ProgressBar`, all local Icon* SVGs (use `src/components/Icon/Icon.tsx`), `DUMMY_DATA`, the fixed bottom nav, the chevron/users/dots buttons in the header.

Preserve in real Dashboard (do not regress):
- `useSharedData()` plumbing for goal, buckets, logs, leaderboard, reconcile, savingPlan, streakFreeze, profile.
- Verified Balance reminder modal (`VB_REMINDER_SESSION_KEY`, `vbReminderEvaluatedRef`, `closeVbReminder`).
- Goal edit modal (creator only) + Goal request modal (partner) + Confirm modal.
- Activity feed (merged deposits + balance checks, top 3 + "View all" → `ActivityHistoryModal`).
- `MomentumChart` with expected series, week totals, partner series.
- `BucketSheet` deposit flow opened from a tapped bucket.
- Framer-motion staggered cascade (`containerVariants`, `sectionVariants`).
- `SHOW_NEXT_WIN` / `SHOW_DEPOSIT_RACE` flags (leave both off).

### 3.2 Buckets section (inside `/dashboard` ← `/reference/buckets`)

| v0 block                                                            | Real target                                                                                                | Action                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "คุณ / พี่ที่ร์โบ" segmented pill                                   | `<Segmented>` already used at `Dashboard.tsx` line 553                                                     | Restyle to match v0 pill (rounded-full, brand-filled active). Keep `bucketView` state and `setExpandedBucketId(null)` on switch. Only render when `hasPartnerBuckets`.                                                                                          |
| Section header "เป้าหมายย่อย" + count + add CTA                      | `<BucketGrid>` (`src/components/BucketGrid/BucketGrid.tsx`)                                                | Restyle `BucketGrid` title/subtitle/CTA. Keep `onAddBucket` → `setBucketModalOpen(true)` and i18n strings (`d.tripBuckets`, `d.bucketCount`, `d.addBucket`/`d.createBucket`).                                                                                    |
| Bucket grid 2-column cards (icon bubble, % top-right, name, saved/target, mini progress) | `<BucketRow>` (`src/components/BucketRow/BucketRow.tsx`)                                                  | The current `BucketRow` already matches the v0 card shape — verify spacing, icon size, percentage placement, progress bar tone. Keep `IconBubble` and `bucketIcon()` mapping from `Dashboard.tsx`. Tap still opens `BucketSheet`.                                |
| Daily Trend chart (paired bars per day, "ยอดฝากรายวัน", legend with you + partner) | `<MomentumChart>` (`src/components/MomentumChart/MomentumChart.tsx`)                                       | Either: (a) restyle `MomentumChart` header/legend/typography to match v0; or (b) keep `MomentumChart`'s current expected-vs-recorded line variant and only restyle the surrounding card. Pick during step 3 once we confirm whether the v0 bar chart replaces or supplements the line chart. Default decision: keep line chart, restyle the card chrome only (avoids regressing expected-vs-recorded overlay, today index, week totals). |

Discard from v0 file: dummy buckets array, dummy `dailyStats`, all local SVG icons (use `Icon.tsx`), local `ProgressBar`, the local `BucketCard`, the bottom nav.

Preserve:
- Bucket capacity validation against `goal.target_amount` (`bucketTargetTotal`, `bucketTargetRemaining`, `newBucketExceedsCapacity`).
- Partner buckets read-only path (`showingPartner` branch).
- `BucketSheet` deposit shortcut.
- `BucketGrid` empty-state CTA + `CreateBucketForm` modal + `Modal` open state.

### 3.3 Add Money (`/add` ← `/reference/add-money`)

| v0 block                                                                                       | Real target                                                              | Action                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eyebrow "หยอดเงิน" + title + subtitle                                                          | `<PageHeader>`                                                           | Restyle to match v0 typography. Keep `copy.addMoney.pageEyebrow / pageTitle / pageSubtitle`.                                                                                                                                                                                                                            |
| Horizontal scroll of bucket pills                                                              | `<BucketPicker>` (local helper inside `AddMoney.tsx`)                    | Restyle to v0 pill style (brand fill active, surface + ink-muted inactive border). Keep `buckets` source from `useSharedData().buckets`, `selectedId`, `onSelect`.                                                                                                                                                       |
| Bucket card with circular brand icon, big saved amount, target, halo progress                  | `<BucketHeader>` inside `<AddMoneyForm>`                                | Restyle `BucketHeader` to match v0 (circle bubble brand-500 fill with halo, large `formatCurrency(saved)` in brand-500). Drive from `selectedBucket`. Keep `bucketIcon()` mapping.                                                                                                                                       |
| Quick amounts row (3 pills) + edit affordance                                                  | `<QuickAddRow>` + edit chip rendered by `<AddMoneyForm>`                | Restyle pills (rounded-full, brand-fill when selected, surface+border otherwise). Keep `quickAmounts` from profile, `selectedQuickAmount`, `onQuickAmountSelect`. Keep `onEditQuickAmounts` opening `QuickAmountsEditor` modal.                                                                                          |
| Custom amount input (piggy icon, brand outline, large bold text)                               | `<FormField label=…> <TextInput leadingIcon=…>` inside `<AddMoneyForm>`  | Restyle `TextInput` (or pass an inline variant) to the rounded-full brand-outline look. Keep input sanitization (`value.replace(/[^0-9]/g, '')`), `inputMode="numeric"`, smart-default reset on change.                                                                                                                  |
| Projected progress card (two-column "บันทึกแล้ว" / "เพิ่ม X ซึ่งจะทำให้คุณคืบหน้ากว่า")          | `<ProjectedProgressCard>`                                                | Restyle to the two-column divided layout. Keep its math input contract (`bucketName`, `saved`, `target`, `pendingDeposit`).                                                                                                                                                                                              |
| Confirm CTA (full-width pill, halo orange)                                                     | `<Button variant="action" fullWidth>`                                    | Confirm the existing `Button variant="action"` already renders halo-orange pill; if not, adjust the `action` variant or add styling. Keep submit handler — it sets `reviewing=true`, then `ConfirmDepositPanel` shows.                                                                                                  |

Discard from v0 file: dummy bucket, dummy quick amounts, dummy categories, local SVGs, version badge, bottom nav, the implicit "single bucket" assumption.

Preserve:
- `useSharedData` hooks for buckets/logs/quickAmounts.
- `useSmartDefaultAmount` and the `appliedBucketId` reset logic.
- `ConfirmDepositPanel` review step (the v0 design only shows the pre-review state).
- `OutcomeModal` after a successful deposit.
- `QuickAmountsEditor` modal.
- `SHOW_ATTACHED_SLIP` flag and `SlipAttachField` (currently hidden via flag — do not re-enable as part of this port).
- Haptic feedback (`'success'`, `'milestone'`) on insert.
- The "no buckets yet" branch with `<CreateBucketForm>`.
- All i18n strings via `copy.addMoney.*`, `copy.bucket.*`.

---

## 4. Files inventory

### 4.1 Files to edit (visuals only)
- `src/pages/Dashboard.tsx` — header restyle, restyle wrappers around vault/race/plan/buckets/chart/activity. No hook/state changes.
- `src/pages/AddMoney.tsx` — restyle `BucketPicker` pills. No hook/state changes.
- `src/components/TotalVaultCard/TotalVaultCard.tsx` — switch to filled-orange hero variant.
- `src/components/HeadToHeadCard/HeadToHeadCard.tsx` and `src/components/PlayerProgressRow/PlayerProgressRow.tsx` — match v0 leader crown halo + per-row layout.
- `src/components/SavingPlanCard/SavingPlanCard.tsx` — restyle the header (eyebrow + title + edit FAB) and the 3-column meta row.
- `src/components/BucketRow/BucketRow.tsx` — verify spacing matches v0, adjust icon bubble color/sizing if needed.
- `src/components/BucketGrid/BucketGrid.tsx` — restyle header (title + subtitle + brand-fill add button).
- `src/components/Segmented/Segmented.tsx` — confirm pill style; adjust if needed.
- `src/components/AddMoneyForm/AddMoneyForm.tsx` — wrap section spacing, surface ProjectedProgressCard layout.
- `src/components/BucketHeader/BucketHeader.tsx` — restyle to v0 (brand circle, halo, big brand-500 saved figure).
- `src/components/QuickAddRow/QuickAddRow.tsx` — restyle to brand-fill / surface-outline pills.
- `src/components/ProjectedProgressCard/ProjectedProgressCard.tsx` — restyle to two-column divided layout.
- `src/components/TextInput/TextInput.tsx` — add an optional rounded-pill / brand-outline variant (or take a `variant` prop) for the custom amount input. Default style must stay unchanged.
- `src/components/Button/Button.tsx` — confirm `variant="action"` matches the halo-orange pill from v0. Adjust only if it deviates.
- `src/components/MomentumChart/MomentumChart.tsx` — restyle the card chrome (title eyebrow, legend, totals) without changing data props.
- `tailwind.config.js` — only if a token is missing (e.g., a specific brand tint or spacing). Default: no changes.

### 4.2 Files to reuse as-is (logic-bearing, do not change behavior)
- `src/hooks/useSharedData.ts`, `useBuckets`, `useLogs`, `useGoal`, `useLeaderboard`, `useReconcile`, `useSavingPlan`, `usePartnerBuckets`, `useSmartDefaultAmount`, `useStreakFreeze`, `useProfile`, `useRoom`, `useRooms`, `useAuth`, `useI18n`, `useUnreadNotificationsCount`.
- `src/lib/supabase.ts`, `notifyEvents.ts`, `dashboardStats.ts`, `comparisonStats.ts`, `savingPlan.ts`, `reconcile.ts`, `buckets.ts`, `format.ts`, `haptics.ts`, `flags.ts`.
- `src/components/BucketSheet`, `ConfirmDepositPanel`, `OutcomeModal`, `Modal`, `ConfirmModal`, `CreateBucketForm`, `QuickAmountsEditor`, `NudgeButton`, `BellIconButton`, `Notifications/*`, `ActivityHistoryModal`, `ActivityTimelineRow`, `BalanceCheckStatus`, `VerifiedBalanceReminderModal`.
- All i18n in `src/i18n/locales/en.ts` and `src/i18n/locales/th.ts`.

### 4.3 Reusable pieces from the v0 preview (visual reference only)
- Card backgrounds: `rounded-2xl bg-brand-500 p-5 text-white shadow-haloOrange` (hero), `rounded-xl bg-surface p-4 shadow-soft` (default card), `rounded-xl border border-brand-100 …` (focus/projection card).
- Pill chip: `rounded-full px-4 py-2 font-mono text-sm font-bold` with `bg-brand-500 text-white` active vs `bg-surface text-ink-muted border border-ink/10` inactive.
- Icon bubble brand: `w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center text-white shadow-haloOrange`.
- Two-column divided summary: `grid grid-cols-2 divide-x divide-well`.
- 3-column meta row pattern under cards: small bubble + 2 lines of `text-[10px]` + 1 bold `text-sm` value.
- Quick amount pill state classes.
- Custom amount input: `rounded-full border-2 border-brand-500 bg-surface py-3 pl-12 pr-4 font-mono text-lg font-bold`.

### 4.4 Dummy / static pieces to discard
- All three reference files' `DUMMY_DATA` objects.
- All local SVG icon components in those files (`IconUsers`, `IconChevronDown`, `IconEdit`, `IconWallet`, `IconTarget`, `IconCalendar`, `IconClock`, `IconHeart`, `IconChevronRight`, `IconGrid`, `IconPlus`, `IconUser`, `IconDots`, `IconReceipt`, `IconPlane`, `IconBed`, `IconUtensils`, `IconTicket`, `IconBriefcase`, `IconGift`, `IconTrendingUp`, `IconPiggyBank`) — already covered by `src/components/Icon/Icon.tsx`.
- Local `Avatar`, `CrownBadge`, `ProgressBar`, `BucketCard`, `DailyTrendChart`, fixed bottom navs.
- Hard-coded Thai strings — they exist only as visual guides; real strings come from `copy.*`.
- Hard-coded `"v0.9.7"` version badge.
- The header chevron-dropdown and top-right "users + dots" icon buttons (the real header uses the bell + project name; do not add a fake room-switcher / overflow menu).

### 4.5 Decision: keep or delete the `/reference/*` routes after port
Recommended: keep them in `App.tsx` until the redesign ships and is signed off,
then remove the three pages and the three routes in one cleanup commit. Until
then they serve as a side-by-side oracle.

---

## 5. Implementation steps

Each step is its own commit. Do not bundle. After each step run `npm run build`
and (when practical) `npm run lint`. Stop after each commit and report.

1. **Hero card port — `TotalVaultCard`.** Switch the card to filled-orange hero
   variant matching v0; keep all props and the dashboard's `isCreator`/edit
   wiring intact. Verify `pctColor`/edit affordance still renders for both
   creator and partner. Acceptance: real `/dashboard` hero looks identical to
   `/reference/dashboard` hero; goal edit modal still opens; "request goal
   change" still opens for non-creators.

2. **Head-to-Head port — `HeadToHeadCard` + `PlayerProgressRow`.** Match v0
   leader crown halo, per-member card padding, big-amount typography, "สะกิด"
   pill placement (uses real `NudgeButton`). Acceptance: rows reorder by saved
   leader; tied state still renders without crown; partner row keeps Nudge
   button; no avatar swap regressions when partner has theme color.

3. **Saving Plan card port — `SavingPlanCard`.** Restyle header (eyebrow,
   status title, edit FAB) and meta row (today's goal / days remaining /
   progress%). Keep all real inputs and the embedded Verified Balance slot.
   Acceptance: "Not started", paused, fixed-daily, increasing-daily, and
   freeze-available states all render; tapping the FAB navigates to
   `/saving-plan`; verifiedBalanceSlot still shows the matched/diff state.

4. **Dashboard header restyle.** Update the top header in `Dashboard.tsx`:
   project name large, "N members in this room" subtitle from `leaderboard.entries.length`,
   real `BellIconButton` on the right with unread count. No new dropdown / menu.
   Acceptance: header copy ties to active room; bell still navigates to
   `/notifications`; unread badge still shows.

5. **Bucket grid + row port.** Restyle `BucketGrid` header (title + subtitle +
   brand-fill add button) and verify `BucketRow` matches v0 card. Keep
   `Segmented` mine/partner switch. Acceptance: capacity validation still
   blocks oversized new buckets; partner view stays read-only with no
   `BucketSheet`; tapping mine bucket still opens `BucketSheet`.

6. **Momentum chart card chrome.** Restyle only the surrounding card,
   eyebrow, legend, and totals — do NOT change data series, today index,
   expected overlay, or week totals. Decide at this step whether to also
   port the bar-pair chart (default decision: defer to a follow-up).
   Acceptance: existing data points render at the same X/Y positions;
   expected series still visible when `savingPlan` exists.

7. **Add Money pills + bucket card + quick amounts.** Restyle `BucketPicker`,
   `BucketHeader`, `QuickAddRow`, the inline edit affordance, and the custom
   amount `TextInput` to match v0. Keep all real state, smart default reset,
   numeric sanitization, and `onEditQuickAmounts` modal trigger. Acceptance:
   bucket selection still drives `AddMoneyForm` inputs; smart-default hint still
   appears; "edit quick amounts" still opens `QuickAmountsEditor`.

8. **Projected progress card.** Restyle `ProjectedProgressCard` to the two-column
   divided layout. Keep the math contract (`pendingDeposit`). Acceptance:
   changing the custom amount updates the right column in real-time; bucket
   names still render via i18n.

9. **Confirm CTA + variant audit.** Verify `Button variant="action"` matches
   the halo-orange pill from v0. If a delta exists, tighten the `action`
   variant centrally; do not branch ad-hoc. Acceptance: deposit confirm,
   add-bucket CTA, and outcome-modal "Done" all share the same look.

10. **(Optional cleanup, after sign-off)** Delete `DashboardReferenceScreen.tsx`,
    `DashboardBucketsScreen.tsx`, `AddMoneyReferenceScreen.tsx`, remove the
    three `/reference/*` routes in `App.tsx`, drop the PNGs from
    `docs/design-references/app-redesign/`. Separate commit.

---

## 6. Risks and mitigations

| Risk                                                                                                                | Mitigation                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restyling a shared component (e.g., `TextInput`, `Button`) regresses pages outside this scope.                       | Prefer additive variants (`variant="rounded"` etc.) over rewriting defaults. Audit every consumer before changing a default. Check `OrganismsPreview`/`MoleculesPreview` after each change. |
| `MomentumChart` rewrite drops the expected-vs-recorded overlay or today index.                                       | Restyle chrome only in step 6; treat any bar-pair variant as a separate follow-up plan.                                                                                                     |
| v0 header introduces a fake room-switcher/menu UX that doesn't exist in the app.                                     | Explicit non-goal in §3.1. Header stays project name + members + bell.                                                                                                                      |
| Deposit-flow speed degrades from new animations/layout.                                                              | Keep `/add` free of extra modals or animations on the primary path. Smart-default + quick amounts paths must still be 1-tap. Test on mid-tier Android emulator before sign-off.              |
| Hero card filled-orange clashes with framer-motion stagger or dark-mesh background.                                  | Test in real Dashboard with `dashboard-mesh-bg` portal; tune card shadow/border if contrast suffers. Do not remove the mesh background portal.                                                |
| Partner read-only buckets accidentally gain a deposit affordance via a restyle copy/paste from v0.                   | Keep the `showingPartner` branch's `BucketRow` without `onClick`. Add a test or manual QA case.                                                                                              |
| Reconcile / Verified Balance row visibility logic shifts due to layout reorder.                                      | Keep the existing rule: fold into `SavingPlanCard` when `reconciledAppBalance` exists; otherwise show `BalanceCheckStatus` fallback row. Do not invent a new placement.                       |
| New tokens accidentally added to `tailwind.config.js` and then orphaned.                                             | Default to reusing existing tokens (`bg`, `surface`, `well`, `brand-*`, `shadow-soft`, `shadow-haloOrange`, `rounded-pill`, etc.). Only add a token after confirming three+ uses.            |
| i18n strings get hard-coded back into JSX during restyle.                                                            | Lint pass: every visible string must come through `copy.*`. Do not import the dummy Thai strings from `*ReferenceScreen.tsx`.                                                                |

---

## 7. Acceptance criteria

For every step:
- `npm run build` succeeds with no new warnings beyond baseline.
- `npm run lint` (when practical) reports no new errors.
- The corresponding real route renders identically to (or visibly closer to)
  the matching `/reference/*` route in a 390px-wide viewport.
- All hooks, RPC calls, RLS-touched reads, and Supabase inserts behave
  exactly as before — verified by:
  - Creating a deposit through `/add` and seeing it appear in the activity
    feed on `/dashboard` and in the bucket row total.
  - Opening the goal-edit modal as the creator and the goal-request modal
    as the partner.
  - Switching `bucketView` to partner and confirming read-only.
  - Triggering the Verified Balance reminder modal by clearing
    `sessionStorage.verifiedBalanceReminderDismissed`.
  - Confirming MomentumChart still renders the expected series when
    `savingPlan` exists.

Overall acceptance:
- Visual match across all three flows.
- No regression in `useSharedData` consumers.
- Bottom nav is unchanged (still rendered by `AppLayout` → `BottomNav`).
- Deposit path remains 1-2 taps from `/add` to confirmed.

---

## 8. QA checklist

- [ ] Dashboard renders at 390px, 414px, and 360px widths without overflow.
- [ ] Dashboard renders at standard tablet widths (responsive doesn't break).
- [ ] Hero Total Vault card shows correct % and totals; edit button visible
      only when authorized (creator) and triggers correct modal.
- [ ] Head-to-Head shows leader crown only when not tied; partner row has
      Nudge button; Nudge sends.
- [ ] Saving Plan card states: not-started, fixed-daily, fixed-weekly,
      fixed-monthly, increasing-daily, paused, freeze-available — all render.
- [ ] Verified Balance slot embedded vs fallback row toggles correctly.
- [ ] Verified Balance reminder modal opens once per session when eligible.
- [ ] Bucket grid: empty state shows "Create first bucket" CTA; non-empty
      shows BucketRow grid + add button.
- [ ] Bucket grid capacity validation: trying to create a bucket whose target
      exceeds remaining goal capacity shows the error.
- [ ] Tapping a mine-bucket opens `BucketSheet`; tapping a partner-bucket
      does nothing.
- [ ] MomentumChart shows expected overlay when a saving plan exists.
- [ ] Activity feed shows top 3 merged items; "View all" opens
      `ActivityHistoryModal` with all logs.
- [ ] Goal-edit modal validates date, amount > 0, amount ≥ highest bucket total.
- [ ] Goal-request modal sends via `notifyGoalChangeRequest` and shows success.
- [ ] Add Money: bucket pill scroll, selecting changes form bucket; smart
      default hint appears when applicable.
- [ ] Add Money: quick amount selected vs custom amount mutually exclusive;
      sanitization strips non-digits.
- [ ] Add Money: edit quick amounts opens `QuickAmountsEditor`, saves to profile.
- [ ] Add Money: ProjectedProgressCard updates as amount changes.
- [ ] Add Money: confirm triggers `ConfirmDepositPanel`; confirm inserts via
      `data.logs.insert(amount, bucketId, ..., slipMarker)`; haptic fires;
      outcome modal appears.
- [ ] Outcome modal "Done" closes and resets the form.
- [ ] No new console errors. No new network calls beyond existing ones.
- [ ] Thai and English locales both render correctly (switch in profile).
- [ ] `prefers-reduced-motion` respected — no large animations bypass it.
- [ ] PWA still installs; no manifest/icon regressions.
- [ ] `/reference/*` routes still render (until cleanup step).

---

## 9. Rollback notes

This port is purely front-end styling against pre-existing components and hooks.
There are no migrations, no schema changes, no RPC additions, no new env vars.

Per-step rollback: each step is its own commit, so reverting any single step is
`git revert <hash>` with no data implications.

Whole-port rollback: revert the merge commit for the redesign branch. The
`/reference/*` routes will remain untouched in either direction because they
were already merged (PR #27, `be3dc27`). Real users see no data loss; their
deposits, buckets, goals, and saving plans are unaffected by visual rollback.

If a token change in `tailwind.config.js` proves disruptive, prefer reverting
that token in a fast follow-up rather than reverting the visual port wholesale —
unless several pages are visibly broken.

If a shared-component restyle (e.g., `Button` or `TextInput`) regresses pages
outside scope, revert that one component change and re-implement the redesign
using an additive variant or a local wrapper instead of mutating the default.

---

## 10. First recommended task

Step 1 — **Port the Total Vault hero card.** Restyle
`src/components/TotalVaultCard/TotalVaultCard.tsx` to the filled-orange hero
variant matching `/reference/dashboard`, while keeping all existing props
(`saved`, `target`, `onEdit`, `editAriaLabel`) and the Dashboard's
creator-vs-partner edit wiring intact. Smallest visible win, lowest blast
radius, validates the shared-component-restyle strategy before touching
larger components like `SavingPlanCard` or `MomentumChart`.

---

## Execution Stop Rule

Implement exactly one step at a time.

After each step:
- run relevant checks
- create one commit
- stop immediately
- report only changed files, checks, commit hash, and next recommended step

Do not start the next step without explicit user approval.
Do not edit `docs/ui-redesign-porting-plan.md` unless explicitly asked.
