# Task 46 — Navigation, Saving Plan, Dashboard Polish, and UI Consistency Fixes

**Status:** Planning only — no implementation code changed.
**Date:** 2026-05-26
**Branch:** `fix/46-ui-polish-navigation-dashboard`

---

## Scope

Fix 12 UX/UI issues spanning Dashboard, Saving Plan page, Add page, Deposit Activity, CalendarPicker, and app-wide icon-button consistency. All changes are front-end only.

## Non-Goals

- No database, migration, RLS, RPC, edge function, or Supabase policy changes.
- No auth logic changes.
- No Saving Plan math changes.
- No new packages unless investigation proves necessity.
- No modal confirm/cancel button changes (scope limited to icon-action buttons).
- No deletion of Quick Add code — hide only.

---

## Affected Screens / Components / Files

| Issue # | Area | Primary files |
|---------|------|---------------|
| 1 | Vault card back nav | `src/pages/Dashboard.tsx` (line ~950, `TotalVaultCard` + `handleManageProject`), `src/pages/ManageProject.tsx`, `src/pages/Profile.tsx` (line 189, navigate to `/manage-project`), `src/pages/AppLayout.tsx` (line 308, `tabFromPath`) |
| 2 | Progress card spring-back | `src/components/PlayerProgressRow/PlayerProgressRow.tsx`, `src/components/Pressable/Pressable.tsx`, `src/lib/motion.ts` |
| 3 | Saving Plan card click scope | `src/components/SavingPlanCard/SavingPlanCard.tsx` (lines 252, 167 — outer `<Pressable onClick={onConfigure}>`) |
| 4 | Balance Checking click area & spring-back | `src/components/SavingPlanCard/SavingPlanCard.tsx` (lines 358–482, verified-balance section) |
| 5 | Saving Plan page header/layout | `src/pages/SavingPlan.tsx` |
| 6 | Thai calendar i18n | `src/components/CalendarPicker/CalendarPicker.tsx` (lines 27–31 hardcoded EN month/day names; lines 223–230 hardcoded EN hint text), `src/i18n/locales/th.ts`, `src/i18n/locales/en.ts` |
| 7 | Saving Plan top blank area | `src/pages/SavingPlan.tsx` (line 595 `pt-8`, line 604 `mt-10`) |
| 8 | Dashboard Saving Plan card spacing | `src/components/SavingPlanCard/SavingPlanCard.tsx` (lines 293–329, 3-col meta row) |
| 9 | App-wide icon button consistency | `src/components/IconButton/IconButton.tsx`, ad-hoc `<button>` icon usages in `SavingPlanCard`, `TotalVaultCard`, `Dashboard`, `ManageProject`, `SavingPlan`, `Profile` |
| 10 | Vault card % visibility | `src/components/TotalVaultCard/TotalVaultCard.tsx` (line 39–44, percentage badge) |
| 11 | Hide Quick Add | `src/pages/AddMoney.tsx`, `src/components/AddMoneyForm/AddMoneyForm.tsx`, `src/components/QuickAddRow/QuickAddRow.tsx` |
| 12 | Dashboard Saving Plan card typography | `src/components/SavingPlanCard/SavingPlanCard.tsx` |

---

## Root Cause Hypotheses

### Issue 1 — Vault card back navigation bug

The Vault card uses `<Pressable onClick={handleManageProject}>` (Dashboard.tsx:950) which calls `navigate('/manage-project')` — a standard `history.pushState`. The back button should return to `/dashboard`.

**Hypothesis:** The Profile page also navigates to `/manage-project` (Profile.tsx:189). `tabFromPath` (AppLayout.tsx:308) maps `/manage-project` to the `dashboard` tab. When the creator clicks the Vault card, the BottomNav shows `dashboard` as active. But when pressing back, the browser might land on `/profile` if there was a prior navigation to Profile → Manage Project → back → Dashboard → Vault → Manage Project. The real culprit is likely that `navigate('/manage-project')` in Profile pushes an entry, and a subsequent Vault card click pushes another. The back stack accumulates: `/profile` → `/manage-project` → `/dashboard` → `/manage-project`. Back from the last entry lands on `/dashboard`, which is correct. Need to investigate if there's a `replace` somewhere or if the BottomNav uses `navigate(path)` (push) vs `navigate(path, { replace: true })`.

**Alternative hypothesis:** The BottomNav `onTabChange` handler (AppLayout.tsx:74–78) uses plain `navigate(nextPath)` which pushes, not replaces. If the user taps Dashboard tab, then Profile tab, then navigates within Profile to Manage Project, and then the "back" pops to Profile — that's technically correct but unexpected from the user's perspective if they arrived from Vault on Dashboard.

