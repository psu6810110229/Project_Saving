# Task 42 - Momentum Purpose Mode

Status: Planning only. No app code, migrations, RLS, RPCs, notification fan-out, Saving Plan math, or data model changes in this task.
Date drafted: 2026-05-25.

## Goal

Upgrade the Dashboard Momentum / Daily Deposit Trend card so it keeps member comparison while adding a saving-purpose scope.

The chart must remain a 7-day deposit trend. Task 42 changes what slice of the 7-day deposits is shown:

- Purpose axis: `All` / bucket category / optionally a specific bucket.
- Member axis: `Total` / `Me` / `Compare`.

The product question becomes:

> For this saving purpose, how are we doing over the last 7 days, and who is contributing?

## Feedback And Bug

NONGART feedback, translated:

> Instead of switching from `room`, it may be better to switch by each type of sub-item we created.

Current bug:

- The mode selector uses `Room | Me | Compare`.
- `Room` is technically correct because it aggregates all room members.
- But the user mental model is not "room mechanics"; it is "what are we saving for?"
- The current selector answers only "who deposited?" and hides the more important product question "which purpose/bucket is moving?"
- This makes the Momentum card feel detached from the Smart Buckets section directly above it.

How Task 42 overcomes it:

- Keep the member comparison axis, but rename `Room` to a user-facing aggregate label such as `Total` / `รวม`.
- Add a parallel saving-purpose axis that filters the same 7-day deposit data before member aggregation.
- Apply filters in this order:
  1. Filter deposits by selected purpose.
  2. Apply member view (`Total`, `Me`, or `Compare`) to the filtered deposits.
- Preserve the 7-day chart framing, labels, animation, tooltip, and member comparison flow.

## Execution Rules

Implement this plan as separate tasks, one by one.

- Work on a feature branch, recommended: `feature/task-42-momentum-purpose-mode`.
- Do not batch tasks into one commit.
- After each implementation task:
  - run `npm run build`
  - run `npm run lint`
  - manually smoke-test the changed Dashboard flow when UI changed
  - commit the completed task before starting the next task
  - stop and wait for the next explicit instruction
- One task = one focused commit.
- Do not fix unrelated issues in the same commit. Record unrelated findings under Follow-up Findings.
- Commit message format:
  - `task42: add momentum purpose data helpers`
  - `task42: add momentum purpose picker`
  - `task42: wire purpose and member trend axes`
  - `task42: polish momentum purpose mobile layout`
- If build or lint fails because of pre-existing unrelated worktree changes, stop and report the exact failure before editing unrelated files.

## Non-Goals And Hard Rules

- Do not replace the 7-day trend with a progress/balance chart.
- Do not remove member comparison.
- Do not remove the selected compare member dropdown.
- Do not use browser-default select/dropdown controls inside the Momentum card.
- Do not add migrations or new database columns.
- Do not change `savings_logs.amount > 0`.
- Do not count bucket transfers as new deposits in the daily trend. Transfers reallocate existing saved value; they are not a deposit event.
- Do not change Saving Plan expected math or plan accrual.
- Do not change `RoomLeaderboardList`, `PlayerProgressRow`, or member detail routes.
- Do not introduce a new charting library.
- Keep Thai and English copy in i18n files.

## Product Model

### Axis 1 - Purpose Scope

Purpose answers "what money is for."

Recommended MVP scopes:

- `all`: all deposits in the active room.
- `category:<BucketCategory>`: deposits whose bucket category matches the selected category.

Optional follow-up scope, only if the MVP remains readable:

- `bucket:<bucketId>`: deposits for one specific bucket.

Why category-first:

- Categories are comparable across members.
- Bucket names are member-specific and can diverge, such as "Hotel", "Tokyo stay", and "Stay with family".
- Task 41 already normalized bucket category metadata and icons.

Default:

- `all`.

Visible labels:

- English: `All`, `Flight`, `Stay`, `Transport`, `Food`, `Activities`, `Shopping`, `Buffer`, `Home`, `Other`.
- Thai: `ทั้งหมด`, then existing bucket category labels from `copy.bucket.categoryLabels`.

Only show category chips that exist in visible active buckets for the current room. Always show `All`.

### Axis 2 - Member View

Member view answers "whose deposits are shown."

Replace the visible `Room | Me | Compare` labels with:

- `Total` / `รวม`
- `Me` / `ฉัน`
- `Compare` / `เทียบ`

Behavior:

- `Total`: one primary series, all visible members combined after purpose filtering.
- `Me`: one primary series, current user only after purpose filtering.
- `Compare`: two series, current user versus one selected member after purpose filtering.

Default:

- `Total`.

For rooms with no other members:

- Hide the member mode control, or show only `Me` if the design needs an explicit state.
- The purpose picker should still work.

