# Task 33 — Multi-User Dashboard UI (N-aware Dashboard surfaces)

Status: Planning only. No code, migrations, or file edits in this
document.
Owner: Senior FE/FS pair (Claude) with Fran.
Source: `docs/multi-user-room-feature-plan.md` (Feature 2 only) +
`docs/plans/feature-2-multi-user-rooms-audit.md` (slice S4) +
`docs/plans/32-multi-user-data-hooks.md` (the N-safe data layer this
task consumes) + the `feat: N-safe room/member data hooks (Task 32)`
commit (`ce4e75f`).
Date drafted: 2026-05-20.

This task is the **Dashboard UI** slice (S4 in the audit). It makes
`Dashboard.tsx` and its child components render N-member room data
correctly while keeping the room capacity cap at 2 in production. The
work is purely visual / structural: it consumes the plural fields
that Task 32 already exposes on `DataContext`
(`otherMemberIds`, `roomMembersBuckets`, `roomMembersSavingPlans`)
and stops collapsing every other member to the legacy
`partnerEntry`.

No SQL, no RLS, no migration, no cap change, no notification fan-out,
no individual sub-goal semantics. Two-user behaviour must look the
same as today (with at most minor, intentional layout tweaks that
also degrade cleanly to 1-row when alone or N-rows when more join).

---

## 1. Goal

- Replace `HeadToHeadCard` (hard-coded 2-player) with an N-aware
  leaderboard list on the Dashboard.
- Group "other members' buckets" by member instead of one flat
  partner section.
- Use Task 32's plural data fields
  (`data.otherMemberIds`, `data.roomMembersBuckets`,
  `data.roomMembersSavingPlans`) as the canonical source of
  other-member state. Stop reading `data.partnerBuckets` from
  `Dashboard.tsx`. Stop deriving `partnerEntry` from `leaderboard`
  inside `Dashboard.tsx`.
- Update the goal-edit bucket-floor warning so it considers the
  maximum bucket-target total across **all** members (not just
  one partner).
- Preserve today's 2-user dashboard layout visually as closely as
  possible: a 2-row leaderboard, a single tabbed buckets section,
  and the same Saving Plan + Verified Balance island for the caller.
- Add explicit loading/error/empty states for the new N-aware
  surfaces.
- Make the layout responsive on small screens (375 px width is the
  minimum target; the existing Dashboard works at that width and
  must continue to).
- Cover 2-, 3-, and 7-user reasoning in manual QA. Production cap
  stays at 2; 3+ member behaviour is exercised only against a local
  dev DB.

## 2. Non-goals (do not touch)

- Raising the room capacity (2 → 7). Trigger `enforce_two_player_cap`
  (0023), RPC `join_room_by_code` (0024), and the
  `useRooms.joinRoomByCode` full-room error string remain exactly as
  they are today.
- Notification fan-out from Task 31. `notify_*` RPCs,
  `_smart_check_*`, `notify-partner-deposit` edge function and any
  push behaviour stay put.
- Individual sub-goals / per-member targets under a room goal
  (Feature 5). `goals.target_amount` semantics are unchanged; each
  row's denominator continues to come from `leaderboard.entries[i].target`
  exactly like today.
