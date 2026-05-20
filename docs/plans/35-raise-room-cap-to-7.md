# Task 35 — Raise Room Cap From 2 To 7 (constant cap, v1)

Status: Planning only. No code, migrations, or file edits in this
document.
Owner: Senior FE/FS pair (Claude) with Fran.
Source:
- `docs/multi-user-room-feature-plan.md` (Feature 2 only)
- `docs/plans/feature-2-multi-user-rooms-audit.md` (slice S1, the
  cap-raise slice)
- Task 31 (`docs/plans/31-multi-user-notification-fanout.md` and the
  `feat: multi-user notification fan-out (Task 31)` commit `6ff467a`)
- Task 32 (`docs/plans/32-multi-user-data-hooks.md` and the
  `feat: N-safe room/member data hooks (Task 32)` commit `ce4e75f`)
- Task 33 (`docs/plans/33-multi-user-dashboard-ui.md` and the
  `feat(dashboard): N-aware Progress Race + per-member buckets
  (Task 33)` commit `ca47c00`)
- Task 34 (`docs/plans/34-manage-project-member-list.md` and the
  `feat(manage-project): show room member list (Task 34)` commit
  `0073019`)
- `supabase/migrations/0023_two_player_cap.sql`
- `supabase/migrations/0024_fix_join_room_ambiguity.sql`
- `supabase/migrations/0016_rpc_room_members_for_room.sql`
- `src/hooks/useRooms.ts`
- `src/components/JoinProjectFlow/JoinProjectFlow.tsx`,
  `src/components/ProjectPreviewCard/ProjectPreviewCard.tsx`
- `src/pages/AppLayout.tsx`, `src/pages/Profile.tsx`,
  `src/pages/ManageProject.tsx`
- `src/components/RoomContext/RoomContext.tsx`,
  `src/hooks/useRoom.ts`, `src/hooks/useRooms.ts`
- `src/i18n/locales/en.ts`, `src/i18n/locales/th.ts`
Date drafted: 2026-05-20.

This task finally raises the production room capacity from **2** to a
**constant 7**. It is the first task in which 3+ users can coexist in a
single room outside of dev-only databases.

Tasks 31, 32, 33, and 34 already prepared the surfaces that this cap
raise will exercise: notification fan-out is N-safe, the data hooks
layer exposes `otherMemberIds` / `roomMembersBuckets` /
`roomMembersSavingPlans`, the Dashboard renders an N-aware Progress
Race + per-member buckets, and Manage Project lists every member via
`room_members_for_room`. Task 35 only flips the cap and updates the
small set of surfaces that still hard-code "2": the SQL guard (RPC +
trigger), the client copy/affordance around invite + full-room state,
and the join-preview member chip.

Be conservative. The blast radius of changing a single SQL constant
is small **only** because the previous four tasks were N-safe by
construction. This task therefore does the minimum required to land
the cap raise and nothing else.

---

## 1. Goal

- Replace the hard-coded 2-member cap in SQL with a hard-coded
  7-member cap.
  - DB migration drops `enforce_two_player_cap` + `trg_two_player_cap`
    and replaces them with `enforce_room_capacity` + `trg_room_capacity`,
    cap = 7.
  - `join_room_by_code(code text)` is replaced so it locks the target
    `rooms` row with `for update` before counting/inserting, and so
    the `'full'` branch triggers at `member_count >= 7`. The function still
    `returns table (room_id uuid, status text)` with the same four
    status values (`'not_found'`, `'already_member'`, `'full'`,
    `'joined'`). The client contract is preserved byte-for-byte.
- Update the client capacity copy:
  - `useRooms.joinRoomByCode` no longer returns the English literal
    `'That project already has two players.'` for `status === 'full'`.
    It returns an i18n key that reads "This project already has 7
    members." (EN) / "ห้องนี้มีสมาชิกครบ 7 คนแล้ว" (TH).
  - `JoinProjectFlow` continues to render that error inside its
    existing `OtpField` error slot. No layout change.
- Surface room capacity in Manage Project as a member-count pill
  `${current}/7` next to the "Members" section header (added by
  Task 34). Disable (and only disable — not hide) the existing
  `invite` row when the room is at `7/7`. Cap < 7 leaves the row
  exactly as it is today.
- Make the invite preview honest without adding a public member-count
  lookup. Replace the exact `"2 members"` chip with neutral capacity
  copy (`"Up to 7 members"` / TH equivalent). If QA finds the copy
  too long, shorten the neutral wording; do not return to an exact
  count.
- Add EN + TH strings for the new full-room error, the preview
  capacity hint, the Manage Project capacity pill, and the
  disabled-invite hint. Do not rewrite any existing
  "partner" copy in this task.
- Preserve the behaviour of every existing 2-user room: same number
  of members allowed, same UX, same dashboard, same notifications.
  The cap was a ceiling; we are only raising the ceiling.
- Block the 8th joiner on the canonical join path with a locked RPC
  count/insert sequence, backed by the DB trigger as the direct-write
  safety net and client error copy as UX. Do not overclaim strict
  protection for concurrent direct table inserts unless the trigger
  also receives a proven lock strategy.

## 2. Non-goals (do not touch)

The following are explicitly out of scope for Task 35 and must not
be modified by this task:

- **Per-room configurable caps.** No `rooms.max_members` column, no
  per-room override, no admin UI. The 7 is a SQL constant in the
  trigger and the RPC (option B1 from the feature plan §"Decision B").
  Per-room caps remain a future option; they require their own
  migration + RLS surface review and are not justified for v1.
- **Individual goals / per-member sub-goals (Feature 5).** Each
  member's `goals.target_amount` keeps its current semantics. We do
  not split the room goal into per-member sub-goals in this task.
  `update_room_goal` (migrations 0025 / 0029) is unchanged.
- **Member detail navigation (Feature 3).** Tapping a member row in
  Manage Project or on the Dashboard still navigates nowhere. The
  `/members/:userId` route is a separate future task.
- **Dashboard redesign.** Task 33 already delivered the N-aware
  leaderboard list (`RoomLeaderboardList`) and the per-member
  buckets grouping. Task 35 does not touch `Dashboard.tsx`,
  `RoomLeaderboardList`, `PlayerProgressRow`, `HeadToHeadCard`,
  `MomentumChart`, `SavingRaceChart`, `BucketGrid`, or any chart.
