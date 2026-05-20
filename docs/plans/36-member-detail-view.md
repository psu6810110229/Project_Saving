# Task 36 — Member Detail View (read-only per-member drill-in)

Status: Planning only. No code, migrations, or file edits in this
document.
Owner: Senior FE/FS pair (Claude) with Fran.
Source:
- `docs/multi-user-room-feature-plan.md` (Feature 3 only)
- `docs/plans/feature-2-multi-user-rooms-audit.md`
- `docs/plans/32-multi-user-data-hooks.md` and the
  `feat: N-safe room/member data hooks (Task 32)` commit
- `docs/plans/33-multi-user-dashboard-ui.md` and the
  `feat(dashboard): N-aware Progress Race + per-member buckets
  (Task 33)` commit
- `docs/plans/34-manage-project-member-list.md` and the
  `feat(manage-project): show room member list (Task 34)` commit
- `src/App.tsx` (route table)
- `src/pages/Dashboard.tsx` (leaderboard row callsite)
- `src/components/RoomLeaderboardList/RoomLeaderboardList.tsx`
- `src/components/PlayerProgressRow/PlayerProgressRow.tsx`
- `src/components/RoomMemberRow/RoomMemberRow.tsx`
- `src/hooks/useRoomOtherMemberIds.ts`,
  `src/hooks/useRoomMembersBuckets.ts`,
  `src/hooks/useRoomMembersSavingPlans.ts`
- `src/hooks/useRoomMembers.ts` (page-local in `ManageProject.tsx`
  today; see §4.4 for promotion decision)
- `src/hooks/useLeaderboard.ts`
- `src/components/SavingPlanCard/SavingPlanCard.tsx`
- `src/components/BucketGrid/BucketGrid.tsx`
- `src/components/Avatar/Avatar.tsx`
Date drafted: 2026-05-20.

This task is the Feature 3 slice. It adds a dedicated read-only page
that surfaces another room member's public information: profile
(name, avatar, theme), personal goal (today's
`goals.target_amount`, unchanged by this task), recorded-deposits
total, saving plan summary, and bucket list. Tapping a member from
the Dashboard leaderboard navigates into this page. The page strictly
hides everything personal: Verified Balance, Reconcile data, balance
adjustments / checkpoints, private notes, storage breakdowns, push
subscriptions, notification preferences, and raw email.

Two-user behaviour stays visually intact: today's Dashboard
continues to render an N-aware leaderboard from Task 33; the only
additive change is making leaderboard rows tappable (self routes to
`/profile`, other members route to `/members/:userId`) and
registering the new `/members/:userId` route. This task is
cap-agnostic. Task 35 already owns room capacity, and Task 36 must
not touch `join_room_by_code`, `enforce_room_capacity`,
`room_members` writes, or any cap logic. Per-member sub-goal
semantics belong to Feature 5 and are out of scope.

---

## 1. Goal

- Add a new authenticated route `/members/:userId` that renders a
  member's read-only detail page.
- Show, for the targeted member: avatar, display name, theme accent,
  recorded-deposits total, personal goal target (`goals.target_amount`
  as it exists today), and a progress bar built from those two
  numbers; a read-only Saving Plan summary; a read-only bucket list.
- Add a client-side guard: the viewer must be in the same active
  room as the target user. Non-members get a forbidden / empty
  state. The RLS layer already enforces the same thing at the data
  level (migrations 0019 / 0047 / 0016), so guessing the URL leaks
  no rows; the client guard is for the **UX shape** of the failure,
  not for security.
- Make Dashboard leaderboard rows tappable: tapping a non-self row
  routes to `/members/:userId`; tapping the caller's own row routes
  to `/profile` (today's Profile page already shows the caller's own
  data; adding a self-tap deep-link is the lowest-friction way to
  keep the affordance consistent across all rows). See final
  Decision A in §6.
- Reuse `SavingPlanCard` and `BucketGrid` in a read-only mode. The
  read-only mode is achieved by **omitting interactive callbacks**
  (`onConfigure`, `onAddBucket`, `onBucketClick`), not by adding a
  new `readOnly` boolean. `SavingPlanCard.onConfigure` becomes
  optional per final Decision D.
- Ship explicit loading / error / forbidden / empty states.
- Ship EN + TH copy for every new string.
- Preserve every other surface of the app exactly: no Dashboard
  layout rewrite beyond making rows tappable, no goal semantics
  change, no Reconcile / Verified Balance exposure, no notification
  fan-out edits, no cap edits.

## 2. Non-goals (do not touch)

The following are explicitly out of scope and must not be touched in
this task:

- **Room cap.** The trigger `enforce_room_capacity` /
  `enforce_two_player_cap`, the RPC `join_room_by_code`, all
  `room_members` writes, and all cap logic remain exactly as they
  are. This task is cap-agnostic; Task 35 already owns room
  capacity.
- **`join_room_by_code`.** No signature change, no error code
  change, no SQL touch.
- **Goals / sub-goals (Feature 5).** `goals.target_amount` semantics
  remain whatever they are at the time of merge. The member detail
  page reads `target_amount` as a personal target and labels it as
  such (see §9 for copy decisions). When Feature 5 lands the same
  field will already mean "personal sub-goal" and the page will be
  semantically correct without a follow-up edit.
- **Verified Balance, Reconcile, balance checkpoints, balance
  adjustments, private storage notes.** None of these are read or
  rendered. They are the canonical "never shown to others" list
  inside `CLAUDE.md`'s money-state rules.
- **Notification preferences / push subscriptions / raw email.**
  Never shown.
- **Notification fan-out (Task 31).** No `notify_*` RPC,
  `_smart_check_*`, `notify-partner-deposit`, or push-related code
  changes. Visiting the page does **not** generate any notification
  (per Feature 3 brief).
