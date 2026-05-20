# Task 34 — Manage Project Member List (multi-user-ready, cap stays at 2)

Status: Planning only. No code, migrations, or file edits in this
document.
Owner: Senior FE/FS pair (Claude) with Fran.
Source:
- `docs/multi-user-room-feature-plan.md` (Feature 2 only)
- `docs/plans/feature-2-multi-user-rooms-audit.md` (slice S6)
- Task 31 (`docs/plans/31-multi-user-notification-fanout.md` and the
  `feat: multi-user notification fan-out (Task 31)` commit `6ff467a`)
- Task 32 (`docs/plans/32-multi-user-data-hooks.md` and the
  `feat: N-safe room/member data hooks (Task 32)` commit `ce4e75f`)
- Task 33 (`docs/plans/33-multi-user-dashboard-ui.md` and the
  `feat(dashboard): N-aware Progress Race + per-member buckets
  (Task 33)` commit `ca47c00`)
- `src/pages/ManageProject.tsx`
- `src/components/RoomContext/RoomContext.tsx`,
  `src/hooks/useRoom.ts`, `src/hooks/useRooms.ts`
- `src/hooks/useRoomOtherMemberIds.ts`,
  `src/hooks/useLeaderboard.ts`
- `src/components/JoinProjectFlow/JoinProjectFlow.tsx`,
  `src/components/ProjectPreviewCard/ProjectPreviewCard.tsx`
- `src/components/SettingsList/SettingsList.tsx`,
  `src/components/SettingsRow/SettingsRow.tsx`,
  `src/components/Avatar/Avatar.tsx`,
  `src/components/Chip/Chip.tsx`
- `src/i18n/locales/en.ts`, `src/i18n/locales/th.ts`
- `supabase/migrations/0016_rpc_room_members_for_room.sql`
Date drafted: 2026-05-20.

This task is the Manage Project slice (audit slice S6, Manage Project
sub-item). It makes `ManageProject.tsx` ready for the N-member future
while **keeping the room cap at 2 in production**. The work is purely
UI / hook layer over existing data: it reuses the already-deployed
`room_members_for_room(p_room_id)` RPC (migration 0016) to render a
member list with avatar, display name, joined date, and a creator
badge. No SQL, no RLS, no migrations, no cap change, no notification
fan-out, no goals/sub-goals, no Dashboard touch. The 2-member behaviour
must look the same as today, with the only intentional visible change
being a new "Members" section inside Manage Project.

---

## 1. Goal

- Surface every current room member inside Manage Project: avatar,
  display name, joined date (if available), and a creator badge for
  the room's `created_by` user.
- Reuse the existing security-definer RPC
  `public.room_members_for_room(p_room_id uuid)` (migration 0016) so
  the list works for every member regardless of `room_members` RLS
  visibility quirks. The RPC already returns `user_id, display_name,
  avatar_url, theme_color, joined_at`, sorted by `joined_at asc`.
- Keep invite-code / QR behaviour byte-for-byte identical while the
  cap is at 2: the existing `Invite Code` settings row, the
  `invite-code` modal, and the `useRooms.joinRoomByCode` error
  ("That project already has two players.") stay exactly as they
  are today.
- Stay strictly inside `src/pages/ManageProject.tsx`, one new
  hook, one new component, and the EN/TH locales. No edits to any
  other page, hook, edge function, or migration.
- Preserve current 2-user behaviour: a 2-member room renders the
  current page plus one new "Members" section showing 2 rows
  (creator first, partner second). The page header, sections,
  modals, and danger-zone Archive/Leave row stay where they are.
- Add explicit loading, error, and empty states for the member
  list.
- Ship EN + TH copy for every new string.
- Decide (in §6) whether to display a "2/2 full" capacity pill now
  or defer until the cap raise. The plan's decision: **defer**.

## 2. Non-goals (do not touch)

The following are explicitly out of scope and must not be touched in
this task:

- **Raising the room capacity (2 → 7).** The trigger
  `enforce_two_player_cap` (migration 0023), the RPC
  `join_room_by_code` (migration 0024), and the
  `useRooms.joinRoomByCode` full-room error string remain exactly as
  they are today.
- **`join_room_by_code` RPC.** No signature change, no error code
  change, no SQL touch.
- **`enforce_two_player_cap` trigger.** No SQL touch.
- **Any SQL migration / RLS policy.** This task ships zero
  migrations. Every read uses the already-deployed
  `room_members_for_room` RPC (migration 0016) or existing
  `profiles` / `rooms` rows accessed through it.
- **Dashboard UI** (Task 33 / audit S4). No touch to `Dashboard.tsx`,
  `RoomLeaderboardList`, `PlayerProgressRow`, `HeadToHeadCard`, or
  the per-member buckets section.
- **Notification fan-out** (Task 31). `notify_*` RPCs,
  `_smart_check_*`, `notify-partner-deposit` edge function, and any
  push behaviour stay put.
- **Goals / sub-goals** (Feature 5). `goals.target_amount` semantics
  remain unchanged. Sub-goal plumbing is not added.
- **Data hooks layer** (Task 32). `useRoomOtherMemberIds`,
  `useRoomMembersBuckets`, `useRoomMembersSavingPlans`,
  `usePartnerBuckets`, `usePartnerSavingPlan`, `useLeaderboard`,
  `DataContext` shape — none of them change. This task adds a new
  lightweight read-only hook for the **member list display only**;
  it does not replace or rename any existing hook.