**Safest fix:** When the Vault card navigates to `/manage-project`, ensure it uses `navigate('/manage-project')` (push, not replace). Verify the Profile page does the same. The actual fix may be ensuring `tabFromPath` correctly classifies `/manage-project` — it currently falls through to `dashboard` which is correct. Must trace the exact reproduction steps to identify the extra history entry.

### Issue 2 — Progress section user card spring-back missing

`PlayerProgressRow` renders as a `<button>` when `onClick` is provided (line 156–178). It uses no motion wrapper. The `Pressable` component handles spring-back via Framer Motion's `whileTap: { scale: 0.97, y: 2 }` and `SPRING.press`. The row button doesn't use `Pressable` — it's a plain `<button>` with `outline-none focus-visible:ring-2`. Missing motion feedback on tap.

### Issue 3 — Saving Plan card click scope too wide

Both the "no plan" state (line 167) and the "has plan" state (line 252) wrap the entire `<section>` in `<Pressable onClick={onConfigure}>`. This makes the whole card clickable, including the verified balance area, meta rows, habit section, etc. Only the edit FAB should trigger `onConfigure`.

### Issue 4 — Balance Checking click area and spring-back

The verified-balance section (lines 358–482) already has `onClick={e => e.stopPropagation()}` on its container div. The toggle button (lines 361–387) is interactive. The section should have its own press feedback (spring-back) isolated to its own div. Currently, if the outer `Pressable` wrapping the entire card is removed (Issue 3 fix), the balance section needs its own `Pressable` or button wrapper. Must ensure no event propagation triggers card-level actions.

### Issue 5 — Saving Plan page header/layout

- Pause/Resume button is below the header (`mt-4`, line 614–627), taking a full row. Should be inline with "แผนเก็บเงิน".
- "แก้ไขแผน" is the `isChange ? sp.changeTitle : sp.setUpTitle` heading text — investigate whether it's redundant with the Pause/Resume button context.
- "รูปแบบแผน" (`sp.planTypeLabel`) is displayed as a 2×2 grid of buttons (lines 647–669). Needs to become a dropdown/picker overlay.
- The 2-column layout only applies to plan fields section for `sm:` breakpoint (line 677 `sm:grid-cols-2`). Could expand to desktop.

### Issue 6 — Thai calendar hardcoded English

`CalendarPicker.tsx` has hardcoded English at:
- Lines 27–29: `MONTH_NAMES` array — English month names only.
- Line 31: `DAY_LABELS` — English day abbreviations.
- Lines 225–229: Hint text ("Tap to set start date", etc.) — English only.
- No i18n hook is imported in this component.

### Issue 7 — Saving Plan top blank area

`SavingPlan.tsx` line 595: `pt-8` on the outermost container, plus line 604: `mt-10` on the content div below the back button. Combined = `~4.5rem` of top padding. The `mt-10` appears intentional to push content below the AppShell's fixed top fade/status seam (`h-[calc(env(safe-area-inset-top)+2.75rem)]`), but it's too large.

### Issue 8 — Dashboard Saving Plan card column spacing

Lines 293–329: 3-col grid with `gap-3`. Each column uses `gap-2` between icon and text. The "เป้าวันนี้" and "เหลืออีก" columns may have excessive `gap-3` between them. Need to reduce to `gap-2` and test mobile fit.

### Issue 9 — Icon button inconsistency