- **Notification fan-out rewrite (Task 31).** `notify_*` RPCs,
  `_smart_check_*`, `_other_room_member`, the
  `notify-partner-deposit` edge function, and any push behaviour
  stay exactly as they are. Task 31 already loops over every other
  room member; the cap change makes those loops longer, not
  semantically different. No edge-function deploy is part of this
  task.
- **Data hooks layer (Task 32).** `useRoomOtherMemberIds`,
  `useRoomMembersBuckets`, `useRoomMembersSavingPlans`,
  `usePartnerBuckets`, `usePartnerSavingPlan`, `useLeaderboard`,
  `DataContext` shape — none of them change. Task 35 reads from
  existing hooks only (specifically the Task 34 member-list hook in
  Manage Project).
- **Task 34 member list rendering.** The `RoomMemberRow` component,
  the `RoomMembersSection`, and the member-list hook ship in Task 34
  unchanged. Task 35 adds **one** new visual element — the
  `${current}/7` pill in the section header — and **one** behaviour
  change — disabling the existing `invite` settings row at `7/7`.
  No row-level layout changes.
- **Public invite-code member-count lookup.** Do not add a new public
  member-count RPC, do not expose member identities before join, and
  do not wire the preview to `room_members_for_room` (that RPC is
  post-join/member-scoped). The join preview is changed only enough
  to stop claiming an exact count: replace the current `"2 members"`
  chip with neutral capacity copy (`"Up to 7 members"` / TH
  equivalent).
- **The "Invite Code" row copy.** `copy.manageProject.inviteCodeDesc`
  ("Share with your partner to join this project" / TH equivalent)
  is left as-is for now. The audit's copy cleanup slice (S6) will
  replace the word "partner" across the app; we don't bundle that
  here. Task 35 only adds a *disabled* hint string for the 7/7 case.
- **`bootstrap_joiner_goal`** (migration 0017) is not touched. It is
  already idempotent and runs on every successful join; it works
  identically for member 2 and member 7.
- **`active_room_for_creator`** (no-arg) is not touched. The
  "one active room per creator" rule remains exactly as it is.
- **RLS / `room_members_select`.** No policy edits. The cap raise is
  a *capacity* change, not a *visibility* change. `room_members_select`
  in migration 0012 already returns every co-member's row to every
  member, with no exact-two assumption.
- **Real-time channels.** No new realtime subscriptions for member
  count changes. ManageProject already revalidates the member list
  on visit / refresh via the Task 34 hook; that cadence is enough
  for the disabled-invite affordance to settle within one navigation.
- **Reactions / Nudges / Reconcile / Streak Freeze.** All untouched.
  Reactions today are room-scoped (not user→user) per the feature
  plan §"Cross-feature context"; that decision stays for v1.
- **Web Push transport** (no VAPID changes, no new push payload
  fields).
- **`enqueue_plan_start_notifications`** (Task 30, migration 0054).
  Owner-only, N-irrelevant.

## 3. Current cap surfaces to replace

The cap is enforced today in the database and surfaced in a small set
of client affordances. Task 35 changes only the surfaces below.

### 3.1 DB trigger (server-side safety net)

File: `supabase/migrations/0023_two_player_cap.sql`.

```sql
create or replace function public.enforce_two_player_cap()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
begin
  select count(*) into current_count
  from public.room_members
  where room_id = new.room_id;
  if current_count >= 2 then
    raise exception 'room is full (2-player cap)' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_two_player_cap on public.room_members;
create trigger trg_two_player_cap
  before insert on public.room_members
  for each row execute function public.enforce_two_player_cap();
```

What it guarantees today: an ordinary direct `insert into
room_members` that would push the row count above 2 fails with
`P0001`. This is the last line of defense for non-concurrent bypasses
— if the RPC is bypassed (REST API, future RPC that forgets the
check, a SQL console fat-finger), this trigger still rejects the
write once the room is already full. It is not, by itself, a strict
concurrent direct-insert lock; see §8.2.

What needs to change in Task 35: the constant `2` becomes `7`. The
function rename (`enforce_two_player_cap` → `enforce_room_capacity`)
and the trigger rename (`trg_two_player_cap` → `trg_room_capacity`)
are cosmetic but worth doing now to avoid an outdated symbol name
lingering in `pg_proc` after the cap moves.

### 3.2 DB RPC (canonical join path)