- **`JoinProjectFlow` / `ProjectPreviewCard`** capacity strings and
  the hard-coded `memberCount: 2` in `joinPreview(...)` (Profile /
  AppLayout). The audit flags these as Medium / Safe-to-defer; they
  do not block Manage Project's member list and can move in a later
  slice. We do **not** rewire the join preview here.
- **The "Invite Code" settings row + invite-code modal**. The row
  remains visible to every member (creator and joiner) with the same
  copy, the same QR icon, and the same `Copy Code` button. The cap is
  still 2; touching this row would either lie ("invite more!" with
  cap = 2 and room full) or contradict the brief.
- **Member detail navigation** (Feature 3 / future Task 35). Tapping
  a member row navigates nowhere in this task. The `/members/:userId`
  route is a later slice.
- **i18n copy rewrites** outside the new strings required by §9.
  The word "partner" stays everywhere it appears today (audit S6).
- **Realtime subscription for member list changes.** Membership in a
  2-user room is effectively stable across a single Manage Project
  visit. Manual refresh + page revisit is enough; a realtime channel
  for `room_members` is filed as a follow-up under §13.

## 3. Current Manage Project assumptions to replace

Sources: `src/pages/ManageProject.tsx` (399 lines) and the Task 32
hook layer summary in `docs/plans/32-multi-user-data-hooks.md`.

What today's Manage Project actually shows:

1. `PageHeader` — eyebrow + title `copy.manageProject.pageTitle` +
   subtitle `activeRoom.name`.
2. Section "Project Basics" via `SettingsList`:
   - `project-name` row (creator-only edit; non-creator hint).
   - `invite` row → opens the `invite-code` modal showing
     `activeRoom.invite_code`.
3. Section "Saving Controls" via `SettingsList`:
   - `quick` row → quick-amount editor modal.
4. Section "Room Actions" via `SettingsList`:
   - `create-another` row (creator-only).
   - Danger row at the bottom = Archive (creator) / Leave (joiner).
5. Modals: rename-room, invite-code, quick-amounts, buckets,
   archive-confirm, leave-confirm.

Single-partner assumptions inside Manage Project today:

- There is **no** member list at all. The user has no way to see
  who their partner is, when they joined, or even how many members
  are in the room.
- `activeRoom.created_by === user?.id` is the only "role" used by
  the page; the joiner sees nothing about the creator's identity
  except the small hints in rename / leave copy.
- The `inviteCodeDesc` string still reads "Share with your partner
  to join this project", which is correct for the 2-cap world.
  Per §2 we leave this string alone.

Data already available to the page (no new fetch required for these):

- `activeRoom` from `useRoom()` — gives `created_by`, `name`,
  `invite_code`.
- `user` from `useAuth()` — gives the caller's `id`.
- `data` from `useSharedData()` — gives `data.profile`, etc.

Data NOT currently available to the page:

- The list of room members with display names, avatars, and
  `joined_at` timestamps. This is the new read the page needs and
  the only new code path Task 34 introduces.

## 4. Proposed UI changes

### 4.1 New section: "Members"

Add one new section inside Manage Project, placed **between**
"Project Basics" and "Saving Controls". Rationale: the project's
identity (name, invite code) comes first, then who's in it, then
the saving controls (quick amounts), then the room actions (create
another, archive/leave). Reads top-to-bottom as a coherent
"identity → people → behaviour → admin" stack.

Section header copy: `copy.manageProject.sectionMembers` (new key —
EN "Members", TH "สมาชิก"). Render uses the existing `SectionLabel`
+ `SettingsList`-style stack so it matches surrounding spacing.
**Do not** reuse `SettingsRow` for member rows — the row layout is
distinct (avatar leading slot instead of an `IconBubble`, creator
badge meta, no chevron). Use a small dedicated component
`RoomMemberRow` (see §4.3).

Order of rows: by `joined_at asc` (creator first because creators
become members immediately at room creation). This matches the order
already returned by `room_members_for_room`.

For each member row, render:
- **Leading**: `Avatar` (size `md`) using the existing component.
  - `imageUrl` ← `avatar_url`
  - `fallback` ← first uppercase grapheme of `display_name`
    (existing convention; see `ProjectPreviewCard` /
    `RoomLeaderboardList`). For empty / null display names fall back
    to `'?'`.
  - `themeColor` from the row; pass to `Avatar` only if the row has
    one. No ring on the avatar in this row (the avatar ring on
    Dashboard is a leaderboard cue; here it would be visual noise).
- **Primary text**: `display_name`, single-line, truncated. For the
  caller render `"{display_name} (You)"` in EN / `"{display_name}
  (คุณ)"` in TH via a new `copy.manageProject.memberYouSuffix(name)`
  helper. Rationale: anchors the caller without losing the actual
  display name.
- **Secondary text**: joined-date label. See §4.2 for the formatter
  decision (joined-date copy + locale).
- **Trailing meta**: a creator badge for the user whose `user_id`
  matches `activeRoom.created_by`. Use the existing `Chip`
  component, `tone="peach"`, label `copy.manageProject.creatorBadge`
  (new — EN "Creator", TH "ผู้สร้าง"). No chip for the partner row.

Empty / loading / error states are spelled out in §8.

### 4.2 Joined-date formatting

The RPC returns `joined_at timestamptz`. The Avatar/row UI needs a
compact label, not a full timestamp.