Existing `IconButton` component (`src/components/IconButton/IconButton.tsx`) provides `ghost` and `solid` variants in `sm`/`md`/`lg` sizes with consistent `active:scale-[0.96]`. However, many places use ad-hoc `<button>` elements:
- `SavingPlanCard.tsx` line 265–273: edit FAB — `h-12 w-12 rounded-full bg-brand-500` (matches `IconButton` `solid` `lg` but doesn't use the component).
- `TotalVaultCard.tsx` line 47–53: edit button — `h-7 w-7 rounded-full border border-white/25 bg-white/25` (custom white-on-gradient style, not in `IconButton` variants).
- `Dashboard.tsx` line 1079–1083: "change next" text button — different pattern.
- `SavingPlan.tsx` line 598: back button uses `IconButton` correctly.

### Issue 10 — Vault card percentage visibility

Line 39–44: percentage badge uses `bg-white/25 px-3 py-1.5 font-mono text-xs`. The semi-transparent white on the gradient card background may not provide enough contrast. The badge blends into the card.

### Issue 11 — Quick Add hide

Quick Add appears in:
- `AddMoney.tsx`: `QuickAmountsEditor` (line 9), `quickAmounts` usage (lines 39, 300, 316), `editingQuickAmounts` state.
- `AddMoneyForm.tsx`: `QuickAddRow` import (line 8), renders the quick-amount pills.
- Not in Deposit Activities / `ActivityHistoryModal` — Quick Add is only in the Add Money flow.

**Correction:** User says "Add page" and "Deposit Activities". The Add page is `AddMoney.tsx`. "Deposit Activities" likely means the activity feed on Dashboard or the `ActivityHistoryModal`. Quick Add doesn't appear in the activity feed. Need to clarify — but the user may mean the `BucketSheet` (deposit bottom sheet that opens from Dashboard bucket tap) which also renders `AddMoneyForm`.

Files to hide Quick Add in: `AddMoneyForm.tsx` (the QuickAddRow rendering) and any `BucketSheet` usage.

### Issue 12 — Dashboard Saving Plan card typography

`SavingPlanCard.tsx` uses multiple text sizes:
- Heading: `text-lg font-bold` (line 258)
- Subheading/status: `text-base font-bold` (line 260)
- Meta labels: `text-[10px]` (lines 299, 309, 319)
- Meta values: `text-sm font-bold` (lines 300–301, etc.)
- Habit line: `text-xs text-ink-muted` (line 333)
- VB label: `text-sm font-bold uppercase tracking-[0.18em]` (line 369)

The `text-[10px]` meta labels may be too small; the `text-lg` heading may be too large relative to the card's density. Need a production-level hierarchy pass.

---

## Sprint Breakdown

### Sprint 1 — Navigation and Click-Scope Fixes

**Scope:** Issues 1, 3, 4

**Files likely to change:**
- `src/components/SavingPlanCard/SavingPlanCard.tsx`
- `src/pages/Dashboard.tsx` (navigation investigation)
- `src/pages/Profile.tsx` (navigation investigation)
- `src/pages/AppLayout.tsx` (navigation investigation)

**Implementation notes:**

1. **Issue 3 — Remove outer `<Pressable>` from SavingPlanCard**
   - Remove the `<Pressable onClick={onConfigure}>` wrapping the entire card section (lines 252 and 484, and lines 167 and 192 for no-plan state).
   - The edit FAB button (line 265) already has `onClick={e => { e.stopPropagation(); onConfigure(); }}` — simplify to `onClick={onConfigure}` since propagation is no longer an issue.
   - The "Set up plan" button (line 180–186) already works independently.
   - For the no-plan state, the card can stay clickable via `<Pressable>` since the whole card IS the CTA there. Or remove and rely on the "Set up plan" button alone. Decision: keep `<Pressable>` on no-plan state (it's a single CTA surface), remove on has-plan state.

2. **Issue 4 — Balance Checking section gets its own Pressable**
   - Wrap the verified-balance toggle button area (lines 360–387) in a `<Pressable>` with its own spring-back.
   - Ensure the `onClick={e => e.stopPropagation()}` on the container div is still present.
   - The expandable form below the toggle should NOT spring-back — only the toggle header row.

3. **Issue 1 — Vault card back navigation**
   - Reproduce the exact bug: Dashboard → Vault card → ManageProject → Back → observe destination.
   - Check if `tabFromPath('/manage-project')` returning `'dashboard'` causes BottomNav to re-navigate.
   - Check if `handleManageProject` (Dashboard.tsx:878) uses push (correct) vs replace.
   - Check if the Profile page's navigate to `/manage-project` uses push or replace.
   - If the issue is that back lands on Profile because the user previously visited Profile, the fix may be to ensure Dashboard→ManageProject uses push without an intermediate redirect.
   - If `AppLayout.tsx`'s `onTabChange` handler pushes (not replaces), tapping between tabs accumulates entries. This is normal SPA behaviour — the bug may be that an internal redirect or guard inserts an extra Profile entry. Investigate `ProtectedRoute` and any redirect logic.

**Acceptance criteria:**
- [ ] Clicking Dashboard Vault card → ManageProject → Back returns to Dashboard.
- [ ] Clicking Dashboard Vault card → ManageProject → Back does NOT land on Profile.
- [ ] SavingPlanCard edit mode only activates via the edit FAB button, not by tapping the card body.
- [ ] SavingPlanCard no-plan state remains fully tappable.
- [ ] Balance Checking section toggle has isolated spring-back animation.
- [ ] Balance Checking expansion does not trigger card-level edit.
- [ ] Tapping the VB inline form inputs/buttons does not trigger edit mode.

**Manual QA checklist:**
- [ ] Dashboard → Vault card → ManageProject → browser back → lands on Dashboard.
- [ ] Dashboard → Profile tab → ManageProject → browser back → lands on Profile.
- [ ] Tap SavingPlanCard body area (not edit button) → nothing happens.
- [ ] Tap SavingPlanCard edit FAB → navigates to /saving-plan.
- [ ] Tap "Set up plan" on no-plan card → navigates correctly.
- [ ] Tap Balance Checking section → expands with spring-back on the section only.
- [ ] Fill in VB form → card does not navigate.
- [ ] Test on mobile viewport (375px).

**Build/lint/typecheck:**
```bash
npm run build
npm run lint
```

**Suggested commit message:**
```
fix: scope SavingPlanCard click to edit FAB, isolate balance-check spring-back, fix vault back nav
```

**Rollback:** Revert the commit. No state or DB changes.

---

### Sprint 2 — Motion Feedback Polish

**Scope:** Issue 2

**Files likely to change:**
- `src/components/PlayerProgressRow/PlayerProgressRow.tsx`
- `src/components/Pressable/Pressable.tsx` (reference only, no changes expected)
- `src/lib/motion.ts` (reference only)

**Implementation notes:**
- The interactive variant of `PlayerProgressRow` (when `onClick` is set, line 156–178) renders a `<button>` inside a `<div>`. The button itself needs spring-back feedback.
- Option A: Wrap the entire row `<div>` in `<Pressable>` and pass the click handler. Risk: `Pressable` uses `motion.div` with `role="button"` — nesting a `<button>` inside a `role="button"` div is invalid HTML. The trailing `NudgeButton` would also be inside the Pressable.
- Option B: Apply Framer Motion `whileTap` directly to the inner `<button>` using `motion.button`. This is the safest approach — spring-back only on the content button, trailing slot stays outside.
- **Chosen: Option B.** Convert the `<button>` in the interactive variant to `motion.button` with `whileTap: { scale: 0.97, y: 2 }` and `transition: SPRING.press`. Import `motion` and `useReducedMotion` from `framer-motion`. When `prefers-reduced-motion` is active, use `whileTap: { opacity: 0.85 }`.
- Must NOT cause layout shift — `motion.button` with `scale` transform doesn't affect document flow.

**Acceptance criteria:**
- [ ] Tapping a player progress row (interactive variant) shows spring-back animation.
- [ ] The animation affects only the clickable content area, not the trailing NudgeButton.
- [ ] No layout shift occurs during the animation.
- [ ] `prefers-reduced-motion` is respected (opacity fade instead of scale).
- [ ] Non-interactive rows (no `onClick`) have no motion feedback.

**Manual QA checklist:**
- [ ] Dashboard → tap own progress row → spring-back visible, navigates to /profile.
- [ ] Dashboard → tap partner row → spring-back visible, navigates to /members/:id.
- [ ] NudgeButton remains independently tappable without triggering row animation.
- [ ] Toggle reduced motion in OS settings → verify opacity-only feedback.
- [ ] Test on 375px mobile viewport.

**Build/lint/typecheck:**
```bash
npm run build
npm run lint
```

**Suggested commit message:**
```
feat: add spring-back press feedback to progress race player rows
```

**Rollback:** Revert the commit. Pure visual addition.

---

### Sprint 3 — Saving Plan Page Header and Layout

**Scope:** Issues 5, 7

**Files likely to change:**
- `src/pages/SavingPlan.tsx`
- `src/i18n/locales/en.ts` (if removing redundant text key)
- `src/i18n/locales/th.ts` (same)

**Implementation notes:**

1. **Issue 7 — Remove top blank area**
   - Line 595: `pt-8` on outermost div — reduce to `pt-2` or `pt-4`.
   - Line 604: `mt-10` on content div below back button — reduce to `mt-4` or `mt-5`.
   - The AppShell provides top fade/status seam overlays. Other pages (Dashboard, ManageProject) use `pt-8` for the page but don't add `mt-10` below the back button. Align with ManageProject's pattern.

2. **Issue 5 — Pause/Resume placement**
   - Currently the Pause/Resume button is in the `<header>` block, below the title, taking a full row with `mt-4` (line 613–627).
   - Move it to a flex row alongside the title. Use `flex items-center justify-between` on the header, title on left, Pause/Resume pill on right.
   - Adjust sizing: the button is currently `px-5 py-2.5 text-sm` — may need to shrink to `px-3 py-1.5 text-xs` to fit inline.

3. **Issue 5 — Remove redundant "แก้ไขแผน" if applicable**
   - The title shows `sp.changeTitle` ("แก้ไขแผน" = "Edit Plan") when `isChange` is true. If the Pause/Resume button already contextualizes the state, the heading could remain — "แก้ไขแผน" tells the user this is the edit surface. Investigate whether the user considers it redundant with the Pause/Resume button or with the page eyebrow. If the eyebrow (`sp.pageEyebrow`) already says "Saving Plan" and the form is self-evident, the title can be simplified. **Decision: keep title, mark for user review during QA.**

4. **Issue 5 — 2-column layout for desktop/tablet**
   - The plan fields section (lines 673–807) uses `grid-cols-1 gap-3 sm:grid-cols-2` only for the increasing-daily start/increment fields.
   - For wider screens, wrap the plan-type selector + plan-fields into a 2-column grid at `md:` breakpoint: type selector on left, fields on right.
   - On mobile, keep single-column stacked layout.
   - Preview card can span full width below both columns.
   - Avoid displaying too much at once on mobile — keep current scroll behavior.

**Acceptance criteria:**
- [ ] Saving Plan page has no excessive blank area above the header.
- [ ] Pause/Resume button is inline-right with the page title.
- [ ] On desktop/tablet (≥768px), plan type and fields display in 2-column layout.
- [ ] On mobile (<768px), layout remains single-column and readable.
- [ ] Preview card renders correctly in both layouts.
- [ ] Existing Pause/Resume functionality works unchanged.

**Manual QA checklist:**
- [ ] Open /saving-plan on mobile (375px) → no large blank area at top.
- [ ] Verify back button → header → form spacing matches other pages (ManageProject).
- [ ] Pause/Resume button renders inline with title, no overflow or wrap on small screens.
- [ ] Tap Pause → confirm → plan pauses. Resume → confirm → plan resumes.
- [ ] Resize to 768px+ → 2-column layout appears. Content doesn't overflow.
- [ ] Resize back to mobile → single column, no broken layout.
- [ ] All form inputs remain functional in both layouts.

**Build/lint/typecheck:**
```bash
npm run build
npm run lint
```

**Suggested commit message:**
```
fix: saving plan page header layout, remove top gap, add responsive 2-col grid
```

**Rollback:** Revert the commit. Layout-only changes.

---

### Sprint 4 — Saving Plan Plan-Type Picker and Thai Calendar i18n

**Scope:** Issues 5 (picker part), 6

**Files likely to change:**
- `src/pages/SavingPlan.tsx`
- `src/components/CalendarPicker/CalendarPicker.tsx`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`
- `src/i18n/messages.ts` (type additions)

**Implementation notes:**

1. **Issue 5 — Custom plan-type picker for "รูปแบบแผน"**
   - Current UI: 2×2 grid of buttons (SavingPlan.tsx lines 647–669).
   - Target: a dropdown/picker that shows the selected option in a compact trigger, and overlays the options when tapped.
   - **Implementation approach:** Create a local `PlanTypePicker` sub-component within `SavingPlan.tsx` (no new file needed unless reusable).
   - Trigger: a button showing the selected plan type label + chevron-down icon.
   - Dropdown: an absolutely-positioned overlay (`absolute z-10`) with the 4 options, appearing below the trigger.
   - Use `position: absolute` with a parent `position: relative` container.
   - Click outside to close (add a `useEffect` listener or a backdrop div).
   - Must NOT push content down — overlay sits on top of content.
   - Style consistently with existing Pressable/pill patterns.
   - Animation: use `AnimatePresence` + `motion.div` with opacity/scale-y for smooth open/close.

2. **Issue 6 — Thai calendar i18n**
   - `CalendarPicker.tsx` needs to accept locale or use `useI18n()`.
   - Add i18n keys:
     - `calendar.monthNames` — array of 12 month names.
     - `calendar.dayLabels` — array of 7 day abbreviations.
     - `calendar.tapStartDate` — "Tap to set start date" / "แตะเพื่อเลือกวันเริ่มต้น".
     - `calendar.tapEndDate` — "Tap to set end date" / "แตะเพื่อเลือกวันสิ้นสุด".
     - `calendar.tapChangeStart` — "Tap to change start date" / "แตะเพื่อเปลี่ยนวันเริ่มต้น".
   - Import `useI18n` in CalendarPicker and replace hardcoded strings.
   - For Thai months, use standard Thai month names (มกราคม, กุมภาพันธ์, etc.).
   - For Thai day labels, use standard abbreviations (อา, จ, อ, พ, พฤ, ศ, ส).
   - Year display: in Thai locale, optionally show Buddhist Era year (+543). Investigate whether the app uses BE elsewhere. If not, keep CE year for consistency.
   - Aria labels for prev/next month buttons should also be localized.

**Acceptance criteria:**
- [ ] Plan type selector renders as a compact dropdown trigger, not a 2×2 grid.
- [ ] Tapping the trigger opens an overlay with 4 plan type options.
- [ ] Selecting an option closes the overlay and updates the form.
- [ ] Overlay does not push other content down (absolute positioning).
- [ ] CalendarPicker shows Thai month names when language is Thai.
- [ ] CalendarPicker shows Thai day abbreviations when language is Thai.
- [ ] CalendarPicker hint text ("Tap to set...") is in Thai when language is Thai.
- [ ] English locale remains unchanged.

**Manual QA checklist:**
- [ ] Open /saving-plan → plan type shows as dropdown trigger, not grid.
- [ ] Tap dropdown → overlay appears with 4 options.
- [ ] Select "Daily" → dropdown closes, form updates.
- [ ] Overlay doesn't shift page content.
- [ ] Click outside dropdown → closes.
- [ ] Switch language to Thai → CalendarPicker shows Thai months/days/hints.
- [ ] Switch language to English → CalendarPicker shows English months/days/hints.
- [ ] Calendar remains fully functional (select dates, range mode, amounts display).
- [ ] Test on 375px mobile viewport.
- [ ] Test on tablet/desktop.

**Desktop/tablet QA:**
- [ ] Dropdown overlay stays within viewport on wider screens.
- [ ] Calendar grid alignment is not broken by i18n text width changes.

**Build/lint/typecheck:**
```bash
npm run build
npm run lint
```

**Suggested commit message:**
```
feat: plan-type dropdown picker and Thai calendar i18n for CalendarPicker
```

**Rollback:** Revert the commit. If the picker has issues, the 2×2 grid can be restored from git.

---

### Sprint 5 — Dashboard Visual Hierarchy Polish

**Scope:** Issues 8, 10, 12

**Files likely to change:**
- `src/components/SavingPlanCard/SavingPlanCard.tsx`
- `src/components/TotalVaultCard/TotalVaultCard.tsx`

**Implementation notes:**

1. **Issue 8 — SavingPlanCard meta column spacing**
   - Lines 293–329: `grid grid-cols-3 gap-3` → reduce to `gap-2`.
   - Each column's icon: `h-8 w-8` with `gap-2` → potentially reduce icon to `h-7 w-7` with `gap-1.5` if too tight.
   - Test on 375px — ensure labels don't overflow or truncate critical information.
   - The columns are "เป้าวันนี้" (today's plan), "เหลืออีก" (days left), and progress %. Thai text may be wider than English — test both.

2. **Issue 12 — SavingPlanCard typography hierarchy**
   - Current sizes:
     - Card heading (`d.savingPlanLabel`): `text-lg font-bold` → consider `text-base font-bold`.
     - Status headline (`moneyHeadline`): `text-base font-bold` → keep, or reduce to `text-sm font-bold`.
     - Meta labels: `text-[10px]` → bump to `text-[11px]` for readability.
     - Meta values: `text-sm font-bold` → keep.
     - Habit/streak line: `text-xs text-ink-muted` → keep.
     - VB section label: `text-sm font-bold uppercase tracking-[0.18em]` → keep.
   - Goal: create clear heading > subheading > body > helper hierarchy without making the card too tall.
   - Keep Thai readability in mind — Thai glyphs at `text-[10px]` (10px) can be hard to read.

3. **Issue 10 — Vault card percentage visibility**
   - Lines 39–44: badge uses `bg-white/25 px-3 py-1.5 font-mono text-xs font-bold`.
   - The `bg-white/25` may lack contrast on the gradient background.
   - Options:
     - Increase opacity: `bg-white/40` or `bg-white/50`.
     - Add a subtle `backdrop-blur-sm` for glass effect.
     - Use `text-sm` instead of `text-xs` for the percentage.
     - Add `shadow-sm` for depth separation.
   - Must stay in the correct visual position (top-right, inline with heading).
   - Don't change the gradient theme or overall card appearance.

**Acceptance criteria:**
- [ ] SavingPlanCard meta columns are closer together without cramping.
- [ ] SavingPlanCard typography has clear heading/subheading/body/helper hierarchy.
- [ ] Thai text in meta labels is readable at the chosen font size.
- [ ] Vault card percentage badge is noticeably more visible.
- [ ] Vault card percentage badge stays in correct position (top-right corner).
- [ ] No layout breakage on 375px screens.

**Manual QA checklist:**
- [ ] Dashboard → SavingPlanCard → meta columns visually balanced, no truncation.
- [ ] Compare Thai and English rendering of the card.
- [ ] Vault card → percentage badge clearly visible against gradient.
- [ ] Resize to 320px (SE) → card doesn't break.
- [ ] Resize to 414px (Plus) → card looks balanced.
- [ ] Dark mode (if applicable) → percentage badge still readable.

**Build/lint/typecheck:**
```bash
npm run build
npm run lint
```

**Suggested commit message:**
```
fix: dashboard card visual hierarchy — spacing, typography, vault percentage contrast
```

**Rollback:** Revert the commit. Visual-only changes.

---

### Sprint 6 — App-Wide Icon Button Consistency

**Scope:** Issue 9

**Files likely to change:**
- `src/components/IconButton/IconButton.tsx` (possible new variant)
- `src/components/SavingPlanCard/SavingPlanCard.tsx`
- `src/components/TotalVaultCard/TotalVaultCard.tsx`
- Other files with ad-hoc icon buttons (migration candidates)

**Implementation notes:**

1. **Audit current icon buttons:**
   - `IconButton` component: `ghost` (bg-brand-50) and `solid` (bg-brand-500) variants, 3 sizes (sm=32, md=40, lg=48).
   - `SavingPlanCard` edit FAB: ad-hoc `h-12 w-12 bg-brand-500 text-ink-inverse shadow-haloOrange` — matches `IconButton` `solid` `lg` but doesn't use the component.
   - `TotalVaultCard` edit button: ad-hoc `h-7 w-7 bg-white/25 border border-white/25` — unique white-on-gradient style, not in `IconButton`.
   - `SavingPlan.tsx` back button: uses `IconButton` correctly.
   - `ManageProject.tsx`: uses `PageHeader` which may have its own back button pattern.

2. **Strategy:**
   - **Phase 1 (this sprint):** Migrate the `SavingPlanCard` edit FAB to use `IconButton variant="solid" size="lg"`. Add `shadow-haloOrange` to the `solid` variant in `IconButton` if not already there (it is — check line 21: `solid: 'bg-brand-500 text-ink-inverse shadow-haloOrange'`). Direct match — just swap the ad-hoc button for `<IconButton variant="solid" size="lg">`.
   - **Phase 2 (this sprint):** Add a `card-overlay` or `glass` variant to `IconButton` for the TotalVaultCard pattern (`bg-white/25 border border-white/25`). This allows consistent treatment of icon buttons on gradient/image backgrounds.
   - **Phase 3 (defer):** Audit remaining ad-hoc icon buttons across the app and migrate in a separate PR. This sprint only migrates the 2 highest-impact duplicates.

3. **Do NOT change:**
   - Modal confirm/cancel buttons.
   - Text-only buttons ("View all", "Change next").
   - `Button` component variants.

**Acceptance criteria:**
- [ ] SavingPlanCard edit FAB uses `IconButton` component.
- [ ] TotalVaultCard edit button uses `IconButton` with new variant.
- [ ] Both buttons look identical to their current appearance (visual regression check).
- [ ] `active:scale-[0.96]` feedback from `IconButton` applies to both.
- [ ] No other buttons in the app are accidentally changed.

**Manual QA checklist:**
- [ ] Dashboard → SavingPlanCard edit FAB → same visual, same behavior.
- [ ] Dashboard → TotalVaultCard edit button → same visual, same behavior.
- [ ] Tap each button → spring-back from `active:scale-[0.96]`.
- [ ] Verify other icon buttons in the app (SavingPlan back, ManageProject back) still work.

**Build/lint/typecheck:**
```bash
npm run build
npm run lint
```

**Suggested commit message:**
```
refactor: migrate card edit FABs to shared IconButton component
```

**Rollback:** Revert the commit. Behavioral equivalence means no data risk.

---

### Sprint 7 — Hide Quick Add Safely

**Scope:** Issue 11

**Files likely to change:**
- `src/components/AddMoneyForm/AddMoneyForm.tsx`
- `src/pages/AddMoney.tsx`
- `src/lib/flags.ts` (add feature flag)

**Implementation notes:**

1. **Add a feature flag:**
   - Check if `src/lib/flags.ts` exists and already has flags (e.g., `SHOW_ATTACHED_SLIP` is imported in AddMoney.tsx line 28).
   - Add `SHOW_QUICK_ADD = false` to the flags file.
   - This matches the existing pattern: `SHOW_ATTACHED_SLIP` controls slip attachment visibility.

2. **Hide in AddMoneyForm:**
   - Import `SHOW_QUICK_ADD` from flags.
   - Wrap the `QuickAddRow` rendering and the "edit quick amounts" button with `{SHOW_QUICK_ADD && ...}`.
   - Keep the `quickAmounts` prop accepted (no interface change) — just don't render the UI.

3. **Hide in AddMoney.tsx:**
   - Wrap the `QuickAmountsEditor` modal and the `editingQuickAmounts` state handlers with `SHOW_QUICK_ADD` checks.
   - Or simply: since `AddMoneyForm` won't render the edit button, the modal won't open. Minimal change needed in AddMoney.tsx — but wrap the modal itself for cleanliness.

4. **Deposit Activities check:**
   - `ActivityHistoryModal` does NOT render Quick Add UI — it shows deposit history.
   - The Dashboard activity feed doesn't show Quick Add either.
   - If "Deposit Activities" in the user's request means the `BucketSheet` bottom sheet, check if it renders `AddMoneyForm` or `QuickAddRow`. Read `BucketSheet.tsx` to confirm.

5. **Do NOT delete:**
   - `QuickAddRow` component.
   - `QuickAmountsEditor` component.
   - Quick amounts data in profiles.
   - Any hook or type related to quick amounts.

**Acceptance criteria:**
- [ ] Quick Add pills are not visible on the Add page.
- [ ] "Edit quick amounts" button is not visible.
- [ ] Quick Amounts Editor modal is not accessible.
- [ ] Setting `SHOW_QUICK_ADD = true` restores all Quick Add functionality.
- [ ] No TypeScript errors or unused-variable warnings from the hide.
- [ ] Deposit activity history is unaffected.

**Manual QA checklist:**
- [ ] Open /add → no quick-amount pills visible.
- [ ] No "edit" button for quick amounts visible.
- [ ] Deposit flow works correctly without quick amounts (manual amount entry only).
- [ ] Open Dashboard → tap a bucket → deposit sheet → no quick amounts visible (if applicable).
- [ ] Activity feed / history modal → unchanged.
- [ ] Change flag to `true` in code → quick amounts reappear.

**Build/lint/typecheck:**
```bash
npm run build
npm run lint
```

**Suggested commit message:**
```
chore: temporarily hide Quick Add behind SHOW_QUICK_ADD feature flag
```

**Rollback:** Set `SHOW_QUICK_ADD = true` in `src/lib/flags.ts`, or revert the commit.

---

## Recommended Feature Branch

```
fix/46-ui-polish-navigation-dashboard
```

---

## Risks and Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Vault back-nav fix may affect other navigation flows | Medium | Investigate before changing; test Profile→ManageProject and Dashboard→ManageProject separately |
| Removing `<Pressable>` from SavingPlanCard may remove expected feedback | Low | Keep edit FAB interactive; add VB section its own Pressable |
| Plan-type dropdown may not work well on very small screens | Medium | Fallback: keep 2×2 grid on screens < 360px |
| Thai calendar month/day width may break grid alignment | Low | Test with Thai locale; use abbreviations if full names overflow |
| 2-column Saving Plan layout may crowd content on tablet | Medium | Only apply at `md:` (768px+); test at 768px breakpoint |
| IconButton variant addition may have naming conflicts | Low | Check existing variant names before adding |
| Hiding Quick Add may confuse users who rely on it | Low | Feature flag allows instant restoration |

---

## Thai / English i18n Considerations

- Sprint 4 adds calendar i18n keys to both `en.ts` and `th.ts`.
- Thai month names are significantly longer than English — calendar header may need `truncate` or smaller text.
- Thai day abbreviations (อา, จ, อ, พ, พฤ, ศ, ส) are 1–2 characters, similar width to English.
- Sprint 5 typography changes must be tested in both locales.
- Sprint 3 header layout must accommodate Thai text which is typically wider than English.

---

## Mobile QA Requirements (All Sprints)

- Test on 375px width (iPhone SE / standard).
- Test on 320px width (smallest supported).
- Test on 414px width (iPhone Plus).
- Verify no horizontal scroll appears.
- Verify no text truncation hides critical financial information.
- Verify touch targets remain ≥ 44px for interactive elements.
- Test with system font size set to largest accessibility setting.

## Desktop / Tablet QA Requirements (Sprint 3)

- Test Saving Plan 2-column layout at 768px (iPad portrait).
- Test at 1024px (iPad landscape / small desktop).
- Verify column balance — neither column should be disproportionately empty.
- Verify form inputs remain full-width within their column.
- Verify preview card spans correctly below the 2-column grid.

---

## Accessibility Notes

- **Buttons (Sprint 1, 6):** All icon buttons must have `aria-label`. Existing `IconButton` component enforces `ariaLabel` prop — ensure migrated buttons pass it.
- **Pressable (Sprint 1, 2):** `Pressable` sets `role="button"` when `onClick` is present. When wrapping a section that contains other buttons, ensure no nested `role="button"` → `<button>` violations.
- **Dropdown/picker (Sprint 4):** Must be keyboard-navigable (arrow keys, Enter to select, Escape to close). Use `aria-expanded`, `aria-haspopup="listbox"`, and `role="option"` on items.
- **Motion (Sprint 2):** `useReducedMotion` is already used in `Pressable`. New motion in `PlayerProgressRow` must also respect `prefers-reduced-motion`.
- **Calendar (Sprint 4):** Localized aria-labels for prev/next month buttons.
- **Hidden Quick Add (Sprint 7):** Feature flag hides UI completely — no ghost elements or disabled states that confuse screen readers.