- **Nudge button.** The audit's Feature 3 brief includes a "Nudge"
  button at the bottom. Per the task brief in this doc — "Do not
  expose verified balance / reconcile / balance checkpoints / private
  notes" only, with no mention of nudge — and to keep the slice
  focused, the nudge button is **not** added in this task. The
  Dashboard leaderboard's per-row `NudgeButton` (Task 33) already
  provides the nudge surface. Filed in §13 as a follow-up.
- **Dashboard layout rewrite.** The only Dashboard edit is making
  `RoomLeaderboardList` rows tappable. The card layout, sort,
  Segmented control, charts, totals, gap label, leader crown, and
  Saving Plan / Verified Balance island are all untouched.
- **`RoomMemberRow`'s interactivity.** Manage Project's Members
  section (Task 34) keeps the row non-interactive in v1. Whether to
  make `RoomMemberRow` tappable is left for a Manage-Project polish
  task. See §6 / Decision B.
- **New SQL migration, new RLS policy, new RPC, new edge function.**
  Every read uses existing RLS-bound selects (RLS already enforces
  co-member visibility on `goals`, `buckets`, `saving_plans`,
  `saving_plan_revisions`, `saving_plan_pauses`).
- **Saving plan pauses RLS check.** The audit notes a verification:
  confirm `saving_plan_pauses` is co-member readable. Migration 0047
  already extends co-member visibility to the pause table; this task
  does **not** add a new migration even if the verification surfaces
  a gap. Any RLS gap would be filed as a sub-task and addressed by
  the SQL-owning slice. The page degrades by showing an empty paused
  section if the read returns no rows.
- **Realtime subscriptions.** No new realtime channels. The page is
  re-fetched on navigation; mid-page realtime is a §13 follow-up.
- **Member-list realtime.** Out of scope; same reasoning as Task 34.
- **i18n copy rewrites** outside the new strings required by §9.
  The word "partner" stays everywhere it appears today (audit S6).
- **Removing or renaming any existing hook, component, or route.**
  All public names stay.

## 3. Current state to extend

Sources: `src/App.tsx`, `src/pages/Dashboard.tsx`,
`src/components/RoomLeaderboardList/RoomLeaderboardList.tsx`, the
Task 32 hook layer, and the Task 34 member-list hook.

What exists today:

1. **Route table** in `src/App.tsx`. The protected `<AppLayout>`
   subtree contains `/dashboard`, `/add`, `/check-balance`,
   `/saving-plan`, `/profile`, `/manage-project`,
   `/archived-projects`, `/notifications`,
   `/notifications/settings`. Adding `/members/:userId` to this
   subtree is the one structural addition.
2. **Dashboard leaderboard.** Task 33's `RoomLeaderboardList` renders
   one `PlayerProgressRow` per entry. The component currently has
   no `onClick` per row; the `renderRowTrailing` slot is used by
   Dashboard to mount a `NudgeButton`. Rows are non-interactive
   today; Task 33 §6 explicitly lists "make rows tappable later" as
   a Feature 3 follow-up, which is this task.
3. **Hook layer (Task 32).** `useRoomOtherMemberIds`,
   `useRoomMembersBuckets`, `useRoomMembersSavingPlans` already
   expose plural per-member shapes via `DataContext`.
4. **Member metadata.** Task 34 introduced a page-local hook
   (`useRoomMembers`) inside `ManageProject.tsx` that calls
   `room_members_for_room(p_room_id)` (migration 0016) and returns
   `{ userId, displayName, avatarUrl, themeColor, joinedAt }` per
   member. This task **promotes that hook to its own file** so it
   can be reused by the member detail page without duplicating the
   logic — see §4.4 and Decision C.
5. **Goal data.** `goals.target_amount` is co-member readable via
   the `goals_member_select` RLS policy. There is no existing
   "fetch one member's goal" hook because today the only target the
   UI reads is the caller's own (or, derived from `useLeaderboard`,
   each member's `target` field). The audit confirms
   `useLeaderboard.entries[i].target` is already the per-member
   target.
6. **Reusable components.** `SavingPlanCard` and `BucketGrid` both
   accept optional callbacks (`onConfigure`, `onAddBucket`,
   `onBucketClick`). Omitting them produces a read-only render
   today; this is the design Task 36 leans on.

What does **not** exist today and this task adds:

- A `/members/:userId` route + a `MemberDetail` page.
- Tap-to-navigate on `RoomLeaderboardList` rows (forwarded via a
  new optional `onRowClick` prop, opt-in to preserve existing
  callsites and the Task-33 non-interactive contract).
- A small `useRoomMember(roomId, userId)` selector (or a derived
  read of `useRoomMembers(roomId).members.find(...)`) that lets
  the page resolve one member's metadata. See §4.4.

## 4. Route + data design

### 4.1 Route

Path: `/members/:userId`.

- Placement: inside the `<AppLayout>` protected subtree in
  `src/App.tsx`, immediately after `/manage-project`. This places
  it under the same auth guard (`ProtectedRoute`), gives it the
  `RoomProvider` / `I18nProvider` / `AuthProvider` chain for free,
  and lets it share the bottom-nav chrome / page transitions used by
  every other in-app page.
- URL pattern: `/members/:userId` where `:userId` is the target
  user's UUID. UUIDs only; we do not accept display names or any
  other identifier. The Dashboard tap handler passes
  `entry.userId` directly into `navigate(`/members/${userId}`)`.
- Self URL: `/members/<own-uuid>` is technically reachable by typing
  it in the address bar. The page handles this case by redirecting
  to `/profile` on mount (see §4.5). Self-tap from Dashboard goes
  directly to `/profile` without bouncing through `/members/`. See
  Decision A in §6.
- Bookmarkability: the route is bookmarkable — direct visits work
  as long as the visitor is signed in, in an active room, and a
  co-member of the target user in that active room. Otherwise the
  page resolves to the Forbidden / empty state (§4.6 / §7).
- Back behaviour: standard browser back. From Dashboard tap →
  Member Detail → back returns to Dashboard with scroll preserved
  (React Router's default scroll behaviour is sufficient for the
  app's existing pages; do not introduce a custom scroll restorer
  in this task).