Decision: render `joined_at` via a new helper
`formatJoinedDate(iso, language)` in `src/i18n/formatters.ts`. The
helper returns a Bangkok-local short date like `28 May 2026` (EN) or
`28 พ.ค. 2026` (TH). Keep the year because join dates can be from a
previous year for long-running rooms; cropping the year would hide
useful context.

Edge cases the helper must handle:
- `null` / missing `joined_at` (defensive — the RPC always returns a
  value, but a future refactor could). Render an
  empty string and use the i18n fallback
  `copy.manageProject.memberJoinedUnknown` ("Joined recently" / TH
  "เพิ่งเข้าร่วม") as the secondary text. The whole row stays
  visible.
- Invalid ISO. Same fallback as null.

Secondary-text template:
- EN: `Joined ${formatJoinedDate(joined_at, 'en')}` →
  "Joined 28 May 2026"
- TH: `เข้าร่วมเมื่อ ${formatJoinedDate(joined_at, 'th')}` →
  "เข้าร่วมเมื่อ 28 พ.ค. 2026"

Encoded as `copy.manageProject.memberJoinedAt(dateLabel)`.

### 4.3 New small component: `RoomMemberRow`

Path: `src/components/RoomMemberRow/RoomMemberRow.tsx`.

Reason for a dedicated component instead of overloading
`SettingsRow`: the row layout is different enough (avatar leading
slot, no chevron, no `onClick` semantics in v1, creator badge meta)
that bending `SettingsRow` would introduce a third tone branch.
Keeping a parallel small component preserves `SettingsRow`'s shape.

Verified component APIs (read directly from source — do not invent
props):

`Avatar` (`src/components/Avatar/Avatar.tsx`):

```ts
interface AvatarProps {
  imageUrl?: string | null;
  fallback?: string;                       // default '?'
  size?: 'sm' | 'md' | 'lg' | 'xl';        // default 'md'
  ring?: 'none' | 'leader' | 'theme';      // default 'none'
  themeColor?: ThemeSwatch;                // from src/lib/theme
  badge?: ReactNode;                       // bottom-center badge slot
  className?: string;
}
```

`Chip` (`src/components/Chip/Chip.tsx`):

```ts
type Tone = 'peach' | 'white' | 'leaf' | 'danger';
interface ChipProps {
  tone?: Tone;          // default 'peach'
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}
```

Note: `Avatar` has no `name` or `displayName` prop — the fallback
letter is passed as `fallback`. `Chip` has no `label` prop — the text
is the `children`. The RoomMemberRow must use these exact prop names
at the call site.

`RoomMemberRow` props (all primitives — strict typing per CLAUDE.md):

```ts
interface RoomMemberRowProps {
  name: string;
  fallback: string;
  imageUrl?: string | null;
  themeColor?: ThemeSwatch;
  joinedDateLabel: string;     // already formatted; the page picks EN/TH
  isYou: boolean;
  isCreator: boolean;
  creatorBadgeLabel: string;   // copy.manageProject.creatorBadge
  youSuffix?: string;          // "(You)" / "(คุณ)" when isYou
}
```

Render — verbatim against the real Avatar / Chip APIs above:

- Outer: `bg-surface`, `rounded-lg`, `shadow-soft`, `p-3`, flex row,
  `gap-3`, to match `SettingsRow` visual language.
- Leading: `<Avatar size="md" imageUrl={imageUrl} fallback={fallback}
  themeColor={themeColor} />`. Omit `ring` (default is `'none'`,
  which is the desired value — the leader-ring is only used on the
  Dashboard leaderboard). Omit `badge` (it is the bottom-center slot
  on Avatar and is used by `PlayerProgressRow` for the "Leader" pill;
  the Members row's creator marker is a trailing `Chip`, not an
  avatar badge).
- Middle (`flex-1 min-w-0`): primary line with `name` + optional
  `youSuffix` (when `isYou === true`), `font-mono text-sm font-bold
  text-ink truncate`; secondary line with `joinedDateLabel` in
  `font-mono text-xs text-ink-muted truncate`.
- Trailing (`shrink-0`): when `isCreator === true`, render
  `<Chip tone="peach">{creatorBadgeLabel}</Chip>`. (`'peach'` is the
  Chip default; passing it explicitly documents intent at the call
  site and survives a future default change.) Do not pass an `icon`
  to the Chip — the badge is text-only.

No chevron, no `onClick`. The component is intentionally
non-interactive in v1 (member detail navigation is Feature 3).

If a future task adds member-detail navigation, wrap the whole row in
a `<button>` like `SettingsRow` and add a chevron — but do not bake
those into v1.

### 4.4 New hook: `useRoomMembers`

Path: `src/hooks/useRoomMembers.ts`.

Reason for a new hook instead of extending `useRoomOtherMemberIds`:
- `useRoomOtherMemberIds` excludes the caller by contract (audit:
  "user_ids of every current room member **except the caller**").
  The Manage Project list needs the caller too.
- `useRoomOtherMemberIds` discards profile + `joined_at` data
  (returns `string[]`). The member list needs all of it.
- Task 32's hook layer is intentionally backward-compatible and the
  audit explicitly avoids broad hook renames in this slice. Adding a
  small new hook alongside is the lower-risk move.

Shape:

```ts
interface RoomMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  themeColor: ThemeSwatch | null;
  joinedAt: string;            // ISO; the page picks the locale helper
}

interface UseRoomMembersResult {
  members: RoomMember[];       // sorted by joined_at asc
  loading: boolean;
  error: string | null;
}

function useRoomMembers(roomId: string | null): UseRoomMembersResult;
```