## Data Rules

Inputs already available in Dashboard:

- `logs`: deposit rows with `bucket_id`, `user_id`, `amount`, and `created_at`.
- `buckets`: current user's active buckets.
- `data.roomMembersBuckets.allBuckets`: visible co-member active buckets.
- `leaderboard.entries`: member identity and display labels.
- `otherMemberIds`: compare candidates.

Build a visible bucket lookup:

```ts
const visibleBucketsById = new Map(
  [...buckets, ...data.roomMembersBuckets.allBuckets].map(bucket => [bucket.id, bucket]),
);
```

Purpose filter:

```ts
type MomentumPurposeScope =
  | { kind: 'all' }
  | { kind: 'category'; category: BucketCategory }
  | { kind: 'bucket'; bucketId: string };
```

Filtering rules:

- `all`: include every log in the active room.
- `category`: include logs whose `bucket_id` resolves to a visible bucket with that normalized category.
- `bucket`: include logs whose `bucket_id` equals the selected bucket id.
- Logs without `bucket_id` are included only in `all`.
- If the selected category no longer exists after bucket edits or room switch, reset to `all`.
- If the selected bucket no longer exists after bucket edits or room switch, reset to `all`.

Series rules:

- Continue using Bangkok-local day keys from `lastSevenDateKeys()`.
- Keep oldest-to-newest order.
- Build filtered series from deposits only.
- Do not add transfer events into daily trend values.
- Header total equals the sum of the visible 7-day series for the active purpose and member view.

Compare mode:

- Primary series = current user's filtered deposits.
- Secondary series = selected member's filtered deposits.
- Displayed total = primary + secondary, matching the two visible series.

Total mode:

- Primary series = all visible members' filtered deposits.
- Primary label = selected purpose plus aggregate member label, such as `All · Total` where space allows, or just `Total` if the header already shows the selected purpose.

## UX Direction

Inside the Momentum card, stack controls in this order:

1. Title and 7-day total.
2. Purpose picker.
3. Member mode control.
4. Compare member dropdown, only in Compare mode.
5. Compact legend.
6. Chart.

Purpose picker:

- Horizontal scrollable chip row.
- Use category icons from `BucketCategoryIcon`.
- Single-line labels with ellipsis.
- `All` chip should be first and always visible.
- Selected chip should have a clear filled/raised state consistent with existing Dashboard controls.
- At 320 px, controls may scroll horizontally but must not wrap into broken multi-line pills.

Member mode:

- Keep the existing custom segmented control pattern.
- Rename visible labels away from `Room`.
- Keep haptic feedback and animation behavior.

Legend:

- Keep maximum two visible legend items.
- In `Total` or `Me`, show one legend chip.
- In `Compare`, show current user and selected member.
- Do not show long full names in the legend if they cause overflow; use bounded labels and title/aria for full names.

Header copy:

- The chart remains `Daily Deposit Trend` / `ยอดฝากรายวัน`.
- Add a compact scope label if needed, such as `All purposes` / `ทั้งหมด` or the selected category name.
- Avoid explanatory helper paragraphs inside the card.

## Sprint Tasks

### Task 42.0 - Plan

Files:

- `docs/plans/42-momentum-purpose-mode.md`

Deliverable:

- This ready-implement plan.
- Build and lint pass.
- Commit the plan only.

### Task 42.1 - Add Momentum Purpose Data Helpers

Files:

- `src/lib/dashboardStats.ts`
- `src/pages/Dashboard.tsx` only for imports if needed
- optional: `src/lib/momentumPurpose.ts`

Deliverable:

- Add a pure helper that builds daily series from:
  - logs
  - optional user id
  - purpose scope
  - visible bucket lookup
  - optional today date
- Add helper for available category scopes from visible active buckets.
- Preserve existing `dailyAmountSeries()` call sites.
- Do not change UI yet.

Acceptance:

- Existing Dashboard behavior is unchanged.
- Helper treats bucketless logs as `all` only.
- Helper ignores transfer/activity events.
- Build and lint pass.
- Commit before moving on.

### Task 42.2 - Add Purpose Picker UI

Files:

- `src/pages/Dashboard.tsx`
- optional: `src/components/MomentumPurposePicker/MomentumPurposePicker.tsx`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`

Deliverable:

- Add a reusable Dashboard-scoped purpose chip picker.
- Render `All` plus available category chips.
- Keep the picker visually inside the Momentum card through the existing `MomentumChart` extension props or a new prop.
- No chart data change yet unless the slice remains small.

Acceptance:

- Purpose picker is visible without breaking current member modes.
- Chips are single-line and horizontally scrollable on mobile.
- Thai labels do not stack vertically.
- Build and lint pass.
- Browser smoke if practical.
- Commit before moving on.

### Task 42.3 - Wire Purpose Scope To Member Modes

Files:

- `src/pages/Dashboard.tsx`
- `src/components/MomentumChart/MomentumChart.tsx`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`