- No nested routes. No tabs inside the page. The page is a single
  scrollable column matching the visual rhythm of `Dashboard.tsx`
  and `ManageProject.tsx`.

### 4.2 Data the page reads

Per the Feature 3 brief and the audit (§3 — "all required data is
already readable by room members via existing RLS"), the page
reads four streams. None are new fetches at the schema level; all
ride existing RLS policies or existing hooks.

| stream | source | shape | purpose |
| --- | --- | --- | --- |
| Member metadata | `useRoomMember(roomId, userId)` (new selector — §4.4) | `{ userId, displayName, avatarUrl, themeColor, joinedAt }` or `null` | Header: avatar + name + theme accent; "Member of <project>" subtitle |
| Recorded-deposits total + personal goal target | `useLeaderboard()` from `DataContext` (already mounted by `AppLayout`) | `entries.find(e => e.userId === userId)` → `{ saved, target, ... }` | Section 1: personal-goal progress bar (`saved / target`) |
| Saving plan summary | `data.roomMembersSavingPlans.plansByUser[userId]` (Task 32) | `SavingPlan \| null` | Section 2: `SavingPlanCard` read-only |
| Bucket list | `data.roomMembersBuckets.bucketsByUser[userId]` (Task 32) | `Bucket[]` | Section 3: `BucketGrid` read-only |

Important constraints:

- The leaderboard, room-members-buckets, and room-members-saving-plans
  hooks are already mounted by `DataContext` (Task 32) for every
  authenticated route under `<AppLayout>`. The Member Detail page
  consumes them through `useSharedData()` exactly like Dashboard
  does. No new fetch is issued for the buckets or plan when the
  caller arrived from Dashboard; the data is reused from
  `DataContext`. This matters for perceived speed (the audit's
  ≤ 300 ms tap-to-render target is met because the underlying data
  is already in memory).
- Direct URL visit (no prior Dashboard mount): `DataContext` mounts
  on the first protected route render and starts the fetches. The
  page renders its loading state until those resolve. This is the
  same behaviour any direct deep-link gets today.
- The hook from §4.4 is the one new call. It calls the existing
  `room_members_for_room` RPC; no new SQL.

### 4.3 Why no dedicated `useMemberSummary` aggregator hook

The audit floats `useMemberSummary(userId, roomId)` as optional.
This plan **rejects** introducing a single aggregator hook in this
slice for three reasons:

1. The four streams above already have N-safe hooks owning them.
   Wrapping them in a fifth hook adds memoisation surface and a new
   typed shape that buys nothing today.
2. The component would still need to read `loading`, `error`, and
   `forbidden` from each underlying source separately; an aggregator
   would either collapse those flags (losing detail) or surface
   them all anyway (duplicating the API).
3. The Dashboard already consumes the same hooks at the page level;
   composing them directly in `MemberDetail` keeps the two pages
   reading from the same primitives, which simplifies regression
   testing.

If a future task gains a real reason to share an aggregator (e.g.,
the same combination is needed in a third place), revisit then.

### 4.4 Promote `useRoomMembers` out of `ManageProject.tsx`

Task 34 placed `useRoomMembers(roomId)` page-local inside
`src/pages/ManageProject.tsx`. To reuse it for the member detail
page, **move the hook into its own file** at
`src/hooks/useRoomMembers.ts`. The move is byte-for-byte: same
shape, same room-switch reset semantics, same error / loading /
empty contract documented in Task 34 §4.4.

Rules:

- The new file exports `useRoomMembers(roomId)` plus the
  `RoomMember` interface and the `UseRoomMembersResult` interface.
- `ManageProject.tsx` swaps its inline definition for an import.
  Behaviour, props, and rendered output must be identical (verify
  via Task 34 §13 regression QA in this task's QA — §11).
- A thin selector `useRoomMember(roomId, userId)` is **also**
  exported from the same file. Implementation:
  ```
  export function useRoomMember(
    roomId: string | null,
    userId: string | null,
  ): { member: RoomMember | null; loading: boolean; error: string | null } {
    const { members, loading, error } = useRoomMembers(roomId);
    const member = useMemo(
      () => (userId ? (members.find((m) => m.userId === userId) ?? null) : null),
      [members, userId],
    );
    return { member, loading, error };
  }
  ```
  The selector is a memoised find; it does not issue a separate
  fetch. The hook's `loading` and `error` mirror
  `useRoomMembers`. No new state-transition table — it reuses the
  Task 34 table verbatim.
- Decision C in §6: do **not** promote `useRoomMembers` into
  `DataContext` in this task. Reasoning: only two consumers
  (Manage Project + Member Detail), both at the page level; the
  Task 32 audit explicitly defers `DataContext` shape growth.

### 4.5 Self-URL handling

If `params.userId === user?.id`, the page **redirects** to
`/profile` synchronously on mount via React Router's `<Navigate to
"/profile" replace />`. No data fetch is issued, no Member Detail
shell flashes. The Dashboard's self-tap handler skips this round
trip by routing directly to `/profile` (see §4.7) — the redirect
exists for direct address-bar / bookmark cases.

### 4.6 Forbidden / non-member URL guessing

A non-member who guesses `/members/<some-uuid>` (e.g., somebody not
in the same active room as the target user, or somebody whose
active room does not contain the target user) gets the **Forbidden
empty state**, not a real member's data:

- Client guard: `useRoomMembers(activeRoomId).members.some(m =>
  m.userId === params.userId)`. If false **and** `loading === false`
  **and** `error === null`, render the forbidden state (§7.4).
- Defence in depth: even if the guard were bypassed, the data hooks
  (`useRoomMembersBuckets`, `useRoomMembersSavingPlans`,
  `useLeaderboard`) only return rows for co-members under existing
  RLS. The page would resolve to "no data" anyway. The guard exists
  to control the **UX shape** of the failure (Forbidden, not "no
  buckets / no plan / no goal"), not to enforce the rule.
- Edge: caller is in active room X, target user is a member of room
  Y but not of room X. The active-room scoping means the guard
  fails and the Forbidden state renders. Switching active room to
  Y (via the room switcher) would let the user see the target
  member — that is the correct outcome.
- No `activeRoomId`: the user is signed in but has no active room
  (rare; the room switcher normally always picks one). Render the
  Forbidden state.

### 4.7 Dashboard navigation affordance

The Dashboard's leaderboard rows must be tappable.

`RoomLeaderboardList` gets one optional prop:

```ts
interface RoomLeaderboardListProps {
  entries: PlayerProgressEntry[];
  renderRowTrailing?: (entry: PlayerProgressEntry) => ReactNode;
  title?: string;
  emptyBody?: string;
  /** Optional per-row tap handler. When provided, rows become tappable. */
  onRowClick?: (entry: PlayerProgressEntry) => void;  // new in Task 36
}
```

Behaviour:

- When `onRowClick` is omitted (Task 33's existing callsites,
  Storybook), rows render exactly as today (non-interactive div).
- Before choosing the wrapper element, verify whether `NudgeButton`
  renders a native `<button>` (or any other interactive element).
  Because Dashboard's trailing slot can contain `NudgeButton`, if
  it renders a button, `RoomLeaderboardList` must **not** wrap the
  whole row in a `<button>`.
- If the trailing content is interactive, each tappable row is a
  `<div role="button" tabIndex={0}>` with explicit Enter / Space
  keyboard handling. Prevent Space from scrolling the page while
  activating the row.
- The trailing slot (`NudgeButton`) must remain interactive without
  firing the row tap: wrap the slot in an element with
  `onClick={(e) => e.stopPropagation()}` and matching keyboard-event
  propagation guards as needed so nudges do not navigate.
- Keyboard: focus ring on the row, Enter / Space activates the tap,
  and the implementation contains no nested buttons or invalid
  interactive nesting.
- The leader-crown / `gapLabel` / `isYou` highlight are unchanged.

Dashboard wiring (`src/pages/Dashboard.tsx`):

```ts
const navigate = useNavigate();
// ...
<RoomLeaderboardList
  entries={sortedEntries.map(toPlayerProgressEntry)}
  renderRowTrailing={(entry) =>
    !entry.isYou ? (
      <NudgeButton ... />
    ) : null
  }
  onRowClick={(entry) => {
    if (entry.isYou) {
      navigate('/profile');  // final Decision A
      return;
    }
    navigate(`/members/${entry.userId}`);
  }}
/>
```

`PlayerProgressRow` already handles the visual treatment for a
focused / hovered row via Tailwind. The interactive row wrapper adds:
- `transition-shadow hover:shadow-md focus-visible:ring-2
  focus-visible:ring-brand-accent`
- `cursor-pointer` (only when `onRowClick` is set — never on the
  non-interactive default).

Because the Dashboard trailing slot can contain `NudgeButton`, prefer
the `div role="button"` implementation unless verification proves
there is no nested-interactive risk. Do not ship invalid interactive
nesting.

### 4.8 Page composition

`src/pages/MemberDetail.tsx` is a single column with the same
section rhythm as Dashboard:

1. **Header** — back affordance + page title `copy.memberDetail.pageTitle`
   ("Member" / "สมาชิก") + subtitle `copy.memberDetail.subtitleMemberOf(roomName)`
   ("Member of <project name>" / "สมาชิกของ <ชื่อโปรเจกต์>").
   Implemented via the shared `PageHeader` component used by
   `ManageProject.tsx` for layout consistency.
2. **Profile band** — `Avatar` (size `xl`) + display name + an
   optional theme-coloured accent strip (a `h-1` bar using
   `themeColor` if present). No "Joined date" line here (joined-at
   already lives in Manage Project's Members section; duplicating it
   on the detail page does not earn its place).
3. **Personal-goal progress section** — a labelled progress bar:
   - Label: `copy.memberDetail.sectionPersonalGoal` ("Personal goal"
     / "เป้าหมายส่วนตัว").
   - Numbers: `saved / target` from
     `useLeaderboard().entries.find(e => e.userId === userId)`.
     Formatted via existing `formatCurrency` helpers.
   - Bar: reuse the same `<ProgressBar>` primitive
     `PlayerProgressRow` uses. Width = `Math.min(1, saved / target)`.
     Theme-coloured per the target user's `themeColor`.
   - Tied / leader semantics are **not** rendered (those are
     leaderboard-relative concepts).
4. **Saving Plan section** — read-only `SavingPlanCard` (see §4.9).
   When `plansByUser[userId]` is `null`, render
   `copy.memberDetail.savingPlanEmptyBody` ("This member has not set
   up a saving plan yet." / "สมาชิกนี้ยังไม่ได้ตั้งแผนการออม").
5. **Buckets section** — read-only `BucketGrid` (see §4.9). When
   `bucketsByUser[userId]` is empty, render
   `copy.memberDetail.bucketsEmptyBody` ("This member doesn't have
   any buckets yet." / "สมาชิกนี้ยังไม่มีกระปุก").

Sections 3–5 are wrapped in the same `motion.div` + `sectionVariants`
pattern Dashboard uses, so prefers-reduced-motion is respected for
free (`Dashboard.tsx` already gates Framer Motion on the user
preference).

### 4.9 Read-only `SavingPlanCard` and `BucketGrid`

Read-only mode is achieved by omitting interactive callbacks:
`BucketGrid` already treats its interactive callbacks as optional,
and this task makes `SavingPlanCard.onConfigure` optional per
Decision D.

`SavingPlanCard`:
- Pass `ruleType`, `money`, `habit`, `planSummary`, `isPaused`,
  `pausedSince`, `lastFreezeDateKey`, `todayDateKey`,
  `planStartDateKey`, `daysRemaining`, `progressPct` derived from
  the member's `SavingPlan` row (use the existing helpers Dashboard
  / SavingPlan use to compute money / habit status from a plan;
  factor them into a small pure helper if not already shared).
- Final Decision D: make `onConfigure` optional in
  `SavingPlanCardProps` and hide the "Configure" CTA when omitted.
  Passing `onConfigure: () => {}` is **wrong** because it preserves
  an edit path on a read-only surface. Verify during implementation
  that this remains a tiny safe change: ideally the CTA already
  lives inside an `if (onConfigure)` guard; otherwise the acceptable
  refactor is limited to making the prop optional and gating the CTA
  on `Boolean(onConfigure)`. If implementation finds this is not a
  tiny safe change, stop and report rather than adding a no-op edit
  path or a larger ad hoc flag.
- Do **not** pass `verifiedBalance`. The slot exists but is reserved
  for the caller's own page (it embeds the Verified Balance recap).
  The Member Detail page must never show another member's Verified
  Balance — this is the single hardest privacy rule in this slice.

`BucketGrid`:
- Pass `title` = `copy.memberDetail.bucketsTitle(displayName)`
  ("<Name>'s buckets" / "กระปุกของ <ชื่อ>") and `subtitle` =
  `copy.memberDetail.bucketsReadOnlyHint` ("Read-only — managed by
  <Name>" / "อ่านอย่างเดียว — จัดการโดย <ชื่อ>"). Today's Dashboard
  already passes a similar read-only subtitle via
  `copy.dashboard.bucketReadOnly`; pick one to share or add a
  detail-specific key (a new key is preferred — the subtitle copy
  here is a full sentence; the Dashboard's is a tag).
- Omit `onAddBucket`, `onBucketClick`, `ctaLabel`, `renderBucket`.
  The component already guards the add CTA on
  `Boolean(onAddBucket)`; verify during implementation.
- Bucket items come from `bucketsByUser[userId]`, mapped to
  `BucketGridItem` via the same mapper Dashboard uses for the
  other-member tabs (Task 33 §4.2 introduced this mapping;
  factor to a small pure helper if not yet shared).

If `SavingPlanCard` or `BucketGrid` does **not** in fact guard its
CTA on the relevant optional callback, file only the tiny guard
refactor described here. If hiding `SavingPlanCard`'s Configure CTA
turns out to require more than that, stop and report per Decision D.

## 5. Hard rule cross-check

Restating the task brief's hard rules, with the design's response:

| rule | response |
| --- | --- |
| Do not touch room cap | No SQL, no `join_room_by_code` edit, no trigger edit, no `useRooms.joinRoomByCode` edit, no `room_members` writes, and no cap logic changes. Task 35 owns room capacity. |
| Do not touch `join_room_by_code` / `enforce_room_capacity` | Same — no SQL touch and no cap-path touch. |
| Do not touch goals / sub-goals | `goals.target_amount` is read, never written. No new RPC. No new column. |
| Do not expose verified balance / reconcile / balance checkpoints / private notes | Member Detail never imports `useReconcile`, never reads `balance_checkpoints` or `balance_adjustments`, and explicitly omits `verifiedBalance` from the `SavingPlanCard` call. The privacy checklist (§9.3) restates this. |
| Read-only only when viewing another member | `SavingPlanCard.onConfigure` and `BucketGrid.onAddBucket` / `onBucketClick` are omitted; CTAs hide. Inline edit affordances are not added. |
| Non-member URL guessing must show forbidden/empty state via RLS/client guard | Client guard in §4.6; RLS layer enforces at the data level regardless. |
| Do not rewrite Dashboard layout beyond adding navigation affordance if needed | The single edit is `onRowClick` on `RoomLeaderboardList` + an interactive row wrapper. Because Dashboard trailing content can include `NudgeButton`, use `div role="button"` when needed to avoid nested buttons. No new sections, no removed sections, no shuffled rows. |
| Preserve current 2-user and 7-user behavior | The page is N-agnostic: it reads one member regardless of the room's cap. Dashboard rows tap into the page regardless of whether the room has 2 or 7 members. |

## 6. Final decisions

These decisions are closed for implementation.

- **Decision A — Self-tap from Dashboard.** Route to `/profile`
  when `entry.isYou`. Rationale: every row visually invites a tap;
  routing self to the existing Profile page keeps the affordance
  consistent without surfacing Member Detail for self.
- **Decision B — Tap to Member Detail from Manage Project's
  Members section.** Leave `RoomMemberRow` non-interactive in v1.
  Manage Project row navigation is out of scope for this task.
- **Decision C — `useRoomMembers` placement.** Move the hook into
  `src/hooks/useRoomMembers.ts` and keep consumers page-local
  (`ManageProject.tsx` + `MemberDetail.tsx`). Do **not** promote it
  into `DataContext` in this task.
- **Decision D — `SavingPlanCard.onConfigure` optionality.** Make
  `onConfigure` optional and hide the "Configure" CTA when omitted.
  If implementation finds this is not a tiny safe change, stop and
  report rather than adding a no-op edit path or expanding scope.

## 7. Loading, error, forbidden, empty states

Each state mirrors the patterns Dashboard / Manage Project already
use. No new design language is introduced.

### 7.1 Loading

While any of the four streams is loading and the page has not
resolved Forbidden yet, render section-level skeletons inside the
existing page chrome:
- Header skeleton: 48 × 48 px round avatar placeholder + a
  short bar for the name + a thin bar for the subtitle.
- Personal-goal section: a single bar placeholder for the progress
  row.
- Saving Plan: reuse the same skeleton block Dashboard renders
  during `data.savingPlan` loading.
- Buckets: a `grid grid-cols-2 gap-4` of two `Skeleton` cells, same
  as Task 33 / Task 34 patterns.
- Set `aria-busy="true"` on the page root while loading. Reuse the
  pattern from Task 34's Members section.

### 7.2 Error

Two flavours:
- **Member metadata error** (the `useRoomMember` selector returned
  `error !== null` and `member === null`): render a danger-toned
  body line under the header — `copy.memberDetail.errorBody`
  ("Couldn't load this member. Pull to refresh or try again." /
  TH equivalent). No member sections. No retry button in v1.
- **Plan / buckets error**: the underlying hooks degrade by
  returning empty maps with a logged warning (Task 32 contract).
  The page renders the corresponding section's **empty** state
  rather than a hard error. This matches Dashboard's behaviour for
  the same hooks.

### 7.3 Empty

- No saving plan: the Saving Plan section renders
  `copy.memberDetail.savingPlanEmptyBody`.
- No buckets: the Buckets section renders
  `copy.memberDetail.bucketsEmptyBody`.
- No personal goal target (i.e., `target === 0` from the
  leaderboard): the progress bar renders at 0%, the numerator shows
  the recorded total, and a small `copy.memberDetail.goalUnsetBody`
  line replaces the denominator ("Personal goal not set yet" / TH
  equivalent). At any room size, both Feature-5 pre- and post-
  semantics work because `target_amount` exists for members created
  through the normal join path (`bootstrap_joiner_goal`, migration
  0017).

### 7.4 Forbidden

When the client guard (§4.6) determines the viewer is not a
co-member of the target user in the active room:
- Render a centred body block with a neutral illustration / icon
  (reuse an existing icon — `IconUserPlus` flipped, or a generic
  `IconLock` if one exists; if not, no icon).
- Title: `copy.memberDetail.forbiddenTitle` ("Can't show this
  member" / "ไม่สามารถแสดงสมาชิกนี้").
- Body: `copy.memberDetail.forbiddenBody` ("You must be in the same
  project as this member to see their details." / TH equivalent).
- CTA: a `Button` labelled `copy.memberDetail.forbiddenCta` ("Back
  to Dashboard" / "กลับไปหน้าแดชบอร์ด") that navigates to
  `/dashboard`.
- The page header (eyebrow + title) is replaced by a generic
  "Member" title; no member name leaks.

### 7.5 Self URL

Pure redirect via `<Navigate to="/profile" replace />`. No flash, no
spinner. Implementation note: place the redirect **before** any
data-dependent rendering so it runs on the first render.

### 7.6 Active-room change mid-visit

If the user switches the active room while on `/members/:userId`:
- Re-evaluate the client guard. If the target user is not in the
  new active room, transition to the Forbidden state.
- Re-fetches of `useRoomMember`, `useLeaderboard`,
  `useRoomMembersBuckets`, `useRoomMembersSavingPlans` happen
  automatically through Task 32's room-switch reset semantics. The
  page stays mounted; sections re-skeleton briefly during the
  transition.
- Switching to a room where the target user **is** a member
  refreshes the page with the new room's data. The url stays
  `/members/<same-userId>`; the data is now from the new active
  room's context.

## 8. Privacy checklist (what is shown vs never shown)

This is the canonical list. Implementers must cross-check the
diff against it before opening a PR.

### Shown to room co-members

- Display name.
- Avatar URL (already public for co-members per
  `profiles_member_select` RLS).
- Theme color / accent.
- `goals.target_amount` (personal goal, today the per-member target
  field — semantics unchanged by this task).
- `savings_logs.amount > 0` aggregate for this user (the "recorded
  deposits total" sourced from `useLeaderboard().entries[i].saved`).
- `saving_plans` summary: `rule_type`, current revision's
  `target_amount`, `effective_from_date`, derived `daysRemaining`,
  derived `progressPct`, plan-start label.
- `saving_plan_revisions` and `saving_plan_pauses` aggregated into
  the `SavingPlanCard` "isPaused" / "pausedSince" states.
- `buckets`: `name`, `target_amount`, `current_amount`, `position`,
  `category` / `icon`. Co-member read is migration 0019.

### Never shown

- Verified Balance / reconcile state. Member Detail must **not**
  import `useReconcile`, `balance_checkpoints`, or
  `balance_adjustments`.
- Balance adjustment reasons or notes. These are private to the
  reconciler.
- Storage breakdown (cash / bank / envelopes / other). Same.
- `notification_preferences` rows. The page does not import
  `useNotificationPreferences`.
- `push_subscriptions` rows. Never read by this page.
- Raw email (`auth.users.email`). Never read; `profiles` does not
  expose it. The header subtitle uses room name, not email.
- Nudges history. Out of scope (Task 31 / 33 own nudges).
- Notification feed. Out of scope.
- Milestone acknowledgements, streak freeze internal rows (these
  affect plan rendering only via the already-public `SavingPlan`
  summary fields).
- Saving plan **content** beyond the summary: do not render raw
  revision rows, raw pause rows, or per-deposit edit history. The
  `SavingPlanCard` summary is the only surface.

### Defence in depth

- The page **must not** query `balance_checkpoints`,
  `balance_adjustments`, `notification_preferences`, or
  `push_subscriptions` directly under any circumstance. Code review
  must search the diff for these table names and reject the PR if
  any appear.
- The page **must not** pass `verifiedBalance` to
  `SavingPlanCard`. Code review must search the diff for
  `verifiedBalance` in `MemberDetail.tsx`.
- A unit-style smoke during implementation: render `MemberDetail`
  in a dev environment, open the Network tab, confirm no request
  hits `balance_checkpoints`, `balance_adjustments`,
  `notification_preferences`, or `push_subscriptions` for the
  visited URL.

## 9. i18n / copy additions (EN / TH)

New keys under `copy.memberDetail`:

```ts
pageTitle: 'Member',                                          // TH: 'สมาชิก'
subtitleMemberOf: (roomName: string) =>
  `Member of ${roomName}`,                                    // TH: (roomName) => `สมาชิกของ ${roomName}`
sectionPersonalGoal: 'Personal goal',                         // TH: 'เป้าหมายส่วนตัว'
goalUnsetBody: 'Personal goal not set yet',                   // TH: 'ยังไม่ได้ตั้งเป้าหมายส่วนตัว'
sectionSavingPlan: 'Saving plan',                             // TH: 'แผนการออม'
savingPlanEmptyBody: 'This member has not set up a saving plan yet.', // TH equivalent
sectionBuckets: 'Buckets',                                    // TH: 'กระปุก'
bucketsTitle: (name: string) => `${name}'s buckets`,           // TH: (name) => `กระปุกของ ${name}`
bucketsReadOnlyHint: (name: string) => `Read-only — managed by ${name}`, // TH equivalent
bucketsEmptyBody: "This member doesn't have any buckets yet.", // TH equivalent
errorBody: "Couldn't load this member. Pull to refresh or try again.", // TH equivalent
forbiddenTitle: "Can't show this member",                     // TH: 'ไม่สามารถแสดงสมาชิกนี้'
forbiddenBody: 'You must be in the same project as this member to see their details.', // TH equivalent
forbiddenCta: 'Back to Dashboard',                            // TH: 'กลับไปหน้าแดชบอร์ด'
```

No existing key is renamed, removed, or repurposed. The audit's S6
copy cleanup ("partner" → "member" sweep across the rest of the
app) remains a separate task.

Per CLAUDE.md typing rules: all new keys are string literals or
explicit `(arg: string) => string` arrows. No `any`. The TH
strings must be reviewed by the user during QA — the suggestions
above are starting points.

## 10. Acceptance criteria

For the baseline 2-user behaviour:

1. Tapping the partner row on Dashboard navigates to
   `/members/<partner-uuid>` and renders the page within ~300 ms
   when the Dashboard's data is already in `DataContext`.
2. The page header shows the partner's display name + "Member of
   <project name>".
3. The Personal Goal section shows `saved / target` matching the
   partner's leaderboard row exactly (same numerator and
   denominator as Dashboard).
4. The Saving Plan section renders a read-only `SavingPlanCard`
   with the partner's plan summary, paused state, freeze hint,
   plan-start date label, and progress percentage. **No
   `verifiedBalance` slot renders.** The "Configure" CTA is hidden.
5. The Buckets section renders the partner's buckets in `position
   asc` order, with no add CTA, no per-bucket click handler, and
   the read-only subtitle.
6. Tapping the caller's own row routes to `/profile` and does not
   surface the Member Detail page for self.
7. Typing `/members/<own-uuid>` in the address bar redirects to
   `/profile`.
8. Typing `/members/<random-uuid>` while signed in but not a
   co-member of that user in the active room renders the
   Forbidden state. No data from any room leaks.
9. Typing `/members/<some-uuid>` while signed out redirects to
   `/login` (already enforced by `<ProtectedRoute>`).
10. No request to `balance_checkpoints`, `balance_adjustments`,
    `notification_preferences`, `push_subscriptions`,
    `useReconcile`, or any private surface is issued during a
    Member Detail render. Verified in the Network tab.
11. The Dashboard remains visually unchanged except for the new
    tap affordance on each leaderboard row (focus ring on keyboard
    focus, cursor pointer on hover, no row layout shift).
12. Dashboard row implementation has no nested buttons and no
    invalid interactive nesting; if `NudgeButton` renders a button,
    `RoomLeaderboardList` uses a `div role="button"` row wrapper
    with Enter / Space handling and trailing-slot propagation guards.
13. `npm run build` succeeds. `npm run lint` reports no new errors.
14. No SQL migration is added in this PR.
15. The `useRoomMembers` hook compiles unchanged for
    `ManageProject.tsx`'s consumer after the file-move refactor.
16. The room cap is not touched (no edits under
    `supabase/migrations/`, no edits to `useRooms.joinRoomByCode`).
17. The page handles `target === 0` (no personal goal set) by
    rendering `goalUnsetBody` instead of a divide-by-zero
    percentage.

For the future N-user case (reasoned, exercised against a local
dev DB only):

18. In a 3-user room, tapping each of the 2 other rows routes to
    the correct `/members/:userId`.
19. Switching active room mid-visit (from a room that contains the
    target user to one that does not) transitions to the
    Forbidden state.
20. At N = 7, all 6 other rows are tappable; each routes to its
    own member detail page.

## 11. Manual QA

### 11.1 Two-user room (regression behaviour)

Setup: an existing 2-user room with caller A and partner B, both
having ≥ 2 buckets and an active saving plan. A is signed in.

- [ ] On Dashboard, every leaderboard row shows a focus ring on
      keyboard tab. Hovering with a mouse shows `cursor: pointer`.
- [ ] Inspect the rendered Dashboard leaderboard DOM. If
      `NudgeButton` renders a button, the row wrapper is not a
      `<button>`; there are no nested buttons or invalid interactive
      nesting. Enter / Space on the row navigates, while activating
      the nudge control does not navigate.
- [ ] Tap B's row → URL becomes `/members/<B-uuid>`. Page renders
      within ~300 ms (data is already in `DataContext`).
- [ ] Header shows B's display name and "Member of <project name>".
- [ ] Avatar renders with B's image (or fallback letter); theme
      accent matches B's `themeColor`.
- [ ] Personal Goal section shows `saved / target` exactly equal to
      B's row on Dashboard (eye-compare both numbers).
- [ ] Saving Plan section shows B's plan summary: rule type, paused
      state, days remaining, progress percent. No "Configure" CTA.
      No Verified Balance slot.
- [ ] Buckets section shows B's buckets in `position asc` order.
      No add CTA. Tapping a bucket does nothing (no modal, no
      navigation).
- [ ] Open browser DevTools Network tab. Reload the page.
      Confirm no request hits `balance_checkpoints`,
      `balance_adjustments`, `notification_preferences`, or
      `push_subscriptions`.
- [ ] Press browser back → returns to Dashboard, scroll position
      preserved.
- [ ] Tap A's own row (Decision A) → routes to `/profile`,
      not to `/members/<A-uuid>`.
- [ ] Address-bar-type `/members/<A-uuid>` → redirects to
      `/profile`.
- [ ] Address-bar-type `/members/<random-uuid>` → Forbidden state.
      No leaks.
- [ ] Sign out → bookmarking `/members/<B-uuid>` and revisiting
      redirects to `/login`.
- [ ] Toggle EN ↔ TH → every new string flips immediately.
- [ ] `npm run build` passes.
- [ ] `npm run lint` passes with no new warnings.

### 11.2 Solo-creator room

- [ ] As a creator in a 1-member room, no leaderboard rows other
      than the caller exist. The caller's own row tap (Decision A)
      routes to `/profile`. There are no `/members/...` entries to
      reach via tap.
- [ ] Address-bar-type `/members/<some-other-uuid>` → Forbidden.

### 11.3 Reasoned three-user verification (local dev DB only)

- [ ] In a 3-user room, both partner rows on Dashboard are
      tappable. Each routes to its own member detail page.
- [ ] Each detail page shows only that user's data — no cross-
      contamination of buckets / plans / target numbers.
- [ ] Switch active room (via the room switcher) mid-visit to a
      room that does **not** contain the target user → the page
      transitions to Forbidden.
- [ ] Switch back → the page rehydrates with the target's data.
- [ ] At the moment of room switch, no flashes of a previous
      member's data appear (Task 32's room-switch reset is
      respected by the detail page).

### 11.4 Reasoned seven-user verification (local dev DB only)

- [ ] Six tappable rows. Each routes to its own member detail.
- [ ] No layout break at 375 px viewport.
- [ ] The page's bucket list scrolls naturally when the target
      user has many buckets.

### 11.5 Loading / error / forbidden

- [ ] Throttle the network in DevTools and direct-link to
      `/members/<B-uuid>`. Skeletons render with `aria-busy="true"`.
- [ ] Force the member metadata fetch to fail (block the RPC
      `room_members_for_room` request in DevTools). The page
      renders the `errorBody` line under the header. No member
      sections. No retry button.
- [ ] Force a `useRoomMembersBuckets` failure. The page renders
      the empty-buckets body (no hard error). Saving Plan section
      still renders.
- [ ] Direct-link to `/members/<random-uuid>` → Forbidden state
      with the "Back to Dashboard" CTA. Tap → returns to
      `/dashboard`.
- [ ] Confirm that `target === 0` for the partner renders
      `goalUnsetBody` and a 0% bar instead of `NaN%`.

### 11.6 Other surfaces still untouched

- [ ] Dashboard renders identically except for the new tap
      affordance.
- [ ] Manage Project's Members section (Task 34) is unchanged —
      rows remain non-interactive.
- [ ] Saving Plan page (`/saving-plan`) is unchanged.
- [ ] Add Money page is unchanged.
- [ ] Reconcile / Check Balance page is unchanged.
- [ ] Notification Center, notifications, and push are unchanged.
- [ ] The room switcher and Profile page are unchanged.

## 12. Rollback plan

Pure-frontend rollback. No SQL, no edge function, no migration.

- Revert the commit that introduced `MemberDetail.tsx`, the
  `/members/:userId` route in `src/App.tsx`, the
  `onRowClick` prop on `RoomLeaderboardList`, and the Dashboard
  tap handler.
- Revert the `useRoomMembers` file-move: copy the implementation
  back into `ManageProject.tsx` (Task 34's commit is the
  reference). Delete `src/hooks/useRoomMembers.ts` and
  `src/hooks/useRoomMember.ts` if no other consumer remains.
- Revert the new `copy.memberDetail.*` keys in
  `src/i18n/locales/en.ts` and `src/i18n/locales/th.ts`. (Leaving
  them in place is harmless but noisy.)
- Revert the optionality change on `SavingPlanCard.onConfigure` if
  it caused a behavioural diff at the existing Dashboard /
  SavingPlan callsites. (Default plan: it does not, because both
  callsites pass `onConfigure`.)

The rollback restores byte-for-byte the pre-task UX because every
new surface is additive and the file-move is a structural
refactor that does not change any rendered output.

No data, no schema, no realtime, no notification, no money-state
surface is touched, so there is no risk of data loss or partial
rollback state.

## 13. Risks and follow-ups

These are tracked here so they are not lost; none are addressed
in this task.

1. **Nudge button on the detail page.** Audit Feature 3 mentions
   it; brief omits it; this slice defers it. If product wants
   per-member nudging from the detail page, the existing
   `NudgeButton` already supports it (per-recipient). Add the
   button to the page footer in a follow-up.
2. **Tap from `RoomMemberRow` (Manage Project).** Decision B
   defers this; the row layout already accommodates an
   `onClick` prop without breaking changes.
3. **Realtime updates on the detail page.** Today, the page
   re-renders only on navigation or active-room change. A mid-
   visit deposit by the target user does not refresh their
   recorded-deposits total. This is acceptable for the first
   read-only detail slice; file realtime polish separately.
4. **`saving_plan_pauses` co-member RLS.** The audit calls for a
   one-line verification; if a gap is found, file a sub-task to
   extend the policy. This task degrades gracefully (paused
   state simply does not render).
5. **Member's recent activity / deposit history.** Not shown in
   this task. A future "activity for this member" section could
   surface sanitized deposit rows (positive amounts only, no
   notes). Out of scope for v1.
6. **Self-tap UX.** Decision A routes to `/profile`. If user
   testing prefers a non-interactive self row, revise the behaviour
   in a follow-up.
7. **Page-level scroll restoration.** Browser default is enough
   for the back-from-detail case today. If the Dashboard later
   gains virtualisation or list-restoration concerns, add a
   ScrollRestoration component in a separate task.
8. **Copy cleanup ("partner" → "member") inside the
   `SavingPlanCard` / `BucketGrid` strings used here.** Audit
   S6 task. The Member Detail page uses member-detail-specific
   keys for the section titles, so the cleanup elsewhere does
   not block this page from reading correctly.
9. **`SavingPlanCard.onConfigure` optionality.** If Decision D's
   refactor reveals that the CTA is hard-wired and would require
   a bigger refactor to hide, stop and report before implementation
   expands scope. Do not add a no-op edit path.
10. **Deep-link from Notification Center.** Future notifications
    that reference a specific member could deep-link to
    `/members/:userId`. Out of scope; the route exists so this is
    a one-line addition later.

---

End of Task 36 plan.
