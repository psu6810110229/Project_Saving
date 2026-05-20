# Task 38 - Mobile Dashboard 3+ Member UI Fixes

Status: Planning only. No app code, migrations, RLS, notification, goal, or Saving Plan math changes in this task.
Date drafted: 2026-05-20.

This task fixes the mobile Dashboard UI regressions that show up once rooms have 3-7 members. The work is deliberately narrow and UI-only. It does not redesign the Progress Race / leaderboard section; that can be Task 39.

Priority order:

1. Daily Deposit Trend chart legend/layout bug.
2. Bucket member selector clipping/wrapping bug.
3. Other members' bucket display readability.

## 1. Screens And Components Affected

Primary screen:

- `src/pages/Dashboard.tsx`

Affected components:

- `src/components/MomentumChart/MomentumChart.tsx`
  - Daily Deposit Trend card.
  - Header/title/amount area.
  - `LegendCell` inline legend.
  - SVG tooltip labels if long member names can still overflow.
- `src/components/Segmented/Segmented.tsx`
  - Current bucket owner tabs used above the bucket section.
  - Prefer a scoped Dashboard-only mobile member picker if a global `Segmented` change would affect other pages.
- `src/components/BucketGrid/BucketGrid.tsx`
  - Bucket section heading/subtitle layout.
  - Current fixed `grid-cols-2` layout.
- `src/components/BucketRow/BucketRow.tsx`
  - Only if a compact read-only row variant is needed for other members' buckets. Default card behavior must remain unchanged.