Deliverable:

- Filter Momentum chart data by selected purpose.
- Rename member mode labels:
  - `Room` -> `Total`
  - `ห้อง` -> `รวม`
- Keep `Me` / `ฉัน` and `Compare` / `เทียบ`.
- Apply purpose first, member view second.
- Reset invalid selected purpose on room/bucket changes.

Acceptance:

- `All + Total` matches current `Room` behavior.
- `All + Me` matches current `Me` behavior.
- `All + Compare` matches current `Compare` behavior.
- Category + Total shows everyone in that category only.
- Category + Me shows current user's deposits in that category only.
- Category + Compare shows current user vs selected member in that category only.
- Header total and legend totals match the displayed series.
- Build and lint pass.
- Commit before moving on.

### Task 42.4 - Mobile Polish And Edge States

Files:

- `src/pages/Dashboard.tsx`
- `src/components/MomentumChart/MomentumChart.tsx`
- optional purpose picker component

Deliverable:

- Polish spacing with both control rows visible.
- Handle:
  - no buckets
  - no category match
  - one-member room
  - long English names
  - Thai names without spaces
  - 320 px viewport

Acceptance:

- Momentum card does not overlap title, total, controls, legend, or chart.
- Card height changes smoothly when Compare dropdown appears/disappears.
- Purpose chips remain tappable and readable.
- No browser-default select/dropdown is used.
- Build and lint pass.
- Browser smoke at 320, 375, and 390 px.
- Commit before moving on.

### Task 42.5 - Final QA Notes

Files:

- `docs/plans/42-momentum-purpose-mode.md` only if meaningful findings need recording.

Deliverable:

- Record only important implementation findings or QA exceptions.
- Do not rewrite the whole plan as an implementation diary.

Acceptance:

- Build and lint pass after final docs update.
- Commit final QA note if the doc changed.

## Files Expected To Change During Implementation

Likely:

- `src/pages/Dashboard.tsx`
- `src/components/MomentumChart/MomentumChart.tsx`
- `src/lib/dashboardStats.ts`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`

Optional:

- `src/lib/momentumPurpose.ts`
- `src/components/MomentumPurposePicker/MomentumPurposePicker.tsx`

Should not change:

- `supabase/migrations/*`
- `supabase/functions/*`
- `src/components/RoomLeaderboardList/RoomLeaderboardList.tsx`
- `src/components/PlayerProgressRow/PlayerProgressRow.tsx`
- Saving Plan calculation helpers
- Notification fan-out code

## Copy Requirements

Add or reuse copy keys:

- `dashboard.dailyDepositPurposeAria`
- `dashboard.dailyDepositPurposeAll`
- `dashboard.dailyDepositModeTotal`
- Existing:
  - `dashboard.dailyDepositModeMe`
  - `dashboard.dailyDepositModeCompare`
  - `dashboard.dailyDepositCompareAria`
  - `bucket.categoryLabels`

Suggested English:

- `dailyDepositPurposeAria`: `Daily Deposit Trend purpose`
- `dailyDepositPurposeAll`: `All`
- `dailyDepositModeTotal`: `Total`

Suggested Thai:

- `dailyDepositPurposeAria`: `ขอบเขตเป้าหมายของกราฟยอดฝากรายวัน`
- `dailyDepositPurposeAll`: `ทั้งหมด`
- `dailyDepositModeTotal`: `รวม`

## QA Matrix

Desktop:

- Dashboard at normal desktop width.
- Total / Me / Compare still work.
- Purpose picker does not look oversized.

Mobile:

- 320 px smoke check.
- 375 px main check.
- 390 px iPhone-width check.

Data cases:

- One-member room.
- Two-member room.
- 3-7 member room.
- Current user has buckets, partner has no buckets.
- Partner has category-matching buckets, current user does not.
- Logs with missing `bucket_id`.
- Long English display names.
- Thai display names and Thai bucket/category labels.

Expected results:

- `All + Total` remains the broad room/project total for last 7 days.
- `Flight + Total` includes all members' flight deposits only.
- `Flight + Me` includes only current user's flight deposits.
- `Flight + Compare` compares current user versus selected member's flight deposits.
- If selected member has no deposits in that category, their series renders as zeros instead of disappearing unexpectedly.

## Rollback

Per-task rollback:

- Revert the specific Task 42 commit.
- Because Task 42 must not include migrations, rollback is UI/helper-only.

Whole-feature rollback:

- Revert all `task42:` commits in reverse order.
- The database and existing deposits remain unchanged.

## Follow-Up Findings

Record unrelated issues here instead of fixing them inside Task 42 commits.

- Pending.