Implementation outline (planning only — not code):
- If `roomId` is null, return `{ members: [], loading: false, error:
  null }` and do not query.
- **On every `roomId` change, before any network work begins, reset
  internal state to `{ members: [], loading: true, error: null }`.**
  This is the room-switch reset and it MUST run synchronously inside
  the `useEffect` (or equivalent) for the new `roomId`. Without it,
  the previous room's members would briefly remain visible after a
  room switch — a leak of one room's identities into another room's
  UI. The reset applies to both the public state (what the hook
  returns) and any internal cache/`ref` the hook keeps.
- Otherwise call `supabase.rpc('room_members_for_room', { p_room_id:
  roomId })`. This RPC is already deployed (migration 0016) and
  returns every member regardless of `room_members` RLS state.
- On error:
  - **After a room switch (members is `[]` because the reset just
    ran)**, leave `members` as `[]`, set `loading = false`, set
    `error = <message>`. The UI renders the error block (§8.2) with
    no rows — correct, because we have no fresh data for the new
    room and showing the old room's members would be a leak.
  - **On a transient refetch within the same room (e.g., a future
    realtime-triggered refetch or a manual retry while `roomId` is
    unchanged and `members.length > 0`)**, keep the prior `members`
    array, set `loading = false`, set `error = <message>`. The UI
    keeps the prior rows visible with a small inline error banner
    (§8.2) — losing the list on a transient hiccup would be worse
    UX than keeping known-stale data with a visible warning.
  - The two branches are distinguished by inspecting `members.length`
    and the previous `roomId` inside the hook; the public API stays
    the same (`members`, `loading`, `error`).
- A new `roomId` arriving while a previous fetch is still in flight
  must invalidate the in-flight result. Use a `cancelled` flag (or
  `AbortController` if the supabase-js call supports it locally) so
  the older response cannot overwrite the new room's reset state.
  This is the same pattern used by `useRoomOtherMemberIds` and
  `useLeaderboard`; copy it.
- On `roomId` going from a value back to `null` (e.g., the user
  leaves the active room), reset to
  `{ members: [], loading: false, error: null }` immediately. Do not
  preserve prior members across a logout / active-room-cleared
  transition — the absence of an active room is unambiguous.
- Normalise rows:
  - `user_id` → `userId`
  - `display_name` → `displayName`; if null/blank, use a fallback
    like `'—'` to avoid `'undefined'` in the UI. Caller still gets a
    valid `fallback` letter from the first uppercase grapheme of the
    fallback string.
  - `avatar_url` → `avatarUrl`
  - `theme_color` → `themeColor` cast to `ThemeSwatch | null` (see
    `lib/theme.ts`). Unknown strings → `null`. No use of `any`.
  - `joined_at` → `joinedAt`
- Sort by `joinedAt asc`. The RPC already orders by `joined_at asc`
  but resorting client-side keeps the contract independent of any
  future RPC re-ordering.

State-transition summary (canonical, the implementation must match
this table):

| trigger                              | members           | loading | error    |
| ------------------------------------ | ----------------- | ------- | -------- |
| mount, `roomId === null`             | `[]`              | `false` | `null`   |
| mount, `roomId !== null` (pre-fetch) | `[]`              | `true`  | `null`   |
| fetch success                        | fetched + sorted  | `false` | `null`   |
| fetch error after room switch        | `[]`              | `false` | message  |
| same-room refetch error              | prior `members`   | `false` | message  |
| `roomId` change to a new value       | `[]` (reset)      | `true`  | `null`   |
| `roomId` change to `null`            | `[]`              | `false` | `null`   |

No realtime subscription in v1. The page already shows fresh state
on each visit; member list changes during a single visit are not
expected at cap = 2. Realtime is a §13 follow-up.

### 4.5 ManageProject wiring

`ManageProject.tsx` consumes the new hook directly (it is page-level
state; threading it through `DataContext` is unnecessary for one
non-interactive list, and adds typed-shape churn to `DataContext`
that the audit explicitly defers).

Inside `ManageProject.tsx`:

```ts
const { members, loading: membersLoading, error: membersError } =
  useRoomMembers(activeRoomId);
```

Render block, after `<SettingsList ... sectionProjectBasics ... />`
and before `<SettingsList ... sectionSavingControls ... />`:

```tsx
<section className="space-y-3">
  <h2 className="font-mono text-lg font-bold leading-tight text-ink">
    {copy.manageProject.sectionMembers}
  </h2>
  {/* §8: loading / error / empty / list */}
</section>
```

The page already imports `useRoom`, `useAuth`, `useI18n`, and `useSharedData`.
The only new imports are `useRoomMembers` and `RoomMemberRow` (plus
`formatJoinedDate` from the i18n module).

### 4.6 What is **not** changing on Manage Project

- The Project Basics section, including the `invite` row, modal, and
  copy.
- The Saving Controls section.
- The Room Actions section, including the creator-only "Create
  another project" row and the danger zone Archive / Leave row.
- All existing modals (rename-room, invite-code, quick-amounts,
  buckets, archive-confirm, leave-confirm).
- The page header, back button, and the message banner under the
  header.

## 5. Capacity copy / hint (future-readiness, no lies)

The brief asks for "future-ready capacity copy/hint only if it does
not lie to users today". The room cap is 2 today and will be raised
to 7 later (Feature 2, separate task). The plan rules out anything
that primes a number the user cannot reach yet.