- `src/components/DataContext/DataContext.tsx`
- `src/components/DataContext/DataContextValue.ts`
  - Read only. These already expose `otherMemberIds`, `roomMembersBuckets`, and `roomMembersSavingPlans`; this task should consume existing plural fields only.
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`
  - Only if short labels such as `Room`, `Me`, `Compare`, selected-member labels, or member picker accessibility copy are needed.

Related existing plans:

- Task 33 delivered the N-aware Dashboard structure: `RoomLeaderboardList`, per-member bucket groups, and plural `DataContext` consumption.
- Task 35 raised the room cap to 7 and explicitly avoided Dashboard redesign work.
- Task 38 is the mobile polish pass for the Dashboard surfaces exposed by Task 35.

## 2. Non-Goals And Hard Rules

- Do not redesign `RoomLeaderboardList`, `PlayerProgressRow`, or the Progress Race / leaderboard cards.
- Do not touch SQL, migrations, RLS, RPCs, triggers, or Supabase policies.
- Do not change the room cap.
- Do not change goal or individual sub-goal semantics.
- Do not change notification fan-out.
- Do not change Saving Plan math or plan accrual calculations.
- Do not add member detail navigation or change route semantics.
- Do not use browser-default select/dropdown controls for the Daily Deposit Trend mode or compare member selection.
- Do not use emoji.
- Use existing app components, `Avatar`, and SVG/icon components only for the Daily Deposit Trend controls and compare chips.
- Preserve 2-user behavior as much as practical.
- Keep this mobile-first. The minimum target viewport is 375 px wide, with a 320 px smoke check for extra-small devices.

## 3. Root Causes

### 3.1 Daily Deposit Trend Chart

Current code:

- `Dashboard.tsx` passes `partnerName={firstOtherEntry?.displayName ?? d.partnerLabel}` into `MomentumChart`.
- `MomentumChart.tsx` renders a header row as `flex items-start justify-between`.
- The title/amount block is on the left.
- The legend block is on the right with `shrink-0 flex-col`.
- `LegendCell` renders full names inline next to colored dots and totals.

Root cause:

- The legend is treated as a fixed-width side rail even on mobile.
- The legend has no mobile-specific maximum width, no mode strategy for 3-7 member rooms, and no separation from the title/amount area.
- `shrink-0` on the legend lets long names steal width from the title/amount block.
- The card itself has `overflow-hidden`, so overflow can look like clipping or overlap.
- The current chart supports only two visible bar series: you and one other series. Showing full per-member legend labels for 3-7 users would exceed the available mobile width and make the chart look broken.

### 3.2 Bucket Member Selector

Current code:

- `Dashboard.tsx` renders the bucket owner selector in a right-aligned wrapper:
  - `-mx-2 flex items-center justify-end gap-2 overflow-x-auto px-2`
- `Segmented.tsx` renders `inline-flex` pills.
- Each tab button has fixed horizontal padding and renders the full label.

Root cause:

- The selector is still shaped like a 2-option segmented control, not a 3-7 member picker.
- The scroll container is right-aligned, which can make the first tabs feel clipped or detached on mobile.
- Tab labels have no explicit no-wrap/truncation/max-width contract.
- Long English names and Thai names without spaces can force awkward wrapping or clipping.
- The control floats above the bucket section instead of reading as the bucket section's owner picker.

### 3.3 Other Members' Buckets

Current code:

- `Dashboard.tsx` already shows only one selected other member's buckets at a time via `activeOtherGroup`.
- `BucketGrid.tsx` always uses a 2-column square card grid.
- Other-member grid titles include the full member name through `d.yourBuckets(activeOtherGroup.name)`.
- `BucketRow.tsx` truncates bucket names but the saved/target line is not explicitly constrained.

Root cause:

- The data model is already N-safe, but the presentation still assumes a small 2-user view.
- At 3-7 users, member names are longer and there are more possible selected owners, so the title, picker, and square bucket cards become visually dense.
- The current layout avoids showing every member's buckets at once, which is good, but it still needs stronger mobile rules for selected-member context, title truncation, and read-only bucket rows.

## 4. Proposed Daily Deposit Chart Strategy

### 4.1 Mode Control

Do not use `You vs Others (N)` as the final Daily Deposit Trend UX.

Use a Dashboard-scoped custom segmented control above or inside the Daily Deposit Trend card:

- `Room`
- `Me`
- `Compare`

Rules:

- Default mode is `Room`.
- The control must be a custom segmented control, not a browser-default select/dropdown.
- The control must use existing app components, `Avatar`, and SVG/icon components only.
- Labels must stay single-line at 320-390 px widths.
- The selected state must be clear without increasing the control height or causing layout shift.

Mode behavior:

- `Room` shows total deposits for the room across the current 7-day window.
- `Me` shows only the current user's deposits.
- `Compare` shows the current user versus one selected member.
- `Compare` mode member selection uses horizontal avatar chips.
- The compare member chips must be horizontally scroll-safe, left aligned, single-line, and must not use a native select/dropdown.
- The compare member chips should prefer avatar initials/images plus truncated names when names fit. If space is tight, keep the avatar and use a short text label or accessible full name.

### 4.2 Mobile Legend Rule

On mobile, do not render full member names as an inline side legend.

Use a compact mobile legend that cannot overlap the title/amount block:

- Header row:
  - Title and amount remain the primary visual.
  - No full member names in the right side of the header.
- Legend placement:
  - Move legend below the amount row or below the SVG on mobile.
  - Use a compact horizontal no-wrap row of chips or dot labels.
  - Chart legend must show a maximum of 2 short labels.
- `Room` mode:
  - Use one short legend label, such as `Room`.
  - Do not list member names.
- `Me` mode:
  - Use one short legend label, such as `Me`.
- `Compare` mode:
  - Use two short legend labels, such as `Me` and the selected member's first name, initials, or another bounded short display label.
  - The selected member's full display name may be available through accessible text, `title`, tooltip copy, or the avatar chip, but it must not force the legend to wrap or overlap.

Rationale:

- A 7-member grouped bar chart would be unreadable in the current SVG width.
- A full 7-name legend is the direct cause of the mobile breakage.
- `Room | Me | Compare` gives users an explicit way to move between room totals, personal deposits, and one-to-one comparison without cramming every member into the chart.

### 4.3 Chart Data Contract

For this task, change only the Dashboard chart display strategy, not Saving Plan math.

- `Room` mode series is the total daily deposits for the room for the same 7-day window.
- `Me` mode series remains `dailyAmountSeries(logs, user?.id)`.
- `Compare` mode uses the current-user series plus one selected member's daily deposit series.
- `Compare` mode must never show more than two member series.
- The chart header total should be described as the total represented by the active mode, not a room-level financial invariant outside the selected mode.
- Expected Saving Plan series stays exactly as it is today.
- Do not change deposit writes, log queries, balance checks, or plan calculations.

If implementation risk is high, the fallback is simpler:

- Keep the existing chart data source shape.
- Still add the `Room | Me | Compare` mode UI contract.
- Fix the layout by moving/truncating the legend and limiting it to 2 short labels.
- File any richer room-total derivation as a follow-up only if it cannot be implemented UI-only from existing data.

The preferred Task 38 result is the complete `Room | Me | Compare` UI with `Room` as the default mode.

### 4.4 Chart Layout Rules

In `MomentumChart.tsx`:

- Replace the mobile header's side-by-side legend with a stacked mobile header:
  - title
  - amount + last 7 days
  - mode segmented control if it belongs inside the chart card
  - compare avatar chips when `Compare` is active
  - compact legend row
  - chart
- Use responsive classes so larger screens can keep a side legend if it remains clean.
- Add an explicit max width to any visible legend label.
- Use `min-w-0`, `max-w-*`, `truncate`, and `whitespace-nowrap` together.
- Keep colored dots and totals readable.
- Ensure tooltip text has a bounded width and never escapes the SVG/card at 320-390 px widths.
- Keep chart height stable; legend changes must not cause layout shift while data loads.
- Do not use emoji in the mode control, legend, avatar chips, tooltip, or empty states.

## 5. Proposed Bucket Member Picker Strategy

Replace the Dashboard bucket selector's 2-option segmented behavior with a mobile-safe horizontal member picker.

Preferred approach:

- Add a small Dashboard-scoped member picker component, for example:
  - `src/components/MemberPicker/MemberPicker.tsx`, or
  - a local `BucketMemberPicker` helper inside `Dashboard.tsx` if the implementation stays tiny.
- Use a full-width horizontal scroll strip:
  - left aligned
  - `overflow-x-auto`
  - `snap-x` optional
  - no `justify-end`
  - no detached floating placement
- Each member option:
  - `shrink-0`
  - fixed or bounded width
  - single-line text only
  - truncates with ellipsis
  - includes an avatar initial or colored dot if available from leaderboard data
  - selected state is obvious but not visually heavier than the section
- Keep `You` as the first option.
- Include only other members with at least one bucket, matching current behavior.
- Reset `bucketView` to `mine` when the selected member disappears or has no visible buckets, as the current effect already does.

Do not use a dropdown for Task 38. The requested fix is a mobile-safe horizontal member picker.

2-user behavior:

- With one other member, the picker should feel very close to the current two-tab control.
- The main change is that it cannot clip, wrap, or right-align itself off-screen.

## 6. Proposed Other-Member Bucket Display Strategy

Keep the most important current behavior:

- Show only one member's buckets at a time.
- Do not stack all other members' bucket sections.
- Do not show 3-7 member-specific bucket grids at once.

Improve readability:

- For `mine`, preserve the current editable `BucketGrid` behavior and add/create bucket affordance.
- For another selected member:
  - Show a clear selected-member header with count and read-only state.
  - Truncate the member name in the title instead of allowing a tall multi-line heading.
  - Prefer a compact read-only list or a less dense layout on mobile if the 2-column square cards feel crowded.
  - If using the existing cards, ensure amounts and names are constrained and do not overflow.
- Members with zero buckets should remain absent from the picker unless product wants an explicit empty state later.
- If all other members have zero buckets, hide the picker and show the current "mine" bucket section unchanged.

Preferred implementation path:

1. First fix the picker and title truncation.
2. QA selected other-member bucket grids at 3, 5, and 7 members.
3. If square cards still feel crowded, add a read-only compact row variant for other members only.

This keeps the change scoped and preserves 2-user behavior.

## 7. Exact Files To Modify

Expected files:

- `docs/plans/38-mobile-dashboard-3plus-ui.md`
  - This plan.
- `src/pages/Dashboard.tsx`
  - Derive `otherMembersCount`.
  - Add Daily Deposit Trend mode state for `Room`, `Me`, and `Compare`, with `Room` as the default.
  - Derive the room-total daily deposit series from existing visible deposit data.
  - Derive the current-user daily deposit series.
  - Derive the selected compare member daily deposit series.
  - Pass active mode, short chart labels, and compare-member metadata into `MomentumChart`.
  - Render compare member selection with horizontal avatar chips.
  - Replace the bucket selector wrapper and `Segmented` usage with a mobile-safe picker.
  - Keep `RoomLeaderboardList` untouched except for not modifying its surrounding layout.
- `src/components/MomentumChart/MomentumChart.tsx`
  - Add or accept the custom `Room | Me | Compare` segmented control.
  - Add or accept horizontal compare avatar chips.
  - Make the chart legend mobile-safe.
  - Add compact legend behavior with a maximum of 2 short labels.
  - Bound tooltip labels if needed.
- `src/components/Segmented/Segmented.tsx`
  - Modify only if the safer choice is to make `Segmented` itself no-wrap and scroll-safe.
  - Avoid broad visual changes because this component is used elsewhere.
- `src/components/BucketGrid/BucketGrid.tsx`
  - Add optional title truncation/layout support or compact/read-only layout support only if needed.
- `src/components/BucketRow/BucketRow.tsx`
  - Add optional compact read-only variant only if QA shows the other-member bucket cards remain hard to read.
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`
  - Add only minimal labels if needed, such as:
    - `dailyDepositModeRoom`
    - `dailyDepositModeMe`
    - `dailyDepositModeCompare`
    - `selectedMemberBuckets(name)`
    - member picker aria label
    - compare member picker aria label