File: `supabase/migrations/0024_fix_join_room_ambiguity.sql` (which
supersedes 0023's version of the same function).

```sql
-- Enforce the 2-player cap.
select count(*) into member_count
from public.room_members rm
where rm.room_id = target_room_id;

if member_count >= 2 then
  return query select target_room_id, 'full'::text;
  return;
end if;
```

What it guarantees today: every `useRooms.joinRoomByCode` call that
would push the room over 2 returns `{ room_id, status: 'full' }`
instead of inserting. The `returns table (room_id uuid, status text)`
shape, the `'not_found'` / `'already_member'` / `'full'` / `'joined'`
status values, and the table-qualified column references from 0024
are all part of the client contract and must be preserved.

What needs to change in Task 35:
- The constant `2` becomes `7`.
- After `target_room_id` is found and before any membership count or
  insert, lock the target room row:

```sql
perform 1
from public.rooms r
where r.id = target_room_id
for update;
```

This serializes concurrent `join_room_by_code` calls for the same
room under read-committed isolation. At a 6/7 boundary, the first
caller obtains the lock, counts 6, inserts member 7, and commits; the
second caller then obtains the lock, counts 7, returns `'full'`, and
does not insert. The RPC's return shape, statuses, invite-code lookup,
table-qualified references, and `bootstrap_joiner_goal` behaviour are
otherwise preserved.

### 3.3 Client copy (UX message for `status === 'full'`)

File: `src/hooks/useRooms.ts:178–179`.

```ts
if (status === 'not_found' || !roomId) return { error: 'No project found for that code' };
if (status === 'full') return { error: 'That project already has two players.' };
```

What it guarantees today: a 2-member room shows the literal
"That project already has two players." in the `JoinProjectFlow`
`OtpField` error slot (`src/components/JoinProjectFlow/JoinProjectFlow.tsx:34`).

What needs to change in Task 35: the literal becomes an i18n lookup
(`copy.joinProject.roomFullError`), reading "This project already has
7 members." (EN) / "ห้องนี้มีสมาชิกครบ 7 คนแล้ว" (TH). The
`'not_found'` branch keeps its existing literal (out of scope here);
audit cleanup S6 will move both to i18n in a later pass.

### 3.4 Manage Project invite affordance

File: `src/pages/ManageProject.tsx:239–246`.

```ts
{
  id: 'invite',
  icon: <IconQrCode size={18} />,
  label: copy.manageProject.inviteCodeLabel,
  description: copy.manageProject.inviteCodeDesc,
  meta: <span className="copy-allowed font-mono text-xs text-brand-800">{activeRoom.invite_code}</span>,
  onClick: () => openModal('invite-code'),
},
```

What it guarantees today: every member can always see and open the
invite-code modal, regardless of how full the room is. Inviting an
8th member is rejected at the RPC, which is fine when the cap is 2
but becomes a poor UX once the cap is 7 (a 7/7 room should not
solicit further joiners).

What needs to change in Task 35: when the Task 34 member-list hook
reports `members.length === 7`, the `invite` row's `onClick` is
disabled and its `description` is swapped to the new
`copy.manageProject.inviteCodeFullHint`. The row stays visible (so
the layout does not shift) and the invite code itself stays visible
(useful for legitimate re-share to existing members) but the modal
no longer opens, and the row is rendered in the same disabled style
already used elsewhere in `SettingsRow` (no `onClick` → no chevron,
no hover).

### 3.5 Join preview exact-member chip

Files:
- `src/pages/AppLayout.tsx:264`
- `src/pages/Profile.tsx:360`
- `src/components/ProjectPreviewCard/ProjectPreviewCard.tsx:43`

```ts
memberCount: 2,
```

```tsx
<Chip tone="peach">{copy.joinProject.members(memberCount)}</Chip>
```

What it guarantees today: any syntactically valid invite code preview
shows `"2 members"`, regardless of how many members are actually in
the room. That was tolerable while the cap was 2, but becomes
misleading once rooms can have 3 through 7 members.

What needs to change in Task 35: do **not** add a public
member-count-by-invite RPC. Instead, replace the exact count chip
with neutral capacity copy such as `copy.joinProject.capacityHint`
(`"Up to 7 members"` / TH equivalent). If the English or TH text is
too long in QA, use shorter neutral capacity copy; the preview must
not claim the room has exactly 2 members.

---

## 4. Proposed changes

### 4.1 DB migration — `0056_raise_room_capacity_to_7.sql`

Number assigned during implementation. The plan assumes the next
free integer at implementation time (after
`0055_partner_notification_fanout.sql` from Task 31); land on the
next contiguous number when implementing.

The migration is **additive** in the schema sense (no column drops,
no row deletes, no policy churn) but **replaces** two named SQL
objects: the trigger function and the RPC.

Migration outline (described, **not** committed as SQL in this doc):

1. Wrap the migration in a single `begin; … commit;` block so the
   trigger swap and the RPC swap land atomically. A half-applied
   migration would either leave a stale `'2'` constant in one of the
   two layers or, worse, leave the trigger dropped with no
   replacement.
2. Drop the existing `trg_two_player_cap` trigger
   (`drop trigger if exists trg_two_player_cap on public.room_members;`).
   `if exists` keeps the migration re-runnable on environments where
   it has already been applied or where 0023 was never applied.
3. Drop the existing function
   (`drop function if exists public.enforce_two_player_cap();`).
4. Create the new function `public.enforce_room_capacity()` with the
   same shape as 0023's function but `if current_count >= 7 then
   raise exception 'room is full (7-member cap)' using errcode =
   'P0001';`. Use the same `language plpgsql`, no `security definer`
   (matches the existing trigger function — triggers do not need
   security-definer to read `room_members`).
5. Create the new trigger
   `create trigger trg_room_capacity before insert on
   public.room_members for each row execute function
   public.enforce_room_capacity();`.
6. Drop the existing `public.join_room_by_code(text)` function
   (`drop function if exists public.join_room_by_code(text);`,
   matching 0023 / 0024's pattern of drop-then-create rather than
   `create or replace` because the function returns a `table`).
7. Recreate `public.join_room_by_code(code text)` from the 0024 body
   with two intentional changes:
   - After the invite-code lookup succeeds and before checking
     membership count or inserting, lock the target room row:
     `perform 1 from public.rooms r where r.id = target_room_id for
     update;`.
   - Change the cap branch to
     `if member_count >= 7 then return query select target_room_id,
     'full'::text; return; end if;`.
   Every other line — the table alias `rm`, the `upper(trim(code))`
   lookup, the `is_existing_member` check, the `bootstrap_joiner_goal`
   reliance on a successful insert — stays identical.
8. Re-`grant execute on function public.join_room_by_code(text) to
   authenticated;` after the create (re-grant is necessary because
   the drop wiped the grant).
9. No data backfill. No row updates. No `update rooms set …`.
   Existing rooms already have ≤ 2 members; raising the ceiling does
   not require any per-row work.

Why drop+create instead of `create or replace`:
- For the **trigger function**, `create or replace function` would
  work syntactically (no return-type change), but we are also
  renaming the function (`enforce_two_player_cap` →
  `enforce_room_capacity`). A `create or replace` cannot rename, so
  we must drop the old function. To drop the old function we must
  first drop the trigger that depends on it. Drop-then-create is
  the cleanest sequence and the same pattern 0023 used.
- For the **RPC**, `create or replace` cannot change the symbol's
  return shape. The shape is unchanged in this migration (still
  `returns table (room_id uuid, status text)`), but matching the
  drop+create pattern from 0024 keeps the migration shape
  consistent and avoids a future surprise if anyone re-edits the
  return columns later.

Why not introduce `rooms.max_members`:
- The feature plan §"Decision B" recommended option B1 (constant
  cap) for v1 because it has zero schema churn and exactly one
  source of truth (the SQL literal `7`). A per-room column adds an
  RLS surface (who can change a room's cap?), an admin UX (how is
  it edited?), and a backfill (what value do existing rooms get?).
  None of these are justified before we have any product signal that
  rooms need configurable caps. The feature plan's hard rule for
  Task 35 reinforces this: "Use constant cap = 7 for v1. Do not add
  rooms.max_members."

Why hard-code the constant in two SQL sites rather than centralize
in a helper:
- The two sites that read the cap are the trigger function and the
  RPC, both inside the same migration. Adding a helper
  (`current_setting('app.room_capacity')`, a small SQL function, or
  a one-row `app_config` table) would introduce a dependency
  surface for one literal that already only appears twice. Keeping
  `7` inline is the simplest reversible change. If the cap ever
  needs to move again, a small migration replaces both sites at
  once.

Why lock the `rooms` row in the RPC:
- The canonical client path is `join_room_by_code`, not direct
  `insert into room_members`. Locking one parent `rooms` row is the
  smallest reliable serialization point for concurrent joins to the
  same room: no schema change, no advisory-lock naming scheme, no
  retry loop, and no return-contract change. It only contends when
  two users are joining the same room at the same time.
- The lock must be taken before the `count(*) from room_members` and
  before the insert. Otherwise two concurrent joins at 6/7 can both
  read 6 and both insert.
- This lock guarantees strict 8th-user blocking only for code paths
  that use `join_room_by_code` or otherwise take the same parent-row
  lock before count/insert. It does not, by itself, make the trigger
  strict for two concurrent direct table inserts that bypass the RPC.

### 4.2 Client capacity logic

Four small client-side changes, all behind i18n keys.

#### 4.2.1 `useRooms.joinRoomByCode` full-room error

`src/hooks/useRooms.ts:179` currently returns
`{ error: 'That project already has two players.' }` for the `'full'`
status. The replacement returns
`{ error: copy.joinProject.roomFullError }`.

To do this without restructuring the hook signature, the simplest
shape is to import `useI18n` inside `useRooms` and read `copy` from
it. Verify before implementing that `useRooms` is mounted underneath
the `I18nProvider` (it is — `RoomProvider` wraps `Routes` and so
does the i18n provider, per `src/App.tsx`). If for any reason that
ordering is fragile, the alternative is to pass the error code as a
status string (`'full'`) and let the call site translate. We prefer
the in-hook `useI18n` approach to keep the call sites unchanged.
This is a small judgment call to confirm at implementation time;
either approach is acceptable as long as the **error rendered in the
UI** comes from the EN/TH locale and not from a hard-coded English
literal.

The `'not_found'` branch (`'No project found for that code'`) is
**not** moved to i18n in this task. That cleanup belongs to audit
slice S6; bundling it here would expand the touch surface for no
new capability.

#### 4.2.2 `JoinProjectFlow` full-room message

No code change inside `JoinProjectFlow.tsx` itself. The full-room
copy is already wired through the `error` prop from
`useRooms.joinRoomByCode` → call sites
(`src/pages/AppLayout.tsx:218`, `src/pages/Profile.tsx:267`) →
`JoinProjectFlow`'s `OtpField` error slot. Replacing the hard-coded
English string with an i18n lookup (above) is sufficient.

Verify in QA that the error renders in both EN and TH and stays
under the `OtpField` width on a 375 px viewport (no wrapping issues
for "ห้องนี้มีสมาชิกครบ 7 คนแล้ว" — TH glyphs are wider; if it
wraps, shorten the TH copy to "ห้องนี้เต็มแล้ว (7/7)").

#### 4.2.3 `joinPreview` capacity hint

The current preview path passes `memberCount: 2` from
`AppLayout.tsx:264` and `Profile.tsx:360` into
`ProjectPreviewCard`, which renders `copy.joinProject.members(2)` as
an exact `"2 members"` chip. After cap = 7, that exact claim is
misleading for rooms with 3 through 7 members.

Chosen smallest safe fix: keep the preview unauthenticated and
non-fetching, but make the chip neutral. Replace the exact count with
`copy.joinProject.capacityHint` ("Up to 7 members" / TH equivalent).
Remove `memberCount` from the preview object and
`ProjectPreviewCardProps`, then render
`<Chip tone="peach">{copy.joinProject.capacityHint}</Chip>`.

Do **not** add a public member-count RPC, do not expose member
identities, and do not call `room_members_for_room` before the user
has joined. The preview can say what the room supports; it must not
pretend to know the room's exact current count.

### 4.3 Manage Project capacity display

Builds directly on Task 34's "Members" section, which renders one
`RoomMemberRow` per row returned by `room_members_for_room`. Task 35
adds two and only two changes inside `ManageProject.tsx` (no edits
to `RoomMemberRow`):

#### 4.3.1 Member-count pill `${current}/7`

Add a small inline `<Chip>` next to the "Members" `SectionLabel`
showing the current count over the constant cap. The Chip uses
`tone="peach"` (the same tone Task 34 uses for the creator badge)
when `current < 7`, and `tone="white"` (a neutral tone) when
`current === 7` — the room is full, the pill is informational and
should not draw the eye like a CTA.

Pill content:
- EN: `${current}/7`
- TH: `${current}/7`

Yes, the number is the same in both locales; we only render it via
the locale to keep the helper signature consistent with §4.3.2.

Encoded as `copy.manageProject.memberCapacity(current)` which
returns the formatted `${current}/7` string. Centralizing the `7`
in the locale (instead of `${current}/${ROOM_CAP}`) avoids leaking
a magic-number constant into `ManageProject.tsx`. If the cap ever
moves again, a single locale edit + a single SQL migration covers it.

Visibility: render the pill whenever the member list has loaded
(`members.length > 0`). Skip the pill while the list is still
loading (skeleton state) and on the error fallback — Task 34
already defines these states.

#### 4.3.2 Disabled-invite hint at 7/7

Inside the `projectBasicsItems` list, the `invite` row currently
sets `onClick: () => openModal('invite-code')` unconditionally. With
the cap raise, this row must become inert at `7/7`.

The change:
- Read `isRoomFull = members.length === 7` from the same member-list
  hook that powers the pill. (Loading / error states are not full
  — treat them as `< 7` to avoid blocking the row during a slow
  fetch.)
- When `isRoomFull` is true:
  - Set `onClick: undefined` so `SettingsRow` falls back to its
    non-interactive style (no chevron, no hover, no scale-on-press).
  - Swap `description` from
    `copy.manageProject.inviteCodeDesc` to
    `copy.manageProject.inviteCodeFullHint` ("Project is full
    (7/7). No more members can join." / TH equivalent — see §4.4).
  - Keep `label`, `icon`, and the `meta` invite-code span exactly as
    they are — the code remains visible so it can still be shared
    for, e.g., audit recovery, but the modal cannot be opened.
- When `isRoomFull` is false (the common case for 2- to 6-member
  rooms): no behaviour change. Row renders exactly as today.

Why disable instead of hide:
- Hiding would shift the section layout when a room transitions from
  6/7 → 7/7. Disabling preserves the row position and is consistent
  with the rest of the `SettingsList` (other rows degrade to
  non-clickable rather than disappear).
- The invite code itself remains visible — useful if a current
  member needs to copy the code for record-keeping even when no new
  members can join.

What is **not** done in this task:
- No QR code render change. The existing invite-code modal is the
  only "QR-equivalent" surface in the app today (the IconQrCode is
  decorative; the modal shows the code as text, not a QR). The
  feature plan mentions QR availability; the actual QR generation
  is not in the current codebase and is not added by this task.
- No 6/7 "almost full" warning. The feature plan didn't ask for one
  and we don't add unprompted UI.

### 4.4 i18n EN/TH

Four new locale keys. Add to **both** `src/i18n/locales/en.ts` and
`src/i18n/locales/th.ts` under their existing top-level groups.

| Key | EN | TH | Notes |
| --- | --- | --- | --- |
| `copy.joinProject.roomFullError` | `"This project already has 7 members."` | `"ห้องนี้มีสมาชิกครบ 7 คนแล้ว"` | Replaces the hard-coded literal in `useRooms.joinRoomByCode`. Used by `JoinProjectFlow` error slot. |
| `copy.joinProject.capacityHint` | `"Up to 7 members"` | `"รองรับสมาชิกสูงสุด 7 คน"` | Replaces the exact `"2 members"` preview chip. This is neutral capacity copy, not a fetched count. |
| `copy.manageProject.memberCapacity` | `(current: number) => \`${current}/7\`` | `(current: number) => \`${current}/7\`` | Member-count pill in the Manage Project "Members" section header. Function form keeps the call site type-safe with no `any`. |
| `copy.manageProject.inviteCodeFullHint` | `"Project is full (7/7). No more members can join."` | `"ห้องนี้เต็มแล้ว (7/7) เชิญสมาชิกเพิ่มไม่ได้"` | Replaces `inviteCodeDesc` only when `isRoomFull` is true. The original description remains for `< 7`. |

Translation notes:
- Keep the `(7/7)` numeral inside the TH copy. The audit confirmed
  rooms always use Western Arabic numerals across the app (`1/7`,
  `2/7`, currency amounts) — staying consistent.
- "members" → "สมาชิก" matches the existing
  `joinProject.members(count)` translation.
- "Project is full" → "ห้องนี้เต็มแล้ว" matches the conversational
  tone used in `leaveConfirmBody` (TH 470). If the TH copy reads
  awkwardly to the team during QA, prefer "เต็มแล้ว" / "ครบ
  7 คนแล้ว" over a literal "Project" translation; the meaning
  ("can't add more") is what must survive.

Strings explicitly **not** added in this task:
- No exact member-count string for the join preview. The preview gets
  only neutral capacity copy because there is no public count lookup.
- No edit to `inviteCodeDesc` ("Share with your partner to join
  this project" / TH equivalent). Copy cleanup of the word
  "partner" is audit slice S6.
- No new "almost full" or "6/7" warning copy.

### 4.5 Backward compatibility for existing 2-user rooms

The most important property of this migration is that existing 1- and
2-member room workflows keep behaving the same. The only intentional
visible differences are capacity-related: the Manage Project pill and
the neutral invite-preview capacity hint.

What stays exactly the same for current rooms:
- A 1-user room continues to render its single `PlayerProgressRow`
  on the Dashboard (Task 33 already supports the 1-member case).
- A 2-user room continues to render its two `PlayerProgressRow`s
  exactly as today. The Progress Race layout and per-member buckets
  grouping from Task 33 reduce to the legacy 2-up shape at
  N = 2 by construction.
- The "Members" section in Manage Project renders the same two
  rows (creator first, joiner second). The new `${current}/7` pill
  reads `2/7`, which is informational and does not change row
  layout.
- The `invite` row in Manage Project stays interactive — `2 < 7`,
  so the row keeps its `onClick`, the existing description, and the
  modal opens as today. **A 2-user room must look identical to its
  pre-Task-35 self except for the new `2/7` pill in the section
  header and the join preview's neutral capacity hint replacing the
  old fake `"2 members"` chip.**
- A non-member opening the same invite code still receives the
  `'joined'` status from `join_room_by_code`. The third joiner is
  now allowed (this is the intended behaviour change). The fourth
  through seventh joiners are likewise allowed. The eighth is
  rejected.
- Existing notifications continue to fire on every membership /
  deposit / plan / goal / bucket / balance event for every other
  member (Task 31 fan-out). No new event types and no new push
  payload fields.

What changes intentionally for existing rooms:
- A 2-user room can now accept a 3rd, 4th, …, 7th member by invite.
  This is the entire point of Task 35. Existing creators should
  consider this an opt-in (they choose whether to share the code
  further); we do **not** ship a "your project can now have more
  members" toast or banner. (If product later asks for one, it is a
  follow-up — not a hidden surface in this task.)

Data migrations: none. The cap is a write-time check; existing data
already satisfies the new (looser) constraint, so no backfill is
required.

## 5. Acceptance criteria

The cap raise lands successfully if and only if all of the following
hold:

DB layer:
- A 7-member room **rejects** a non-concurrent 8th direct
  `insert into public.room_members (room_id, user_id) values (…,
  …);` with Postgres error code `P0001` and the literal "room is
  full (7-member cap)".
- `select * from public.join_room_by_code('CODE');` on a 7-member
  room returns one row `{ room_id, status: 'full' }` and does **not**
  insert.
- `select * from public.join_room_by_code('CODE');` on a 0-, 1-, 2-,
  3-, …, 6-member room returns `{ room_id, status: 'joined' }` and
  inserts exactly one `room_members` row.
- Two concurrent `join_room_by_code('CODE')` calls against the same
  6-member room serialize on the locked `rooms` row. Exactly one
  call returns `'joined'`, the other returns `'full'`, and the final
  `room_members` count is 7. This strict concurrent guarantee applies
  to the RPC path, not to direct table inserts that bypass the RPC.
- The RPC's return columns and status values are unchanged
  (`room_id uuid`, `status text` ∈ `{not_found, already_member, full,
  joined}`). The `useRooms` client requires no shape change.

Client layer:
- `useRooms.joinRoomByCode` returns
  `{ error: copy.joinProject.roomFullError }` (not the old English
  literal) for `status === 'full'`. The string surfaces inside
  `JoinProjectFlow` exactly where the old one did and respects the
  active locale.
- A user in EN locale sees "This project already has 7 members." in
  the `OtpField` error slot when trying to join a full room. A user
  in TH locale sees "ห้องนี้มีสมาชิกครบ 7 คนแล้ว" (or the
  fallback copy if shorter wording was chosen during QA per §4.2.2).
- `ManageProject` renders a `${current}/7` pill in the "Members"
  section header for any room where the list has loaded. The pill
  reads `1/7`, `2/7`, `3/7`, … `7/7` as members join.
- The `invite` row on `ManageProject` is interactive for `< 7`
  members and inert for `7/7`. Inert means: `onClick` is `undefined`,
  the `description` reads `inviteCodeFullHint`, and the invite-code
  modal does not open on tap.
- The invite preview in both `AppLayout` and `Profile` no longer
  renders `copy.joinProject.members(2)` or any exact `"2 members"`
  claim. It renders neutral capacity copy
  (`copy.joinProject.capacityHint`).

End-to-end:
- A 2-user room behaves identically to its pre-Task-35 self at every
  surface (Dashboard, ManageProject, notifications) except for the
  new `2/7` pill on ManageProject and the invite preview's neutral
  capacity hint replacing the old fake exact count.
- A fresh 1-user room can accept exactly 6 more joins (members 2
  through 7) via the invite code. The 8th attempt produces the
  full-room error and no row insert.
- Every notification path (`notify_partner_deposit`,
  `notify_balance_checked`, `notify_room_joined`, …) continues to
  fan out to every other current room member after the cap raise;
  no notification is dropped or duplicated.
- The Dashboard renders 1, 2, 3, …, 7 `PlayerProgressRow`s as the
  member count grows. The Progress Race layout from Task 33 stays
  readable at every N (Task 33 already covered the N = 1, 2, 3, 7
  cases in its own QA; we re-verify in §6).
- The Manage Project "Members" section renders 1, 2, 3, …, 7 rows
  with the creator badge on the room's `created_by` user (Task 34's
  contract).