Allowed copy that is true at cap = 2:
- Section header: "Members" / "สมาชิก" — true at any N.
- Per-row creator badge: "Creator" / "ผู้สร้าง" — true at any N.
- Per-row joined-at: "Joined 28 May 2026" — true at any N.
- Caller suffix: "(You)" / "(คุณ)" — true at any N.

**Not added** (would lie or pre-announce):
- A "1/7" or "2/7" counter pill. The cap is 2, not 7, and the user
  cannot invite a 3rd member today. Showing a 7 implies a feature
  that does not exist. Defer to the cap-raise slice.
- An "Invite up to N more" hint. Same reason.
- A "Room is full" or "2/2 full" pill (see §6 for the decision).
- A "Coming soon: more members" teaser. Avoid product
  pre-announcements inside Manage Project; that is marketing copy,
  not utility copy.

Result: the only future-ready text added today is the section
header "Members" itself and the per-row creator badge. Both are
already true at N = 1, 2, …, 7 and never need to change as the cap
moves.

## 6. Decision: should "2/2 full" be shown now or deferred?

**Decision: defer.**

Arguments considered:

Pro show "2/2 full" now:
- It is literally true today: a 2-user room is at cap.
- Sets the user's expectation that the cap is 2 and a 3rd join will
  fail.

Pro defer until cap raise:
- The cap raise is a future product change. Today, every active
  2-user room is "full" by definition. Adding a "Full" pill to
  every healthy 2-user project is alarming UI for zero useful
  signal.
- The `Invite Code` row remains visible (per §2 / the brief). Showing
  "Full" next to a still-visible invite code contradicts itself: a
  user reading "Full" alongside a `Copy Code` button is confused
  about whether the code does anything.