- New SQL migrations, new RLS policies, new RPCs, new edge functions.
- Changing the saving-plan / nudge UX on the dedicated
  `/saving-plan` page — that is audit slice S5, a separate task.
  Dashboard does not currently surface other members' saving plans
  (only the caller's own `data.savingPlan`); per the task brief
  (scope item 5 says "if currently surfaced"), other members' plans
  are NOT added to the Dashboard in this task.
- Member detail navigation. Tapping a member row navigates nowhere
  in this task. The `/members/:userId` route is Feature 3 / Task 34.
- New realtime channels. Existing channels (leaderboard, logs,
  buckets) keep their current cadence.
- Chart redesign. `MomentumChart`, `SavingRaceChart`,
  `BucketSheet.trendPreview`, and `AddMoney`'s comparison chart keep
  their current single-partner shape — they consume **one** "other
  member" series only. Picking which other member to chart, or
  aggregating across N, is deferred to slice S6 (the audit's polish
  slice). For now we feed those props with the first other member
  by `joined_at asc` (a deterministic source, unlike today's
  leaderboard-rank `partnerEntry`).
- i18n / copy rewrites. Strings like `partnerLabel`, `partnerSlot`,
  `partner` referenced by the bucket segmented control keep their
  existing English/Thai wording. Only the minimal new strings
  required for the leaderboard's "members in room" header text and
  any new empty/error states are added (§8).
- Removing `HeadToHeadCard` or `PlayerProgressRow` from the
  codebase. `HeadToHeadCard` may end up unused on the Dashboard;
  whether to delete it is decided after the new list lands. Default:
  keep it in git history but stop importing it from `Dashboard.tsx`.
  `PlayerProgressRow` stays — the new list reuses it.

## 3. Current Dashboard assumptions to replace

Sources: `src/pages/Dashboard.tsx` and the Task 32 audit (`§7` of
`docs/plans/feature-2-multi-user-rooms-audit.md`).

Blocking (must be replaced in this task):

1. `Dashboard.tsx:134` —
   `const partnerEntry = leaderboard.entries.find(entry => !entry.isYou);`
   Picks the first non-self leaderboard entry. At N ≥ 3 this is
   non-deterministic (leaderboard rank changes with savings) and at
   N = 2 it works only by coincidence.

2. `Dashboard.tsx:135` —
   `const { buckets: partnerBuckets } = data.partnerBuckets;`
   Reads the legacy singular wrapper. Replace with
   `data.roomMembersBuckets` and group by `user_id`.

3. `Dashboard.tsx:192–193` — `you` / `partner` derivations and the
   `leftPlayer` / `rightPlayer` objects assembled at lines 434–452.
   Designed for exactly 2 players. Must become a sorted list of
   "your row + N − 1 other rows".

4. `Dashboard.tsx:219–220` —
   `partnerBucketTotal = sumTargets(partnerBuckets)` and
   `highestBucketTotal = Math.max(bucketTargetTotal, partnerBucketTotal)`.
   Considers only the caller and one partner. Must become
   `max(bucketTargetTotal, max(sumTargets(bucketsByUser[id]) for id))`.

5. `Dashboard.tsx:294–303` — `partnerBucketItems` + `partnerName`
   used to render one tab of the bucket Segmented. Must become a
   per-member grouping.

6. `Dashboard.tsx:314–315, 575–622` — `hasPartnerBuckets`,
   `bucketView: 'mine' | 'partner'`, and the conditional render
   between own and partner `BucketGrid`. Must become "mine + one
   tab per other member who has buckets".

7. `Dashboard.tsx:520–533` — `<HeadToHeadCard left right partnerSlot />`
   usage. Replace with an N-aware list (`RoomLeaderboardList`).

8. `Dashboard.tsx:498` — `d.membersInRoom(leaderboard.entries.length)`
   already shows the correct N value because `leaderboard.entries`
   is N-safe. No change needed but verify the copy reads sensibly at
   N = 1 (solo creator before anyone joins) and at N = 7.

Non-blocking (kept as-is, with the **same** legacy single-partner
shape, but fed from a **deterministic** source per the non-goal
above):

9. `Dashboard.tsx:526–531` — `NudgeButton` inside the leaderboard.
   Today renders for one partner. In the new list it is rendered
   once per other-member row (per-recipient action). The button
   itself is already N-safe (audit row, S5 column).

10. `Dashboard.tsx:635–656` — `MomentumChart` and the hidden
    `SavingRaceSection`. `partnerSeries`, `partnerName`,
    `partnerUserId` keep their single-partner shape. Source switches
    from `partnerEntry` (leaderboard rank order) to
    `firstOtherMemberByJoinedAt` (deterministic). At N = 2 the value
    is identical to today; at N ≥ 3 the choice is documented as a
    known limitation and deferred to S6.

11. `Dashboard.tsx:815–820` — `BucketSheet.trendPreview.theirSeries`
    and `theirLabel`. Same treatment as `MomentumChart`.

12. `Dashboard.tsx:731–735` — `GoalTargetSummary`'s `partnerAllocated`
    prop currently reads `partnerBucketTotal` and labels the line as
    "partner". Replace `partnerAllocated` with
    `highestOtherMemberAllocated` (the max sum-of-targets among
    other members) and pass that. The label copy stays as-is in this
    task; the copy cleanup is S6. At N = 2 this is byte-for-byte
    today's value.

## 4. Proposed UI changes

### 4.1 New component: `RoomLeaderboardList`

Path: `src/components/RoomLeaderboardList/RoomLeaderboardList.tsx`.

Purpose: vertical, N-aware list that replaces `HeadToHeadCard` on
the Dashboard. Reuses `PlayerProgressRow` (one row per entry).

Props:
```
interface RoomLeaderboardListProps {
  /** Leader-first list. Caller is responsible for sort. */
  entries: PlayerProgressEntry[];
  /** Render a per-row trailing slot for any non-self entry. */
  renderRowTrailing?: (entry: PlayerProgressEntry) => ReactNode;
  /** Section heading. Defaults to copy.dashboard.progressRace. */
  title?: string;
  /** Empty-state body when entries.length === 0 (solo creator). */
  emptyBody?: string;
}

interface PlayerProgressEntry {
  userId: string;
  name: string;
  fallback: string;
  imageUrl?: string | null;
  saved: number;
  target: number;
  themeColor?: ThemeSwatch;
  isYou: boolean;
}
```

Behaviour:
- Renders one `PlayerProgressRow` per entry, in the order received.
- The first entry (highest `saved`) is marked `isLeader=true`. When
  the top two are tied on `saved`, no `isLeader` is set on either
  (matches today's `HeadToHeadCard` `tied` branch).
- The leader row carries a `gapLabel`: `copy.dashboard.tied` when
  tied, otherwise `copy.dashboard.leadingBy(formatCurrency(gap))`,
  where `gap = saved[0] - saved[1]` (the gap between leader and
  runner-up). At N = 1, no `gapLabel` is rendered.
- Trailing slot: rendered per non-self entry via `renderRowTrailing`.
  Dashboard passes a per-recipient `NudgeButton` keyed by `userId`.
  At N = 7 this means up to 6 nudge buttons render in the list — a
  per-recipient action that is already room-cap-bounded.
- Layout: a single-column stack with the same `flex flex-col gap-3`
  spacing as `HeadToHeadCard`. The list scrolls naturally with the
  Dashboard page; we do NOT introduce a horizontal carousel, nested
  scroller, or virtualisation (max N = 7 rows is fine on a mobile
  viewport, ~80 px per row).
- Solo creator (N = 1, `entries.length === 1`, only the caller):
  show only the caller's row and below it an info line styled as
  `text-xs text-ink-muted` using `copy.dashboard.invitePartnerHint`
  (existing copy if present, otherwise new — see §8). No leader
  badge, no tied label.

Behavioural parity with today at N = 2:
- Same sort: `saved desc`, then alphabetical on display name (this
  is what `HeadToHeadCard.tsx:36-39` does internally; the new list
  expects the caller to pre-sort). The Dashboard sorts before
  passing — see §4.2.
- Same leader crown via `PlayerProgressRow`'s `isLeader` prop.
- Same `gapLabel` semantics and copy.
- Same "your row" highlight via `isYou` → border styling already in
  `PlayerProgressRow.tsx:73-76`.

### 4.2 Dashboard wiring changes

In `src/pages/Dashboard.tsx`:

**Remove**:
- `import { HeadToHeadCard }` (and the corresponding `<HeadToHeadCard ... />`
  block at lines 520–533).
- `const partnerEntry = leaderboard.entries.find(...)` (line 134) and
  every subsequent read of `partnerEntry`. Replace via the new
  helpers below.
- `const { buckets: partnerBuckets } = data.partnerBuckets;` (line
  135). All consumers must read from `data.roomMembersBuckets`.

**Add**:
- `import { RoomLeaderboardList }` from
  `../components/RoomLeaderboardList/RoomLeaderboardList`.
- A derived `otherEntries`: `leaderboard.entries.filter(e => !e.isYou)`
  ordered by leaderboard's existing sort (already `saved desc`,
  then name asc).
- A derived `sortedEntries`: leader-first, used by
  `RoomLeaderboardList`. Sort is `[...leaderboard.entries].sort(...)`
  with the same comparator as today's `HeadToHeadCard.tsx:36-39`
  (already what `useLeaderboard` returns; we re-sort defensively
  because we want a stable visual order independent of any future
  leaderboard sort tweak).
- A `firstOtherMemberByJoinedAt: string | null` derived from
  `data.otherMemberIds.memberIds[0] ?? null`. This is the
  **deterministic** source for the legacy single-partner chart
  props (MomentumChart, BucketSheet trendPreview). At N = 2 it
  equals today's `partnerEntry.userId`; at N ≥ 3 it picks the
  earliest-joined other member.
- A `firstOtherEntry: PlayerProgressEntry | null` derived from
  `leaderboard.entries.find(e => e.userId === firstOtherMemberByJoinedAt)`.
  Used to source the chart's `partnerName` label so the label and
  series always agree.
- A per-member buckets map view: build
  `otherMemberBucketGroups: Array<{ userId; name; items: BucketGridItem[] }>`
  from `data.roomMembersBuckets.bucketsByUser` joined with
  `leaderboard.entries` for the display name. Order is by
  `data.otherMemberIds.memberIds` (`joined_at asc`) — stable across
  re-renders unlike leaderboard rank. A member with zero buckets is
  filtered out of the groups (the tab disappears, matching today's
  behaviour where the partner segment is hidden if
  `hasPartnerBuckets` is false).

**Replace the buckets section** (Dashboard.tsx lines 574–629):
- Bucket view state becomes
  `const [bucketView, setBucketView] = useState<'mine' | string /* userId */>('mine');`.
- Segmented options:
  `[{ value: 'mine', label: d.youLabel }, ...otherMemberBucketGroups.map(g => ({ value: g.userId, label: g.name }))]`.
- The Segmented is hidden when `otherMemberBucketGroups.length === 0`
  (matches today's `hasPartnerBuckets` gate).
- When `bucketView === 'mine'`, render the existing own-`BucketGrid`
  block unchanged.
- When `bucketView === <userId>`, render a `BucketGrid` whose title
  is `d.yourBuckets(<name>)` (existing copy) and `subtitle` is
  `d.bucketCount(items.length) + ' — ' + d.bucketReadOnly`. Items
  come from the matching `otherMemberBucketGroups[i].items`. No
  add button; rows are read-only.
- When the previously selected `bucketView` user leaves the room
  mid-session (or otherwise drops out of `otherMemberBucketGroups`),
  fall back to `'mine'`. This is enforced by an effect that resets
  `bucketView` to `'mine'` whenever
  `!otherMemberBucketGroups.some(g => g.userId === bucketView)` and
  `bucketView !== 'mine'`. This also resets `expandedBucketId`.

**Replace the goal-edit bucket-floor calculation**
(`Dashboard.tsx:219–220` and downstream):
- `bucketTargetTotal` (own) stays.
- New: `othersBucketTotalByUser: Record<string, number>` =
  `Object.fromEntries(otherMemberIds.memberIds.map(id => [id, sumTargets(bucketsByUser[id] ?? [])]))`.
- New: `highestOtherMemberAllocated = max(0, ...Object.values(othersBucketTotalByUser))`.
- New: `highestBucketTotal = Math.max(bucketTargetTotal, highestOtherMemberAllocated)`.
  At N = 2 with one partner this equals today's
  `Math.max(bucketTargetTotal, partnerBucketTotal)`.
- `GoalTargetSummary`'s `partnerAllocated` prop becomes
  `highestOtherMemberAllocated > bucketTargetTotal ? highestOtherMemberAllocated : null`.
  At N = 2 this is the same value as today. Copy unchanged in this
  task (label still says "partner" — copy cleanup is S6).

**Replace the leaderboard render** (`Dashboard.tsx:520–533`):
```
<motion.div variants={sectionVariants}>
  <RoomLeaderboardList
    entries={sortedEntries.map(toPlayerProgressEntry)}
    renderRowTrailing={(entry) =>
      !entry.isYou ? (
        <NudgeButton
          partnerUserId={entry.userId}
          roomId={activeRoomId}
          partnerName={entry.name}
        />
      ) : null
    }
  />
</motion.div>
```

**Chart `partnerSeries` swap** (`Dashboard.tsx:633–643`,
`Dashboard.tsx:815–820`):
- Replace `partnerEntry` reads with `firstOtherEntry` and
  `firstOtherMemberByJoinedAt`. At N = 2 this is identical to
  today's behaviour. At N ≥ 3 the chart compares the caller against
  the earliest-joined other member (deterministic). The
  `BucketSheet.trendPreview.theirLabel` becomes
  `firstOtherEntry?.name ?? copy.addMoney.partnerLabel`.
- The conditional gate `if (... partnerEntry)` becomes
  `if (... firstOtherMemberByJoinedAt)`.

### 4.3 Other-members' bucket section: per-member grouping

The bucket section already lives behind a Segmented control today
("mine" vs "partner"). The minimal evolution:

- Each "other" entry in the Segmented carries the member's display
  name. With 7 members the Segmented at 375 px would overflow; the
  `Segmented` component already supports horizontal scroll/overflow
  via its own internals (verify by inspecting the component before
  implementation — if it does not, an `overflow-x-auto` wrapper is
  added in this task. No new component; just a wrapper `div` with
  `flex` + `overflow-x-auto` + `gap-2`).
- Selecting a member's tab swaps the `BucketGrid` to read-only mode
  with that member's items, sorted by `position asc` (already done
  upstream in `useRoomMembersBuckets`).
- A member with zero buckets does not get a tab. If all other
  members have zero buckets, the Segmented is hidden entirely and
  the layout matches today's solo-buckets layout.
- At N = 2 with one partner who has buckets, the segmented control
  shows exactly two tabs ("You", partner-name) — visually
  indistinguishable from today's `'mine' | 'partner'` segmented
  control.

### 4.4 What is **not** changing on Dashboard

- `TotalVaultCard`: already reads
  `leaderboard.entries.reduce((sum, e) => sum + e.saved, 0)` and the
  same for targets. N-safe by construction. The `partner_label` is
  not used here. No change.
- `SavingPlanCard`: reads only `data.savingPlan` (the caller's own
  plan) and the embedded Verified Balance slot. No other-member
  data. No change.
- `ActivityTimelineRow` and `mergedActivity`: actor name comes from
  `log.display_name` (server-supplied per row). N-safe by
  construction. No change.
- The Verified Balance reminder modal, goal-edit modal, goal-request
  modal, `BucketSheet`, `OutcomeModal`: no other-member state.

## 5. SavingPlan / member detail / saving-plan-grouped-by-member

Per the task brief item 5 — "Show other members' saving plans
grouped by member, if currently surfaced" — the Dashboard does NOT
currently surface other members' saving plans. The only place that
does is `/saving-plan` (the page with the Mine/Partner segmented
control). That page is audit slice S5 and is a separate task.

This task does NOT add an "other members' saving plans" block to
the Dashboard. Doing so would expand the surface area beyond what
exists today and conflict with the task brief's instruction to
preserve 2-user behaviour visually.

(Note: the Task 32 `data.roomMembersSavingPlans` field is still
imported by `Dashboard.tsx` transitively via `useSharedData` — no
explicit read is added by this task. It remains available for the
S5 task.)

## 6. Member detail navigation

Out of scope. The new `RoomLeaderboardList` rows are **not** made
tappable in this task. The leaderboard list and per-row layout are
chosen so that adding `onPress`/`onClick` later (Feature 3 / Task 34)
is a one-prop addition, but the cursor stays default and rows
remain non-interactive except for the `NudgeButton` trailing slot.

The task brief is explicit: "Do not add member detail navigation
yet unless the existing plan says it belongs here. Member detail is
a later task." The plan does not say it belongs here; it belongs in
Feature 3.

## 7. Loading, error, and empty states

Each new surface mirrors today's loading shape so the page-level
`if (loading) return <DashboardSkeleton />` gate at
`Dashboard.tsx:189` keeps working unchanged. Inside that gate,
finer states are added per surface.

### 7.1 `RoomLeaderboardList`

- Loading: covered by `leaderboard.loading`, which is already part
  of the Dashboard page-level loading flag. No per-list spinner.
- Error: `leaderboard.error` is already part of the page-level
  `error` check at `Dashboard.tsx:190`. No per-list error UI.
- Empty (solo creator, N = 1): render just the caller's row plus
  the `copy.dashboard.invitePartnerHint` line (see §8). No leader
  badge, no `gapLabel`.
- Tied (top two equal saved): no leader crown, leader's `gapLabel`
  says `copy.dashboard.tied` (matches today).

### 7.2 Per-member buckets section

- Loading: `data.roomMembersBuckets.loading === true` ⇒ when the
  user is on a member's tab, show a small inline skeleton (`<div
  className="grid grid-cols-2 gap-4">` with two `Skeleton` cells)
  — mirrors the existing bucket-grid skeleton at N = 2. Reuse the
  existing `Skeleton` component already imported.
- Error: `useRoomMembersBuckets` exposes no `error` field (matches
  `UsePartnerBucketsResult`); on internal fetch failure it logs to
  console and returns empty maps. The on-screen result is the same
  as the empty state below. No new toast or banner is added.
- Empty (selected member has no buckets): can't happen because
  `otherMemberBucketGroups` excludes zero-bucket members and resets
  `bucketView` to `'mine'` if the selection drops out (§4.2).
- Empty (no other members have buckets): Segmented is hidden;
  Dashboard shows only the caller's `BucketGrid`. Same as today's
  fallback.

### 7.3 Goal-edit floor calculation

If `data.roomMembersBuckets.loading === true` and the user opens
the goal-edit modal, the floor warning uses the most-recent resolved
value of `highestOtherMemberAllocated` (default 0 on first mount).
This matches today's behaviour at N = 2 where `partnerBuckets` may
be empty on first mount. No additional spinner; the goal-edit modal
already validates on save.

### 7.4 Network/state failure cascade

If `useRoomOtherMemberIds` fails both its direct select and the
`room_members_for_room` RPC fallback (per the §6.1 contract of Task
32 plan), `data.otherMemberIds.memberIds` is `[]`. The Dashboard
then renders the solo-creator layout (one leaderboard row, no
buckets segmented control). This is the same degrade path that
already exists today (no `partnerEntry` ⇒ no `HeadToHeadCard`
right-player ⇒ today's empty-partner branch). The new layout
behaves the same.

## 8. i18n / copy changes

Minimum-feasible copy additions. All other "partner" strings stay.

New keys (English and Thai, both files):

- `copy.dashboard.invitePartnerHint` — short body (≤ 60 chars) used
  by `RoomLeaderboardList` in the solo-creator (N = 1) empty state.
  EN suggestion: "Invite someone to start the race."
  TH suggestion: "ชวนเพื่อนเข้ามาเพื่อเริ่มการแข่งขัน"

No other new strings. Reuse:
- `d.progressRace` (heading).
- `d.tied`, `d.leadingBy(...)` (gap labels).
- `d.youLabel` (Segmented "You" tab label).
- `d.yourBuckets(name)`, `d.bucketCount(n)`, `d.bucketReadOnly`
  (per-member bucket grid title/subtitle).
- `d.membersInRoom(n)` (header members count — already plural-safe).
- `d.partnerLabel` is still used by the chart `partnerName` prop
  (the chart legend) and by the goal-request copy. Not reworded.

No changes to existing strings. Copy cleanup ("partner" → "members")
across the app is audit slice S6.

## 9. Responsive / mobile behaviour

Target: 375 px viewport (iPhone SE width).

- Header (`Dashboard.tsx:487-508`) — already responsive (1-line
  truncated project name, members-count line). No change.
- `TotalVaultCard` — unchanged.
- `RoomLeaderboardList`:
  - At N = 2: two rows stacked, visually identical to today's
    `HeadToHeadCard` stacked layout (which already uses
    `flex flex-col gap-3`).
  - At N = 3 to N = 5: three to five rows stack vertically. Page
    height grows linearly; no horizontal scroll.
  - At N = 6 to N = 7: same as above — page height continues to
    grow. The trailing nudge button on each non-self row is the
    only horizontal element; it already fits within the row's
    flex layout via the existing `PlayerProgressRow` trailing slot.
- Bucket Segmented at N ≥ 5: the Segmented row may overflow
  horizontally. We wrap the Segmented in
  `<div class="-mx-2 px-2 overflow-x-auto">` (matches existing
  scroll affordance pattern elsewhere in the app — verify before
  reusing). This keeps the visible Segmented unchanged at N = 2 (no
  overflow triggered) and adds a horizontal scroll only when needed.
- `MomentumChart` and (hidden) `SavingRaceSection` — single
  "yours vs theirs" series, same dimensions as today.
- `BucketSheet` trend preview — same single "yours vs theirs"
  layout.

`prefers-reduced-motion` is respected because the new
`RoomLeaderboardList` reuses `PlayerProgressRow` and the same
section-level Framer Motion variants already in `Dashboard.tsx`.
No new motion is introduced.

## 10. Acceptance criteria

For the current 2-user behaviour (the only behaviour exercised in
production):

- The Dashboard renders exactly two leaderboard rows (caller +
  partner), in the same `saved desc, name asc` order as today.
- The leader carries the same crown badge and the same
  `leadingBy(gap)` / `tied` gap label as today.
- The caller's row carries the same brand-bordered highlight.
- The bucket Segmented shows exactly two tabs ("You", partner-name)
  when the partner has at least one bucket, and is hidden otherwise.
- Bucket items in the partner tab are byte-for-byte identical to
  today's partner-bucket grid (same items, same sort, same
  read-only label).
- `partnerBucketTotal` (now derived from
  `data.roomMembersBuckets.bucketsByUser[partnerId]`) equals
  today's value. The goal-edit floor warning fires for the same
  amounts as today.
- The `MomentumChart` partner-series and `BucketSheet`
  trend-preview look identical to today (same partner name, same
  series).
- `NudgeButton` appears once, on the partner row, and sends one
  nudge to the partner — same as today.
- No new console warnings or errors during Dashboard mount, route
  change, or room switch.

For the future N-user case (reasoned only — production cap remains
2):

- At N = 3 (created in a local dev DB by bypassing the trigger),
  the Dashboard renders three leaderboard rows in correct sort
  order. Two `NudgeButton` instances appear on the two non-self
  rows.
- At N = 3, the bucket Segmented shows up to 3 tabs (yours + 2
  others), only including other members with at least one bucket.
- At N = 3, the goal-edit floor warning considers the maximum of
  caller / other-1 / other-2 bucket totals.
- At N = 7, the leaderboard renders seven rows. The Segmented may
  scroll horizontally on a 375 px viewport. Up to six nudge
  buttons render (one per non-self row).
- At N = 1 (solo creator), only the caller's row renders with no
  leader crown and the new `invitePartnerHint` info line beneath.
- `data.roomMembersBuckets.allBuckets` matches the concatenation of
  every other member's buckets (used wherever the legacy code did
  `[...buckets, ...partnerBuckets]` — currently only in
  `SavingRaceSection`'s `buckets` prop at `Dashboard.tsx:647`,
  which is rendered behind the `SHOW_DEPOSIT_RACE` flag and is
  exercised in QA only when that flag flips).

## 11. Implementation steps

Order chosen so each step is independently verifiable. **Strict
rule**: every step compiles and renders correctly at N = 2 in a
local dev session before moving to the next.

1. **Build `RoomLeaderboardList`.**
   - New file:
     `src/components/RoomLeaderboardList/RoomLeaderboardList.tsx`.
   - Reuse `PlayerProgressRow` for each row.
   - Implement the leader / tied / gap-label / `isYou` logic the
     same way `HeadToHeadCard` does today (sort defensively, derive
     `tied` and `gap`, mark `entries[0]` as leader when not tied).
   - Smoke test (story-style) by mounting with two hard-coded
     entries and verifying visual parity against the existing
     Dashboard.

2. **Wire the new list into Dashboard, behind a thin local
   compile-checked switch.**
   - Add `import { RoomLeaderboardList } from ...;`
   - Build `sortedEntries` and a `toPlayerProgressEntry` mapper.
   - Replace the `<HeadToHeadCard ... />` block with
     `<RoomLeaderboardList ... />`.
   - Keep `data.partnerBuckets` reads in place for now — the buckets
     section is rewritten in step 3.
   - `npm run build` checkpoint.
   - Visual QA at N = 2: leaderboard renders identically.

3. **Replace `data.partnerBuckets` reads in Dashboard with
   `data.roomMembersBuckets`.**
   - Drop the `const { buckets: partnerBuckets } = data.partnerBuckets;`
     line.
   - Add the `otherMemberBucketGroups` derivation and the
     `othersBucketTotalByUser` map.
   - Rewrite the Segmented + `BucketGrid` block to per-member tabs
     (§4.2 / §4.3).
   - Update `GoalTargetSummary`'s `partnerAllocated` prop to
     `highestOtherMemberAllocated`.
   - Add the effect that resets `bucketView` to `'mine'` when the
     selected member is no longer in `otherMemberBucketGroups`.
   - `npm run build` checkpoint.
   - Visual QA at N = 2: bucket Segmented behaves identically.

4. **Switch chart and bucket-sheet `partner*` sources from
   `partnerEntry` to `firstOtherMemberByJoinedAt` /
   `firstOtherEntry`.**
   - Add the two derivations near the top of `Dashboard()`.
   - Update `MomentumChart` props (`partnerSeries`, `partnerName`).
   - Update `SavingRaceSection` props (only matters when
     `SHOW_DEPOSIT_RACE` flips, but make the change for
     consistency).
   - Update `BucketSheet.trendPreview.theirLabel` and
     `trendPreview.theirSeries`.
   - At N = 2 the values are identical to today.

5. **Remove the now-dead `partnerEntry` derivation and any unused
   imports.**
   - Drop `const partnerEntry = leaderboard.entries.find(...)`.
   - Drop the unused `HeadToHeadCard` import.
   - `npm run build` and `npm run lint` should both pass with no
     new warnings.

6. **Add `copy.dashboard.invitePartnerHint`.**
   - Add the key + EN + TH translations in `src/i18n/locales/*`.
   - Wire it into `RoomLeaderboardList`'s solo-creator branch.

7. **Manual QA per §13.** Do not skip the dev-DB 3-member
   verification step.

8. **Report**: changed files, checks run, the §13 QA outcomes,
   risks observed, and the deferred follow-ups already filed in
   the audit doc.

Strict scope: the diff for this task must touch only:
- `src/pages/Dashboard.tsx`,
- `src/components/RoomLeaderboardList/RoomLeaderboardList.tsx`
  (new),
- `src/i18n/locales/en.ts`, `src/i18n/locales/th.ts` (one new key),
- `src/components/HeadToHeadCard/HeadToHeadCard.tsx` (untouched —
  unused but kept).

If a touch outside this list looks necessary (e.g. a Segmented
component refactor to enable horizontal scroll, or a copy change in
another locale namespace), stop and re-plan rather than expanding
the diff silently.

## 12. Risk level

**Medium.**

- `Dashboard.tsx` is the most-touched UI surface in the app. Even
  a small regression in the leaderboard, bucket section, or
  goal-edit floor is immediately visible to every user.
- The wrapper-only Task 32 design guarantees the underlying data
  is correct at N = 2; the failure mode for this task is purely
  visual / structural (wrong sort, wrong tab, missing crown, broken
  layout).
- The chart `partner*` source change (step 4) is a behaviour
  change at N ≥ 3 (deterministic `joined_at asc` vs leaderboard
  rank) but is identical to today at N = 2. Documented as a known
  limitation for S6 to revisit.
- The bucket Segmented overflow at N ≥ 5 has not been visually
  exercised before. The `overflow-x-auto` wrapper is the
  lowest-risk approach; if the `Segmented` component already
  supports overflow it is a no-op.
- `RoomLeaderboardList` is new but uses only the existing
  `PlayerProgressRow`. It is a thin shell; the risk is in the
  re-sort + tied + gap-label logic, which mirrors
  `HeadToHeadCard.tsx:34-39` byte-for-byte.

Specific failure modes to watch for in review:

- An off-by-one in `sortedEntries.map(toPlayerProgressEntry)`
  causing the caller's row to lose its `isYou=true` highlight at
  N ≥ 3 (because the sort moved them out of position). Mitigation:
  the mapper reads `entry.isYou` from the leaderboard's entry; do
  not rely on array index.
- A leaked `partnerBuckets` reference after the rewrite. Mitigation:
  `npm run lint` flags unused imports / unused destructures, and
  the audit doc explicitly lists every line to remove (§3).
- `bucketView` reset effect causing an infinite re-render if the
  effect's dependency list includes `bucketView` itself and writes
  it unconditionally. Mitigation: the effect guards
  `bucketView !== 'mine'` AND the missing-id check before calling
  `setBucketView('mine')`.
- The Segmented value being a `userId` string would silently match
  if a member id ever equals `'mine'` (impossible — userIds are
  UUIDs). Defensive note for the reviewer.

## 13. Manual QA — 2-user (regression), 3-user (reasoned), 7-user (reasoned)

### 13.1 Two-user room (production behaviour)

Setup: an existing 2-user room with caller A and partner B, both
having ≥ 2 buckets and at least one saving log. A is the room
creator.

- [ ] Dashboard loads. Header shows project name + "2 members".
- [ ] `TotalVaultCard` shows `sum(A.saved, B.saved)` over
      `sum(A.target, B.target)`. Values match the pre-task
      Dashboard.
- [ ] Leaderboard renders exactly 2 rows. Whoever has more saved
      is on top with the crown; the other has no crown.
- [ ] Gap label on the leader's row reads
      "Leading by ฿X" (or "Tied" if equal). Matches today.
- [ ] Caller's row has the brand-bordered highlight.
- [ ] `NudgeButton` is rendered exactly once, on B's row. Tapping
      sends one nudge to B.
- [ ] Bucket Segmented shows two tabs: "You" and B's display
      name. Tap to B → buckets list matches today's partner-bucket
      grid (same names, same totals, same `position asc` order).
      Tap back to "You" → caller's `BucketGrid` is unchanged with
      its add-bucket button and click-to-deposit row behaviour.
- [ ] Open goal-edit modal. The "highest bucket allocation" floor
      validates against `max(A.bucketTotal, B.bucketTotal)`.
      Setting the goal below that value shows today's error copy.
- [ ] `GoalTargetSummary` shows the same "partner allocated" line
      as today when B has > A's bucket total.
- [ ] `MomentumChart` shows two series: A and B, identical to
      today.
- [ ] Activity feed: top 3 rows merged from deposits + balance
      checks, identical to today.
- [ ] Saving Plan card and Verified Balance slot: unchanged.
- [ ] Switch to a different room via the room switcher. The
      leaderboard and per-member bucket tabs reset cleanly; no
      stale partner bucket flash.
- [ ] `npm run build` passes.
- [ ] `npm run lint` passes with no new warnings.

### 13.2 Reasoned three-user verification (local dev DB only)

Setup: in a local dev DB, bypass the cap trigger to add a third
member C. Do **not** run this against staging or production.

- [ ] Leaderboard renders 3 rows in `saved desc, name asc` order.
      Leader has the crown; runner-up's "Leading by" label is
      relative to the leader.
- [ ] Two `NudgeButton`s render — one on B's row, one on C's row.
      Each sends a nudge to the right recipient.
- [ ] Bucket Segmented shows up to 3 tabs (caller + up to 2
      others). Each other-member tab swaps the grid to that
      member's buckets in `position asc` order. No add button on
      other-member tabs.
- [ ] If C has zero buckets, C's tab is hidden. If B and C both
      have zero buckets, the Segmented is hidden entirely.
- [ ] `othersBucketTotalByUser` includes both B's and C's totals.
      The goal-edit floor warning fires at `max(A, B, C)` of
      bucket-target totals.
- [ ] `MomentumChart` partner series is the earliest-joined other
      member (`firstOtherMemberByJoinedAt`). Verify by computing
      `joined_at` for B and C in the DB.
- [ ] Switch `bucketView` to C's tab. Then remove C from the room
      (delete the `room_members` row in the dev DB). The
      Dashboard's effect resets `bucketView` to `'mine'` and the
      tab disappears.
- [ ] Solo-creator state: in a 1-member room (only A), the
      leaderboard renders only A's row + the
      `invitePartnerHint` body. No leader crown. No
      `NudgeButton`. Bucket Segmented is hidden. Goal-edit floor
      considers only A's bucket total.

### 13.3 Reasoned seven-user verification (local dev DB only)

Setup: in a local dev DB, add 6 more members (B through G).

- [ ] Leaderboard renders 7 rows. Sort is `saved desc, name asc`.
      Page height grows; the existing page-level scroll handles
      it. No horizontal scroll within the list.
- [ ] Six `NudgeButton`s render, one per non-self row.
- [ ] Bucket Segmented shows up to 7 tabs. On a 375 px viewport
      the Segmented row scrolls horizontally without breaking the
      page width. Vertical layout unaffected.
- [ ] Each tab swaps the grid correctly. Selecting a tab and then
      switching rooms resets `bucketView` to `'mine'` on the new
      room.
- [ ] `data.roomMembersBuckets.allBuckets.length` equals the sum
      of all 6 other members' bucket arrays.
- [ ] Goal-edit floor considers the max bucket-total across all 7
      members.

### 13.4 Empty / loading / error

- [ ] On Dashboard mount, the page-level skeleton renders during
      the initial leaderboard/buckets fetch. After data resolves,
      the leaderboard and Segmented appear with no flicker.
- [ ] Force a `useRoomMembersBuckets` failure (DevTools forced 500
      on the `buckets` request) on a room switch. The previous
      room's data does NOT remain visible. The new room's bucket
      Segmented either shows fewer tabs or is hidden, consistent
      with the failure → empty contract from Task 32.
- [ ] Force a `useRoomOtherMemberIds` failure on both the direct
      select and the RPC fallback. The Dashboard falls back to
      the solo-creator layout (one leaderboard row, no Segmented).
      A console warning is emitted. No uncaught error.
- [ ] Sign out from the Dashboard. The auth redirect kicks in
      before any inconsistent N-aware data renders. (No new
      surface added that could be exposed signed out; the auth
      guard is upstream of the Dashboard.)

## 14. Rollback plan

Pure-frontend rollback. No SQL, no edge function, no migration.

- Revert the commit that introduced
  `RoomLeaderboardList.tsx` and the Dashboard rewiring.
- Revert `Dashboard.tsx` to its pre-task body (restores the
  `partnerEntry` derivation, the `data.partnerBuckets` reads, the
  `'mine' | 'partner'` Segmented, and the `<HeadToHeadCard />`
  block).
- Revert the new `copy.dashboard.invitePartnerHint` key in both
  locale files. (Leaving them in place would be harmless but
  noisy.)
- `HeadToHeadCard.tsx` and `PlayerProgressRow.tsx` were never
  edited; no revert needed there.

The wrapper-first Task 32 design means `data.partnerBuckets` and
`data.partnerSavingPlan` still resolve to today's values after a
rollback — no downstream surface breaks.

No data, no schema, no realtime, no notification, no money-state
surface is touched, so there is no risk of data loss or partial
rollback state.

## 15. Risks and follow-ups (filed for next slices)

- **Chart partner-series selection at N ≥ 3.** Today this task
  picks `firstOtherMemberByJoinedAt`, a deterministic choice but
  not necessarily the most product-meaningful one. The audit
  (`§7`, charts row) lists this as Medium risk and a S6 concern.
  Possible resolutions: (a) aggregate "everyone else" into one
  series; (b) let the user pick which other member to compare;
  (c) drop the comparison series in N ≥ 3 rooms. Decide in S6.

- **Bucket Segmented at high N on tiny viewports.** With 7 tabs
  on a 375 px screen the horizontal-scroll Segmented works but is
  not delightful. Filed for a potential redesign (e.g. dropdown
  picker) in S6.

- **`useLogs(100)` cap.** Pre-existing; with 7 members on a busy
  day, deposits could overflow the 100-row cap and under-count the
  `TotalVaultCard` sum. Out of scope for this task; the audit
  files it as a blocker for the cap-raise slice (S1), not for the
  UI slice.

- **Member detail navigation.** Tapping a leaderboard row is a
  no-op in this task. Feature 3 / Task 34 will add the
  `/members/:userId` route. The current row layout (Avatar + name +
  saved/target + progress + optional trailing slot) is already a
  natural tap target; the addition is a single `onClick` prop on
  `PlayerProgressRow` or a wrapping `Pressable`.

- **Copy cleanup ("partner" → "members").** Out of scope. S6.

- **Saving plans grouped by member on Dashboard.** Not surfaced
  today; not added here per task brief item 5. The `/saving-plan`
  page rework (Mine/Partner segmented control → N-member view) is
  audit slice S5 / a separate task.

- **`HeadToHeadCard` cleanup.** After this task lands, the
  component is dead code on the Dashboard. Whether to delete the
  file or keep it for the 2-user demo / history is decided after
  the new list is in production for a release. Default: keep in
  git history but stop importing.