Files that should not be modified:

- `supabase/migrations/*`
- RLS/RPC SQL files
- Notification functions or edge functions
- Saving Plan calculation libraries
- `src/components/RoomLeaderboardList/RoomLeaderboardList.tsx`
- `src/components/PlayerProgressRow/PlayerProgressRow.tsx`

If implementation appears to require leaderboard changes, stop and re-plan for Task 39.

## 8. Thai And English Truncation / No-Wrap Rules

These rules apply to chart legends, member picker options, bucket owner labels, and bucket section headings.

General:

- Member names in controls must be one line.
- Use `min-w-0` on flex/grid parents that contain truncating text.
- Use `overflow-hidden text-ellipsis whitespace-nowrap` for visible member-name labels.
- Do not use `break-words` or unconstrained wrapping in controls.
- Keep full member names available through `aria-label`, `title`, or screen-reader-only copy where appropriate.
- Avoid using viewport-width-based font scaling.

English:

- Long names truncate with ellipsis.
- Do not allow long first-name/last-name combinations to wrap tab labels into two lines.
- Use short visible labels in chart legends: `Room`, `Me`, or a bounded selected-member label.

Thai:

- Thai names often have no spaces, so truncation must not depend on word boundaries.
- Use the same no-wrap ellipsis behavior as English for controls.
- Do not let Thai chart labels or member tabs stack vertically one glyph/word per line.
- Section headings may wrap to two lines only when they are not controls; picker labels and chart legend labels must not wrap.