- The full-room error message ("That project already has two
  players.") is already surfaced at the **join** flow, where it
  matters. Replicating it at the Manage Project surface duplicates
  signal.
- The cap raise will replace the literal "2/2 full" with a real
  capacity indicator (e.g. `5/7`). Shipping "2/2 full" now and
  swapping it later churns copy / locale strings for no current user
  benefit.
- The brief explicitly says "Keep invite/QR behavior unchanged while
  cap is still 2", which is the strongest signal that we should not
  introduce a "Full" UI that would conflict with the still-active
  invite code.

Implementation consequence: no capacity pill, no "Full" label, no
"room full" copy added inside Manage Project. The member section
simply lists the current members. When the cap is raised in a future
task, a capacity pill / hint can be added in the same place without
re-shuffling the section layout.

## 7. Non-creator behaviour

Today's page already differs creator vs joiner in three places:
- The project-name row: creator can edit; joiner sees a hint.
- The "create another project" row: creator can navigate; joiner has
  no `onClick`.
- The danger row: creator gets Archive; joiner gets Leave.

Task 34's member list is identical for both roles. Both creator and
joiner see:
- The full member list (creator + joiner) with the same row layout.
- The "Creator" badge on the same row (the creator's row).
- Joined-at on every row.
- Loading / error / empty states the same way.

Specifically, joiners do not get:
- An "Invite more" CTA. (Cap is 2, room is full.)
- A "Remove this member" button. The current creator-only
  destructive surface is Archive; per §2 we do not introduce a new
  remove path here.
- A "Transfer creator role" action. Out of scope. The brief says
  preserve current 2-user behaviour, and there is no creator-transfer
  flow today.

Creators do not get:
- A "kick member" button. Same reason. Add later under a separate
  task if/when product asks for it.
- A "creator-only" mark on the partner row. Only the creator row
  shows the badge.

The page's existing creator-vs-joiner branches in Project Basics
and Room Actions stay exactly as they are.

## 8. Loading, error, and empty states

### 8.1 Loading

While `membersLoading === true`:
- Render two **skeleton** rows inside the Members section. Two,
  because the typical state is a 2-member room and a single skeleton
  would visually disagree with the typical post-load state.
- The skeleton mirrors `RoomMemberRow`'s shape: a circular avatar
  placeholder + two short bars for the primary/secondary text + a
  short pill placeholder on the right. Use the existing
  `Skeleton` / `animate-pulse` patterns already present in the
  codebase (e.g. in BalanceActivityFeed / Notification Center
  loaders).
- The section header text stays visible above the skeletons.

Accessibility: the section uses `aria-busy="true"` while loading so
screen readers announce the pending state.

### 8.2 Error

If `membersError !== null`, render depends on whether the hook has
any members to show (per the §4.4 state-transition table — the hook
contract is the source of truth here):

- **`members.length === 0` (post room switch or first load failed)**:
  render a single `font-mono text-xs text-danger`-toned line under
  the section header — `copy.manageProject.memberListErrorBody` (EN
  "Couldn't load members. Pull to refresh or try again." / TH
  "โหลดรายชื่อสมาชิกไม่สำเร็จ ลองรีเฟรชหรือลองใหม่อีกครั้ง"). No rows.
  This is the correct state after a room switch fails — showing the
  previous room's members here would leak identities across rooms.
- **`members.length > 0` (same-room refetch failed)**: keep the
  prior rows fully visible, and add a thin inline danger-toned
  banner immediately below the list using the same
  `memberListErrorBody` string. This way the user is not stranded
  without a member list because of a transient network hiccup, and
  is still told that the refresh did not succeed.
- Do not show a retry button in v1. The hook re-fetches when
  `roomId` changes (e.g., the user navigates away and back, or
  switches active room). A dedicated retry button is a §13
  follow-up.

### 8.3 Empty

A "no members at all" case should be impossible — the active user is
always a member of `activeRoom`. If `members.length === 0` after
`loading === false` and `error === null`, the most likely cause is
an RLS regression. Render a single line:
`copy.manageProject.memberListEmptyBody` (EN "No members yet. Try
refreshing the page." / TH "ยังไม่มีสมาชิก ลองรีเฟรชหน้านี้").

Also log a `console.warn` from the hook in this exact case
(`members.length === 0`, no error), so we can spot it in the field.

### 8.4 Solo-creator (1-member room)

The legit 1-member case is when a creator made a room but no joiner
has joined yet. The list renders one row (the creator) plus an
"empty co-member" hint line under the Members header:
`copy.manageProject.memberListSoloHint` (EN "Share the invite code
to add your partner." / TH "แชร์รหัสเชิญเพื่อเชิญคู่ของคุณ"). This
single hint string is the **only** copy in this task that touches
"invite" — and it does not change the invite/QR behaviour itself
(per the brief). It is purely informational, true at cap = 2 (the
user has 1 slot left), and degrades gracefully when the cap is
later raised (still true that the invite code adds members).

## 9. i18n additions (EN / TH)

New keys under `copy.manageProject`:

```ts
sectionMembers: 'Members',                                          // TH: 'สมาชิก'
creatorBadge: 'Creator',                                            // TH: 'ผู้สร้าง'
memberYouSuffix: (name: string) => `${name} (You)`,                  // TH: (name) => `${name} (คุณ)`
memberJoinedAt: (dateLabel: string) => `Joined ${dateLabel}`,        // TH: (dateLabel) => `เข้าร่วมเมื่อ ${dateLabel}`
memberJoinedUnknown: 'Joined recently',                              // TH: 'เพิ่งเข้าร่วม'
memberListErrorBody: "Couldn't load members. Pull to refresh or try again.", // TH: 'โหลดรายชื่อสมาชิกไม่สำเร็จ ลองรีเฟรชหรือลองใหม่อีกครั้ง'
memberListEmptyBody: 'No members yet. Try refreshing the page.',     // TH: 'ยังไม่มีสมาชิก ลองรีเฟรชหน้านี้'
memberListSoloHint: 'Share the invite code to add your partner.',    // TH: 'แชร์รหัสเชิญเพื่อเชิญคู่ของคุณ'
```

No existing `manageProject.*` key is renamed, removed, or changed.

`copy.joinProject.members(count)` already exists for the join
preview ("X member(s)" / "X สมาชิก"); we deliberately do **not** reuse
it inside Manage Project. Reuse would tie the Manage Project counter
to a string that may need to change wording when cap is raised, and
the audit decision is to defer counters until then.

New formatter helper:

- `formatJoinedDate(iso: string, language: Language): string` added
  to `src/i18n/formatters.ts`. Returns "28 May 2026" (EN) or
  "28 พ.ค. 2026" (TH). Defensive: returns an empty string for null /
  invalid ISO so the caller can substitute `memberJoinedUnknown`.

Per CLAUDE.md typing rules:
- All new copy values are exact string literals or `(arg: string) =>
  string` / `(arg: number) => string` arrow functions, matching the
  existing locale-file conventions.
- The new `RoomMember` interface uses explicit fields; no `any`,
  no `getattr`-style lookups.

## 10. Acceptance criteria

1. In a 2-user room, Manage Project shows a new "Members" section
   between Project Basics and Saving Controls with exactly two rows
   in `joined_at asc` order (creator first).
2. The creator's row shows a "Creator" chip in the trailing meta
   slot; the partner's row does not.
3. Each row shows the member's display name + joined-at label.
   The caller's own row shows `(You)` / `(คุณ)` after their display
   name.
4. Avatar image renders when `avatar_url` is set; first uppercase
   grapheme of the display name is shown when `avatar_url` is null.
5. The page's existing surfaces are unchanged: Project Basics row
   labels and behaviour, Saving Controls row labels and behaviour,
   Room Actions including Archive (creator) / Leave (joiner). No
   modal copy moves.
6. Invite/QR behaviour is identical to today: the Invite Code row
   stays visible and clickable for both roles, the modal opens with
   the same `activeRoom.invite_code`, and the join error
   ("That project already has two players.") is unchanged.
7. No capacity counter ("X/Y"), no "Full" pill, and no "Invite more"
   CTA is added inside Manage Project.
8. While the hook is loading, two skeleton rows render under the
   section header, and `aria-busy="true"` is set on the section.
9. On hook error with `members.length === 0` (post room switch or
   first load failed), a single danger-toned line replaces the rows.
   On hook error with `members.length > 0` (same-room refetch
   failed), the prior rows stay visible and a small danger-toned
   banner appears below them.
10. In a 1-member solo-creator room, one row renders plus the
    `memberListSoloHint` line. (Cap is 2 today, so this is the
    pre-join state and is the only "0 other members" state in
    production.)
11. All new strings are present in both `en.ts` and `th.ts`. The
    build passes with no missing-key warnings.
12. `npm run build` succeeds. `npm run lint` reports no new errors.
13. No SQL migration is added in the Task 34 PR.
14. No edits to `useRoomOtherMemberIds`, `useRoomMembersBuckets`,
    `useRoomMembersSavingPlans`, `usePartnerBuckets`,
    `usePartnerSavingPlan`, `useLeaderboard`, `DataContext`,
    `Dashboard.tsx`, `JoinProjectFlow.tsx`,
    `ProjectPreviewCard.tsx`, `RoomLeaderboardList.tsx`,
    `PlayerProgressRow.tsx`, `HeadToHeadCard.tsx`, the `notify_*`
    RPCs, or the `notify-partner-deposit` edge function.
15. The new `RoomMemberRow` uses only props that exist on the real
    `Avatar` (`imageUrl`, `fallback`, `size`, `ring`, `themeColor`,
    `badge`, `className`) and `Chip` (`tone`, `icon`, `children`,
    `className`) component signatures. No invented prop names.
16. Switching the active room from room A to room B clears the
    Members list to `[]` synchronously **before** the new fetch
    resolves. The previous room's members never flash on the screen
    after a room switch, even on a slow network.

## 11. Implementation steps (the next task — not this doc)

In order, each as a small commit:

1. Add `formatJoinedDate(iso, language)` to
   `src/i18n/formatters.ts`. Cover null/invalid input with an empty
   return. Run `npm run build`.
2. Add the new locale keys to both `src/i18n/locales/en.ts` and
   `src/i18n/locales/th.ts` under `manageProject:` (see §9). Run
   `npm run build` to catch missing-key compile errors (the i18n
   helper is structurally typed).
3. Add `src/hooks/useRoomMembers.ts` per §4.4. Strict types,
   no `any`. The hook only calls `supabase.rpc('room_members_for_room',
   { p_room_id })`; no migrations, no policy changes.
4. Add `src/components/RoomMemberRow/RoomMemberRow.tsx` per §4.3.
   Strict prop types. No `onClick` in v1. Avatar uses `size="md"`,
   `ring="none"`.
5. Wire `ManageProject.tsx`: import the hook, call it with
   `activeRoomId`, render the new "Members" section between Project
   Basics and Saving Controls, respecting loading / error / empty /
   solo states (§8).
6. Manual QA per §13.
7. `npm run build` + `npm run lint` clean.
8. Open PR `feat(manage-project): show room member list (Task 34)`
   against `dev`. PR description references this doc, Task 32 commit
   `ce4e75f` for hook-layer conventions, and Task 33 commit `ca47c00`
   for the N-aware UI direction. Note the explicit non-goal: cap
   stays at 2.

The PR must touch only:
- `docs/plans/34-manage-project-member-list.md` (this file)
- `src/i18n/formatters.ts`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`
- `src/hooks/useRoomMembers.ts`
- `src/components/RoomMemberRow/RoomMemberRow.tsx`
- `src/pages/ManageProject.tsx`

If a step requires editing any other file (especially anything under
`supabase/`, `usePartner*`, `useLeaderboard`, `Dashboard.tsx`,
`JoinProjectFlow.tsx`, `ProjectPreviewCard.tsx`), stop and revisit
this plan — the scope drifted.

## 12. Risk level

**Low.** The slice is read-only, UI-only, and rides on an RPC that
already exists and is exercised by `useLeaderboard` as a fallback.

Specific risks and mitigations:

- **RLS visibility on `room_members`.** The `room_members_select`
  policy was fixed in migration 0012, but legacy environments could
  return only the caller's row from a direct select. The RPC sidesteps
  this entirely by running with `security definer` and joining
  `profiles` server-side. The hook calls the RPC directly, so the
  member list is correct even where the direct select is incomplete.
- **`joined_at` accuracy.** `room_members.joined_at` is set by
  `default now()` on row insert. For the original creator the value
  is the moment they created the room (via the `room_members` insert
  inside the room-creation flow). For joiners it is the moment they
  ran `join_room_by_code`. Both values are honest; we are surfacing
  what already exists.
- **Display-name edge cases.** Empty / null / very long names. The
  hook normalises null to `'—'`; the row component truncates with
  `truncate`. No layout break.
- **Theme color cast.** `theme_color` from the RPC is `text`; the
  hook casts to `ThemeSwatch | null`. Unknown / null values render
  no ring (which is the default for this row anyway).
- **No realtime.** If a member is added or removed during a single
  Manage Project visit, the list is stale until the user revisits or
  switches active room. At cap = 2 this is a non-issue (a joiner is
  rare, and joiners typically go to Dashboard, not Manage Project,
  immediately after joining). Filed under §13.
- **Layout regression on small screens.** The new rows use the same
  surface / shadow / padding tokens as `SettingsRow`, so vertical
  rhythm matches the existing sections. 375 px width is the existing
  Dashboard minimum and stays usable.

## 13. Manual QA

### 13.1 Two-user room (production behaviour — the only path users hit today)

- [ ] Open Manage Project as the creator. The new Members section
      renders between Project Basics and Saving Controls.
- [ ] Two rows render: creator first, joiner second, in `joined_at
      asc` order.
- [ ] Creator's row shows the "Creator" / "ผู้สร้าง" chip.
- [ ] Joiner's row does NOT show the chip.
- [ ] The caller's own row shows `(You)` / `(คุณ)` after the
      display name.
- [ ] Each row shows the joined-at label in the active locale (EN +
      TH).
- [ ] Avatar image renders when present; fallback initial when not.
- [ ] Invite Code row still opens the invite-code modal.
- [ ] Quick Amounts row still opens its modal.
- [ ] Archive (creator) / Leave (joiner) still works.
- [ ] Switching language from EN → TH (and back) updates every new
      string immediately.
- [ ] Switching active room (via Profile) updates the Members list
      to the new room.
- [ ] **Room switch reset**: be a member of two rooms (A and B) with
      different members. With Manage Project open on room A, switch
      the active room to room B. Throttle the network in DevTools so
      the new fetch is slow. Confirm that the Members list goes
      empty (or shows skeletons) immediately on the switch —
      **never** shows room A's members under room B's title. Once
      the fetch resolves, room B's members appear. Repeat the
      switch back to A and confirm the symmetry.

### 13.2 Solo-creator room (post-create, pre-join)

- [ ] Create a fresh room. Open Manage Project.
- [ ] One row renders (the creator).
- [ ] The "Creator" chip is on that row.
- [ ] The `memberListSoloHint` line ("Share the invite code to add
      your partner." / "แชร์รหัสเชิญเพื่อเชิญคู่ของคุณ") renders
      under the section header.
- [ ] No capacity counter, no "Full" pill.

### 13.3 Reasoned three-user verification (local dev DB only, **not** a production case)

The production cap is 2; we cannot reach this state without bypassing
the trigger. For a local dev DB, temporarily insert a third
`room_members` row by hand and reload Manage Project:

- [ ] Three rows render in `joined_at asc` order.
- [ ] One "Creator" chip on the creator row; none on the other two.
- [ ] No capacity counter is shown.
- [ ] No layout break at 375 px width.

This case exists only to confirm the section degrades gracefully
when the cap is later raised. It is **not** part of the acceptance
criteria for the production cap.

### 13.4 Loading / error

- [ ] Throttle the network in DevTools and reload Manage Project.
      Two skeleton rows render under the section header; the
      section has `aria-busy="true"` while loading.
- [ ] **First-load error** (no prior members): simulate an RPC
      error (e.g. block the network or revoke the RPC grant in a
      dev DB). The danger-toned `memberListErrorBody` renders; no
      skeleton, no rows from any prior load.
- [ ] **Room-switch error**: with Manage Project open on room A and
      a loaded member list, switch to room B and immediately fail
      the fetch for B. Members goes empty (room A's members must
      not stay visible under room B's title); the danger-toned
      `memberListErrorBody` renders.
- [ ] **Same-room refetch error** (forward-looking; manual today,
      automatic once a refetch trigger is added): with a loaded
      member list for room A, trigger a same-room refetch that
      fails. The prior rows for A stay visible; a small danger-toned
      inline banner appears below them with the same error copy.
- [ ] Restore the network; revisit Manage Project. The list
      re-renders cleanly with no leftover error banner.

### 13.5 Other surfaces still untouched

- [ ] Dashboard still renders the existing N-aware leaderboard from
      Task 33; no visible change.
- [ ] Saving Plan page is unchanged.
- [ ] Add Money page is unchanged.
- [ ] Reconcile page is unchanged.
- [ ] Notification Center is unchanged; no new event types fire.
- [ ] Push notifications behave exactly as before.

## 14. Rollback plan

This task ships only client code and locale strings. Rollback is
purely a revert of the Task 34 PR.

If rolled back:
- The Members section disappears from Manage Project.
- Every other Manage Project surface continues to work because the
  PR did not touch the Project Basics, Saving Controls, or Room
  Actions sections.
- The unused new locale keys can stay in `en.ts` / `th.ts` without
  consequence (they are referenced only from the Task 34 page code,
  which the revert removed). If preferred, remove them in the same
  revert PR.
- `room_members_for_room` (migration 0016) is untouched and stays
  in place; it was already used by `useLeaderboard` as a fallback
  before Task 34.

No SQL rollback is needed because no migration was added.

## 15. Risks and follow-ups (filed for next slices)

1. **Member detail navigation (Feature 3 / future Task 35).** The
   `RoomMemberRow` is non-interactive in v1. Adding `onClick` →
   `/members/:userId` is a Feature 3 follow-up; the prop shape
   already accommodates it without a breaking change.
2. **Realtime `room_members` channel.** If product wants the
   Members section to update live when a joiner arrives, add a
   realtime subscription inside `useRoomMembers` (similar to the
   `goals` channel inside `useLeaderboard`). Not required at cap =
   2; track for cap-raise time.
3. **Capacity counter at cap = 7.** When the cap is raised, add a
   "X/Y members" pill to the Members section header and the
   relevant invite copy. This plan deliberately leaves the section
   header simple so the pill drops in without re-shuffling layout.
4. **Hide / disable invite at cap.** Once the cap is raised, the
   audit recommends hiding or disabling the invite row when the
   room is at cap. Today we deliberately do **not** do this (cap =
   2 means every healthy 2-user room is at cap, and the brief says
   keep invite/QR unchanged). Plan this as a cap-raise companion
   change.
5. **`joinPreview` hard-coded `memberCount: 2`** in
   `src/pages/Profile.tsx`, `src/pages/AppLayout.tsx`, and
   `src/pages/MoleculesPreview.tsx`. The audit (S1 / S6) tracks this
   as Medium. Not addressed here; addressed in the cap-raise slice
   or its own small follow-up so the join preview shows the real
   member count instead of the literal `2`.
6. **`copy.manageProject.inviteCodeDesc` wording.** Today reads
   "Share with your partner to join this project". When cap is
   raised, swap to "Share to add members to this project" (EN) /
   equivalent TH. Not touched in this task per audit S6.
7. **Per-member "remove" / creator-transfer actions.** Out of scope
   today; will need their own product + RPC design.
8. **Long display names + RTL safety.** The `truncate` utility
   covers LTR overflow. If the product later supports Arabic /
   Hebrew display names, audit the row's `dir` handling. Not a
   blocker for EN / TH.

---

End of Task 34 plan.