Lint / typecheck / build:
- `npm run lint` passes on the touched files.
- `npm run build` succeeds.
- No new TypeScript `any`. The new locale keys are exact-typed (one
  full-room string, one preview-capacity string, one
  `(current: number) => string`, and one disabled-invite string).
- No CSS Modules added, no new top-level folders.

## 6. Manual QA

Run all of the following against a dev database with the new
migration applied. Production verification is by smoke-test on a
single fresh room after deploy.

### 6.1 1-user room (creator alone)

- [ ] Create a fresh room. Manage Project "Members" section shows
      one row (creator with `(You)` suffix and the creator badge).
- [ ] The capacity pill in the section header reads `1/7`.
- [ ] The `invite` row is interactive. Tapping opens the
      invite-code modal. Copy-to-clipboard works.
- [ ] Typing this room's invite code into the join preview from
      `AppLayout` and `Profile` shows neutral capacity copy ("Up to
      7 members" / TH equivalent); it does **not** show "2 members".
- [ ] Dashboard shows one `PlayerProgressRow` (caller).
- [ ] All notification preferences still load; no notifications
      fan-out occurs for solo actions (no recipients).

### 6.2 Existing 2-user room (regression)

- [ ] Open a room with exactly 2 members (created before the
      migration). Manage Project shows two rows in the "Members"
      section, the creator first.
- [ ] The capacity pill reads `2/7`.
- [ ] The `invite` row is still interactive (2 < 7). Copy works.
- [ ] The join preview for the room code does not claim "2 members";
      it uses the neutral capacity hint instead.
- [ ] Dashboard renders the same Progress Race layout as
      pre-migration. No layout regressions vs. a screenshot taken
      before the merge.
- [ ] A deposit by member A still produces an in-app notification
      and a push notification for member B (Task 31 path).
- [ ] Renaming the room (creator only) still fans out a
      `room_renamed` notification to member B (Task 29 path).

### 6.3 3-user room (new path, first time in production)

- [ ] From the 2-user room above, share the code with a third
      account. The third account's `join_room_by_code` call returns
      `status: 'joined'` and the third member appears in Manage
      Project.
- [ ] Capacity pill reads `3/7`. Invite row remains interactive.
- [ ] The join preview still avoids exact member-count copy. It must
      not say "2 members" or "3 members" because no public count is
      fetched before join.
- [ ] Dashboard renders three `PlayerProgressRow`s sorted by saved
      desc, with the leader badged (Task 33 contract).
- [ ] Per-member buckets section on the Dashboard renders one
      collapsible block per other member (members B and C from A's
      view).
- [ ] Member A makes a deposit. Member B and member C both receive
      in-app + push notifications (Task 31 fan-out — verify both
      inserts, not just the first).
- [ ] Member A reconciles their balance. Reconcile remains
      personal: members B and C see no Verified Balance details for
      A; only the sanitized
      `partner_activity` notification (Task 31).
- [ ] Member C leaves. Manage Project re-renders with two rows and
      a `2/7` pill. Member A and member B receive `room_left`
      notifications.

### 6.4 7-user room (full cap)

- [ ] Invite four more accounts so the room reaches 7 members.
- [ ] Capacity pill reads `7/7`.
- [ ] Invite row is inert. The `description` reads
      `inviteCodeFullHint` (EN/TH per locale). Tapping the row
      does **not** open the modal.
- [ ] The invite code itself is still visible in the row's `meta`
      slot.
- [ ] Dashboard renders seven `PlayerProgressRow`s. The list is
      still readable at 375 px viewport width; scroll if necessary.
      No row is clipped or truncated below readability.
- [ ] A deposit by member A produces in-app + push notifications
      for members B through G. Verify exactly six rows inserted
      into `notifications` for that single deposit (per Task 31).
- [ ] Member G leaves. Capacity pill drops to `6/7`. Invite row
      becomes interactive again. The modal opens on tap.

### 6.5 8th joiner blocked

- [ ] With the room at `7/7`, a fresh account types the invite code
      into `JoinProjectFlow`. After tapping Join, the
      `OtpField` error slot reads
      `copy.joinProject.roomFullError` ("This project already has
      7 members." / TH equivalent).
- [ ] `select count(*) from public.room_members where room_id = $1;`
      stays at 7 — no row was inserted.
- [ ] `select * from public.join_room_by_code('CODE');` in a SQL
      console returns one row with `status = 'full'` and no insert.
- [ ] Race test the canonical RPC path from a 6-member room: start
      two fresh accounts joining the same invite code at the same
      time. Final count is 7; one result is `joined`, the other is
      `full`. This verifies the `rooms ... for update` lock.
- [ ] Attempting to directly `insert into public.room_members
      (room_id, user_id) values ($1, $2);` as a 7-cap-bypass test
      raises `P0001 room is full (7-member cap)`. (This is the
      trigger; the RPC is bypassed in this non-concurrent test.)

### 6.6 Cross-cutting (every existing surface still works)

- [ ] Notification preferences UI (Profile) is unchanged. Toggling
      `partner_activity_enabled` still gates the fan-out for the
      toggling user.
- [ ] Manage Project member list (Task 34) still loads, refreshes
      on revisit, and shows the creator badge correctly.
- [ ] Dashboard Progress Race (Task 33) renders correctly at N = 1,
      2, 3, 7. Tied scores still render the "tied" badge per Task
      33's own contract.
- [ ] Saving Plan + Verified Balance islands stay personal — no
      partner's plan or balance leaks onto another member's
      Dashboard.
- [ ] Bucket floor check (`update_room_goal` from migration 0029)
      still rejects lowering the room goal below the maximum
      bucket-total across all members. Now exercised against up to
      7 members.
- [ ] `npm run lint` and `npm run build` pass.
- [ ] Both EN and TH locales render the new strings without
      truncation at 375 px width.

## 7. Rollback plan

The migration is a single transaction. Three rollback levels exist,
ordered from least to most disruptive.

### 7.1 Soft rollback (recommended for non-data issues)

Symptoms: cosmetic UX regression, wrong copy, capacity pill
miscount, but **no** structurally bad rooms.

Action:
1. Revert the frontend PR (or the locale change alone if the issue
   is a typo). The trigger / RPC stay in place — they are
   data-protective and not the source of the bug.
2. Database stays on the cap = 7 trigger; no rooms become invalid.

### 7.2 Hard rollback to cap = 2

Symptoms: the cap raise itself proves unsafe (e.g., a fan-out
regression discovered only in 3+ user rooms despite Task 31). We
need the cap back to 2 while we investigate.

Action:
1. Ship a forward-only revert migration `0057_revert_room_cap_to_2.sql`
   (number assigned at implementation time). The revert:
   - Drops `trg_room_capacity` + `enforce_room_capacity()`.
   - Recreates `trg_two_player_cap` + `enforce_two_player_cap()`
     exactly as in 0023, with the `>= 2` constant.
   - Replaces `join_room_by_code(text)` with the 0024 body
     (`member_count >= 2 → 'full'`).
2. Important caveat: rooms that already grew beyond 2 members are
   **not** mutated by this revert. They continue to exist with 3+
   members; they just cannot accept any further joins. This is
   acceptable for an emergency rollback: existing members are not
   booted, but new joins fail (with the old "two players" copy,
   because the i18n revert in step 3 would restore that string).
3. Revert the frontend PR so `useRooms.joinRoomByCode` returns the
   old English literal for `'full'` and `ManageProject` stops
   rendering the `${current}/7` pill. The Task 34 member list
   continues to render — that survives unchanged.
4. Communicate to product: any rooms with 3–7 members are now
   read-only for joins. Decide whether to archive them, ask members
   to leave, or wait for the next fix-forward.

Why no `delete from room_members` to "downsize" existing rooms:
- That would mutate user data without consent and break Money
  Rails: a removed member's `savings_logs` are still positive
  history. Per `CLAUDE.md`, financial history is not mutated. The
  rollback leaves over-cap rooms alone and accepts the "no new
  joins" consequence.

### 7.3 Schema-level recovery (worst case)

Symptoms: the migration itself failed mid-transaction (extremely
unlikely with `begin; … commit;`) and left the DB without the
trigger.

Action:
1. Re-apply the migration. It is idempotent: every `drop` uses
   `if exists`, every `create` is a fresh create that fails loudly
   if the object exists (catch the error, drop the object, re-apply).
2. If the trigger is missing because of a failed mid-transaction
   state, the `room_members` table is unprotected against direct
   inserts. The RPC still enforces the cap, so authenticated
   client traffic is fine. Direct inserts (REST / SQL console) are
   the risk; lock those down by running the migration manually as
   soon as possible.

## 8. Risks

Ordered by likelihood × impact, highest first.

### 8.1 A "partner" assumption survived Tasks 31–34

Likelihood: low (the audit, Task 31, Task 32, Task 33, and Task 34
collectively combed through every "partner" usage). Impact: high.

If any RPC, edge function, trigger, or hook still assumes exactly
one "other" user (e.g., `_other_room_member` lingering in a code
path Task 31 missed, or a `usePartner*` caller that Task 32 left
shaped for one user), then 3+ user rooms will silently lose
notifications or display only one other member's data.

Mitigation:
- §6.3 (3-user room) and §6.4 (7-user room) QA exercises the
  fan-out and the data layer end-to-end. A missing notification or
  a missing other-member's buckets at N ≥ 3 will surface here.
- Keep the `_smart_check_overtaking` helper in the back of the
  reviewer's mind. Task 31 explicitly left it alone (its N-player
  semantics is a product decision). At N = 3+ it will compare the
  actor against one arbitrary other member; this is a known
  limitation, not a new bug introduced by Task 35. Track as a
  follow-up but do not let it block the cap raise.
- If a regression appears, prefer the §7.2 hard rollback and
  forward-fix in a follow-up rather than hot-patching under load.

### 8.2 Race-condition on the 7→8 boundary

Likelihood: low. Impact: medium (one over-cap row sneaks in).

The canonical join path is fixed in Task 35: `join_room_by_code`
locks the target `rooms` row `for update` before counting
`room_members` and before inserting. Under read-committed isolation,
two concurrent RPC joins at 6/7 serialize on that row lock. The first
join can insert member 7; the second counts after the first commits
and returns `'full'`. This is the strict guarantee this task claims.

The trigger remains a direct-write safety net, but the inherited
trigger-only pattern is not a strict concurrent guarantee by itself.
`enforce_room_capacity` reads `count(*) from room_members` inside a
`before insert` trigger. Two direct table inserts that bypass the RPC
and do not take the same parent `rooms` row lock could both see
`count = 6`, both pass the `< 7` check, and both succeed — leaving
the room at 8 members.

Mitigation analysis:
- The product and client join path uses `join_room_by_code`, so the
  realistic 7→8 race is covered by the parent-row lock.
- The trigger still blocks ordinary bypass mistakes: a direct insert
  into an already-7-member room fails with `P0001`.
- Making the trigger itself strict for concurrent direct inserts
  would require every direct writer to take the same parent-row lock
  or moving the lock into the trigger. A trigger can attempt to lock
  `public.rooms` by `new.room_id`, but this needs careful review for
  lock ordering against existing room-update code before we rely on
  it as a universal invariant. That is larger than the minimal cap
  raise unless implementation review proves it safe.

Decision: guarantee strict concurrent blocking for `join_room_by_code`.
Document the trigger as best-effort under concurrent direct table
inserts unless the implementation adds and verifies a safe trigger
lock strategy. Acceptance criteria must not claim more than that.

### 8.3 `room_members_for_room` view returning stale counts

Likelihood: low. Impact: low (cosmetic).

`ManageProject` reads members via the Task 34 hook, which calls
`room_members_for_room`. If a member joins or leaves while the page
is open, the pill and the disabled-invite affordance won't update
until the next refetch. In the worst case, a `6/7` room could
briefly render as interactive and let the user open the invite
modal even though the DB just accepted a 7th member elsewhere — the
RPC still rejects the next join, so no over-cap happens.

Mitigation:
- Task 34's hook already revalidates on revisit; that is enough for
  a Manage Project page that is rarely open for hours.
- We do **not** add a realtime subscription for this in Task 35.
  (Filed as a follow-up under §9.)

### 8.4 TH copy length for the full-room error

Likelihood: medium (TH glyphs are wider than EN). Impact: low (the
error wraps to two lines; ugly but not broken).

Mitigation:
- §4.2.2 already calls out a shorter fallback ("ห้องนี้เต็มแล้ว
  (7/7)") to use during QA if the long form wraps at 375 px.
- Decision point at QA time; the migration and the SQL pieces are
  unaffected.

### 8.5 Members below the cap during QA

Likelihood: medium (dev databases have few test accounts). Impact:
low (QA gaps, not a production bug).

Mitigation:
- Maintain at least 7 service-role-seeded test profiles in the dev
  Supabase project so §6.4 (7-user room) and §6.5 (8th joiner
  blocked) are executable without manual account creation each
  pass.
- If only 4 accounts are available, the QA still covers §6.1 / §6.2
  / §6.3 and partial §6.4 (4/7). Document the gap in the PR rather
  than skipping QA silently.

### 8.6 Constant cap forces another migration when product wants 8+

Likelihood: medium (product may iterate). Impact: low (a 5-line
migration moves `7` to `N`).

Mitigation:
- This is by design (see §4.1 "Why hard-code the constant"). If
  product later wants a configurable cap, the `rooms.max_members`
  path remains available as a future migration — we just don't pay
  for it today.

---

## 9. Follow-ups (intentionally deferred)

These are tracked for future work and are **not** in Task 35:

- **Realtime member-list subscription.** Manage Project today
  revalidates on visit; a realtime channel for `room_members`
  inserts/deletes would let the `${current}/7` pill and the
  disabled-invite affordance settle instantly. Cheap to add, not
  required.
- **Exact invite-preview member count.** Task 35 keeps the preview
  honest by using neutral capacity copy instead of a fake exact
  count. If product later wants the preview to show the real count,
  design a separate security-definer RPC that returns only the count
  for an invite code, no member identities.
- **`_smart_check_overtaking` N-player semantics.** Task 31
  intentionally left this for a product decision. With cap = 7 it
  becomes more visible (more pairs to "overtake"); decide whether
  to notify every passed member, only the immediately-passed
  member, or no one.
- **Copy cleanup (audit S6).** "partner" appears in `inviteCodeDesc`,
  `leaveDesc`, `leaveConfirmBody`, and several other strings. A
  later slice rewords these to "members" / role-neutral copy.
- **6/7 "almost full" affordance.** Optional UX nudge to the
  creator that the room is one join away from full. Not requested
  by product; file only if user feedback asks for it.
- **Configurable cap (Decision B2).** If product ever needs a
  per-room cap, design the `rooms.max_members` column, the RLS for
  "who can change my room's cap?", and the admin UI in a separate
  task.
- **Member-count source of truth in TS.** Add a single
  `ROOM_CAPACITY = 7` constant to `src/lib/constants.ts` (or the
  i18n format function from §4.4) so other surfaces (charts, future
  member-detail pages) can reference one symbol. Out of scope for
  Task 35 — only Manage Project needs the number today, and it
  reads via the locale function.

---

## 10. Out-of-scope clarifications

This section restates non-goals that have produced confusion in
previous reviews. If a reviewer is unsure whether something belongs
in Task 35, the answer is almost certainly "no — file a follow-up".

- **No goal/sub-goal changes.** `goals.target_amount` still means
  "this member's target inside this room." The room goal is still
  the max of member goals via `update_room_goal`. Feature 5 is a
  separate future task.
- **No Dashboard layout change.** Task 33 owns the Dashboard's
  N-aware shape. Task 35 must not touch `Dashboard.tsx`,
  `RoomLeaderboardList`, `PlayerProgressRow`, `MomentumChart`,
  `SavingRaceChart`, or any chart prop.
- **No notification fan-out edits.** Task 31 owns the fan-out
  surfaces. Task 35 must not touch any `notify_*` RPC, the
  `notify-partner-deposit` edge function, the `_smart_check_*`
  helpers, or `_other_room_member`.
- **No member-detail navigation.** Tapping any member row, anywhere,
  still does not navigate to a profile page. Feature 3 is a
  separate future task.
- **No QR-code generation.** The IconQrCode in Manage Project is
  decorative; the invite-code modal shows the code as text. No QR
  rendering is added in this task.
- **No edits to `RoomMemberRow`, `RoomMembersSection`, or the Task
  34 member-list hook contract.** Task 35 consumes them; it does
  not modify them.