Bucket names:

- Bucket card/list names remain single-line truncated.
- Amount lines should be tabular and bounded; if the saved/target string is too long, reduce secondary text size or use a compact currency format in the read-only other-member view.

## 9. Mobile QA Matrix

Run QA on mobile widths:

- 320 px smoke check.
- 375 px main target.
- 390 px common iPhone width.

Use rooms with realistic display names:

- Short English: `Art`, `Fran`.
- Long English: `Alexandra Thompson-Smith`.
- Thai display names with no spaces.
- Mixed English/Thai names in the same room.

### 9.1 Three Members

- Dashboard loads with 3 members.
- Progress Race remains unchanged by this task.
- Daily Deposit Trend:
  - default mode is `Room`.
  - segmented control shows `Room`, `Me`, and `Compare`.
  - `Room` mode shows total deposits for the room.
  - `Me` mode shows only the current user.
  - `Compare` mode shows current user versus one selected member.
  - `Compare` member selection uses horizontal avatar chips.
  - no browser-default select/dropdown appears.
  - title, amount, and `Last 7 days` do not overlap the legend.
  - no full list of member names appears inline on mobile.
  - chart legend shows no more than 2 short labels.
  - legend labels do not wrap vertically.
  - tooltip stays inside the card.
- Bucket member picker:
  - shows `You` plus other members with buckets.
  - is left aligned and horizontally scroll-safe.
  - no tab is clipped at initial render.
  - no label wraps to two lines.
- Other-member buckets:
  - selecting each member shows only that member's buckets.
  - read-only state is visible.
  - long member names do not make the section heading unusable.

### 9.2 Five Members

- Daily Deposit Trend still has a compact legend and stable chart height.
- `Room`, `Me`, and `Compare` modes all remain usable at 375 px.
- Compare avatar chips can scroll horizontally.
- Compare mode never shows more than the current user and one selected member.
- Chart legend shows no more than 2 short labels.
- Picker can scroll horizontally.
- Active tab remains visible after selection.
- No member label wraps.
- Other-member buckets show one selected member at a time.
- Bucket cards/rows remain readable with long bucket names and large THB amounts.

### 9.3 Seven Members

- Dashboard does not introduce page-level horizontal overflow.
- Daily Deposit Trend does not attempt to render seven full names inline.
- Daily Deposit Trend does not use `You vs Others (N)` as the final UX.
- `Room` remains the default mode.
- Compare avatar chips show up to six selectable other members and scroll cleanly at 375 px.
- Chart legend still shows no more than 2 short labels.
- Picker shows up to seven options and scrolls cleanly at 375 px.
- First and last picker options can both be reached.
- Selecting member 7 does not clip the selected state.
- Other-member bucket section remains one selected member at a time.
- No UI from the Progress Race / leaderboard is redesigned or visually disturbed.

## 10. Acceptance Criteria

Chart:

- On mobile, the Daily Deposit Trend card never overlaps title/amount text with legend text.
- Full member names are not rendered as an inline chart legend on mobile in 3-7 member rooms.
- Legend labels are single-line and truncated or short by design.
- Chart legend shows a maximum of 2 short labels.
- Daily Deposit Trend uses a custom `Room | Me | Compare` segmented control.
- Default Daily Deposit Trend mode is `Room`.
- `Room` mode shows total deposits for the room.
- `Me` mode shows only the current user.
- `Compare` mode shows current user versus one selected member.
- Compare member selection uses horizontal avatar chips.
- Daily Deposit Trend controls do not use browser-default select/dropdown controls.
- Daily Deposit Trend controls do not use emoji.
- Daily Deposit Trend controls use existing app components, `Avatar`, and SVG/icon components only.
- 2-user rooms still show a clear two-series chart.
- 3-7 member rooms use `Room`, `Me`, and `Compare` modes rather than `You vs Others (N)`.
- Tooltip text stays inside the card.
- Existing Saving Plan expected series inputs are not semantically changed.

Bucket member picker:

- The bucket owner selector is usable with 3, 5, and 7 members.
- No picker label wraps to multiple lines.
- No picker option is clipped at initial render.
- Horizontal scrolling works without causing body-level horizontal overflow.
- The selected member remains visually connected to the bucket section.
- 2-user behavior remains visually close to the current tab control.

Other members' buckets:

- Only one selected other member's buckets are shown at a time.
- The app does not render all members' bucket grids simultaneously.
- Long member names and Thai names do not create tall, broken headings.
- Bucket names and saved/target text remain readable on 375 px screens.
- Own bucket editing behavior remains unchanged.
- Other-member buckets remain read-only.

Regression boundaries:

- No SQL/migration/RLS changes.
- No room-cap changes.
- No goal/sub-goal semantic changes.
- No notification fan-out changes.
- No Saving Plan math changes.
- No leaderboard/progress redesign.
- `npm run build` passes.
- Run lint/type checks used by the repo if available.

## 11. Rollback Plan

This is a pure frontend rollback.

Rollback steps:

1. Revert the Dashboard chart/picker/bucket display commit.
2. Restore `MomentumChart` header/legend rendering to the previous implementation.
3. Restore the Dashboard bucket selector to the previous `Segmented` usage.
4. Revert any optional `BucketGrid` or `BucketRow` layout props added for read-only other-member buckets.
5. Revert any new EN/TH i18n keys if they are unused after rollback.

No data rollback is needed:

- No migrations are added.
- No room membership rows change.
- No deposits, buckets, goals, balance checks, notifications, or Saving Plan records change.

If only the room-total chart derivation causes concern:

- Keep the layout fix.
- Revert only the room-total derivation to the safest existing visible data source.
- Keep the `Room | Me | Compare` mode control.
- Keep compare mode as current user versus one selected member.
- Keep the mobile no-wrap compact legend rules.

## 12. Risks

- Room-total chart semantics may be a product decision. Mitigation: label `Room` clearly and derive it only from existing deposit data available to the Dashboard.
- Truncating names can make members ambiguous in rooms with similar names. Mitigation: include avatar initials/dots in the picker and full names in accessible labels.
- Changing `Segmented` globally could affect Activity History and Saving Plan surfaces. Mitigation: prefer a Dashboard-scoped member picker or an opt-in prop.
- Compact read-only bucket rows could drift from the existing bucket card visual language. Mitigation: default `BucketRow` behavior remains unchanged; use compact mode only for selected other-member buckets if QA proves it necessary.
- Tooltip text in SVG has manual sizing logic and can still overflow with long Thai/English labels. Mitigation: use short chart labels on mobile and cap tooltip line length.
- 7-member testing requires enough local accounts/data. Mitigation: document any QA gap explicitly before implementation is accepted.

## 13. Implementation Order For The Future Code Task

1. Add Daily Deposit Trend mode state and default it to `Room`.
2. Add the custom `Room | Me | Compare` segmented control.
3. Wire `Room`, `Me`, and `Compare` chart series from existing Dashboard data.
4. Add horizontal compare member avatar chips.
5. Fix `MomentumChart` mobile legend layout with a maximum of 2 short labels.
6. Replace the Dashboard bucket selector with a mobile-safe horizontal picker.
7. Tighten selected-member bucket heading truncation.
8. QA other-member bucket readability before adding a compact bucket row variant.
9. Run 3, 5, and 7 member mobile QA.
10. Confirm Progress Race / leaderboard was not redesigned.
