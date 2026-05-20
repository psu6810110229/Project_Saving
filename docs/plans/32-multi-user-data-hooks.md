# Task 32 — Multi-User Data Hooks (N-safe room/member data layer)

Status: Planning only. No code, migrations, or file edits in this document.
Owner: Senior FE/FS pair (Claude) with Fran.
Source: `docs/multi-user-room-feature-plan.md` (Feature 2 only) +
`docs/plans/feature-2-multi-user-rooms-audit.md` (slice S3) +
Task 31 (`docs/plans/31-multi-user-notification-fanout.md` and the
`feat: multi-user notification fan-out (Task 31)` commit).
Date drafted: 2026-05-20.

This task is the **state-layer** slice of Feature 2 (multi-user rooms). It
makes the room/member data layer structurally safe for N members
(2–7) while preserving today's 2-user behaviour exactly. **No UI is
replaced in this task.** Dashboard, SavingPlan, NudgeButton,
BucketGrid, and SavingPlanCard continue to render the existing
1:1 surfaces using thin backward-compatible wrappers. The N-aware
UI replacement happens in a later slice (S4 in the audit).

The room capacity cap stays at 2. Joining, capacity enforcement, and
the notification fan-out path are out of scope.

---

## 1. Goal

- Replace every single-partner data assumption in the hooks layer with
  an N-safe internal that returns "all other current room members"
  grouped by user.
- Keep `usePartnerBuckets` and `usePartnerSavingPlan` (and the
  `data.partnerBuckets` / `data.partnerSavingPlan` shapes exposed by
  `DataContext`) as thin wrappers over the new N-safe hooks so every
  current caller compiles and renders identically.
- Make the room/vault total a sum over **every** member, not a
  hard-coded "you + one partner". (Audit confirms today's
  `useLeaderboard` already iterates all members; this task verifies
  and locks that down via tests/QA.)
- Ship loading, error, and empty states for each new N-safe hook that
  mirror the existing ones.
- Do not touch SQL, RLS, the cap, the join RPC, the notification
  fan-out from Task 31, goals/sub-goals, or any visible UI layout.

## 2. Non-goals

The following are explicitly out of scope and must not be touched in
this task:

- Raising the room capacity (2 → 7). The trigger
  `enforce_two_player_cap` (0023) and the RPC `join_room_by_code`
  (0024) stay exactly as they are.
- Changing `join_room_by_code` return shape or its `'full'` threshold.
- Editing or replacing the notification fan-out delivered by Task 31
  (`notify-partner-deposit` edge function, `notify_*` RPCs,
  `_smart_check_goal_reached`, `_smart_check_overtaking`,
  `_other_room_member`).
- Replacing `HeadToHeadCard`, redesigning `BucketGrid`, redesigning
  `SavingPlanCard`, or changing the Dashboard / SavingPlan layout.
  The Mine/Partner segmented control on `SavingPlan.tsx`, the
  partner-bucket section on `Dashboard.tsx`, and the chart
  partner-series picker all keep their current single-partner shape
  in this task. They are replaced in slice S4/S5.
- Feature 5 (per-member sub-goals under a room goal). `goals.target_amount`
  semantics stay exactly as they are today.
- New SQL migrations, new RLS policies, new RPCs, new edge functions.
- Touching `useReconcile`, `useStreakFreeze`, `useReactions`,
  `useReactionBroadcast` or anything personal/private. Reconcile
  remains personal and N-irrelevant by definition.
- Removing `usePartnerBuckets` / `usePartnerSavingPlan` or renaming
  any existing exported symbol. All public names stay; the new
  N-safe hooks are added alongside.
- i18n / copy changes. "partner"-labelled UI copy stays as it is
  until the UI slice; copy cleanup is S6 in the audit.
- Adding a real-time channel for member list changes. Membership
  in a 2-user room is effectively stable; the hooks can re-fetch on
  `roomId` change without subscribing to `room_members` events. (A
  membership realtime subscription is filed as a follow-up under §13.)

## 3. Current single-partner data assumptions (audit)

The audit doc (§6 and §7) already enumerated the state assumptions.
This section restates them with file/line precision so the
implementation slice has zero re-search cost.

Blocking (must be fixed in this task):

1. `src/components/DataContext/DataContext.tsx:25`
   ```
   const partnerEntry = leaderboard.entries.find(entry => !entry.isYou);
   ```
   Collapses every other room member to the first non-self leaderboard
   entry. With ≥ 3 members it silently picks one and discards the rest.

2. `src/components/DataContext/DataContext.tsx:26–28`
   ```
   const partnerBuckets = usePartnerBuckets(roomId, partnerEntry?.userId ?? null);
   const partnerSavingPlan = usePartnerSavingPlan(roomId, partnerEntry?.userId ?? null);
   ```
   Both hooks fetch data for one user id. In an N-user room only the
   "first other" member's buckets/plan are loaded; the rest are
   silently invisible.

3. `src/hooks/usePartnerBuckets.ts:21`
   `usePartnerBuckets(roomId, partnerUserId)` — single `partnerUserId`
   input, returns one flat `Bucket[]`. No grouping by member.

4. `src/hooks/usePartnerSavingPlan.ts:104`
   `usePartnerSavingPlan(roomId, partnerUserId)` — single
   `partnerUserId` input, returns one `SavingPlan | null`. No
   per-member map.

5. `src/components/DataContext/DataContextValue.ts:19,21`
   ```
   partnerBuckets: ReturnType<typeof usePartnerBuckets>;
   partnerSavingPlan: ReturnType<typeof usePartnerSavingPlan>;
   ```
   The shared context type exposes singular shapes. Every consumer
   inherits the 1:1 assumption.

Safe / mostly safe (verified — no code change in this task; QA only):

6. `src/hooks/useLeaderboard.ts:64–82` — fetches every member id via
   `room_members` then falls back to `room_members_for_room` RPC if
   the direct select returns ≤ 1 row. Already returns N entries.
   The sort (`saved desc`, then `_rawPercent desc`, then
   `displayName asc`) generalises to N entries unchanged.

7. `src/hooks/useSavingsTotal.ts` — only computes the **current**
   user's total. It is NOT used for the room/vault total today; the
   room total is derived by summing `leaderboard.entries[*].saved`
   inside `Dashboard.tsx` (`TotalVaultCard`). No change needed in
   this task; verify via QA that the sum continues to work for N
   members and add a unit-style local check.

8. `src/hooks/useLogs.ts` — `useLogs(100, roomId)` caps the page to
   100 rows. With 7 members on a busy day this could under-count the
   sum displayed by `TotalVaultCard`. This is a pre-existing bug, not
   a Feature 2 regression, but it becomes more visible at N=7. **Not
   fixed in this task.** Filed in §13 (Risks and follow-ups) as a
   blocker for the cap-raise slice, not for this slice.

9. `src/hooks/useRoom.ts`, `src/hooks/useRooms.ts` — already N-safe.
   `useRooms` reads every `room_members` row for the caller and
   feeds `RoomContext`. The `"That project already has two players."`
   error string in `useRooms.ts:179` is purely cosmetic for the
   capacity slice (S1 in the audit) and is not changed here.

10. `src/hooks/useGoal.ts`, `src/hooks/useBuckets.ts` — own-user
    scoped. Out of scope.

11. `src/hooks/useReconcile.ts` — personal Reconcile; N-irrelevant.

Out-of-scope-but-referenced (must NOT change in this task):

12. `src/pages/Dashboard.tsx` — many `partner*` reads
    (`partnerEntry`, `partnerBuckets`, `partnerBucketTotal`,
    `partnerBucketItems`, `partnerName`, `partnerSeries`,
    `partnerUserId`). All keep their current single-partner usage
    in this task by reading the **backward-compatible** wrappers
    (§4.2). The N-aware Dashboard list is S4.

13. `src/pages/SavingPlan.tsx:37–40` — Mine/Partner segmented
    control. Reads `data.partnerSavingPlan` and `partnerEntry`.
    Unchanged in this task.

14. `src/components/NudgeButton/NudgeButton.tsx` — already
    per-recipient (`partnerUserId: string | null | undefined`). N-safe
    by construction; the Dashboard just renders it for the first
    other member today. Unchanged in this task.

## 4. Proposed N-safe internals

### 4.1 New N-safe hooks (additive)

Three new hooks are added under `src/hooks/`. Names use the
`useRoomMembers*` prefix so it is obvious they return **per-member
collections, not aggregates**. The old `usePartner*` names stay; see
§4.2 for the wrapper layer.

#### `useRoomOtherMemberIds(roomId, myUserId): { memberIds, loading }`

Returns the user ids of every current room member except the caller,
in stable order (sorted by `joined_at asc` to match
`useRooms.fetchRooms`'s ordering, which keeps the leaderboard "tie
break by display name" sort independent of join order).

**Null-input contract (mandatory):** if `roomId` is null/undefined OR
`myUserId` is null/undefined, the hook MUST short-circuit and return
`{ memberIds: [], loading: false }` without issuing any query. It must
never fetch `room_members` when `myUserId` is missing — doing so would
return every member of the room (including a row that *should* be the
caller but cannot be filtered out) and downstream consumers would treat
all members, including the caller, as "other". The null-`myUserId`
guard runs before the direct select and before the RPC fallback.

Implementation:
- Guard: if `!roomId || !myUserId` → return
  `{ memberIds: [], loading: false }` immediately. No query, no
  fallback.
- Otherwise, read `room_members` directly first (`select user_id,
  joined_at where room_id = :roomId`).
- If the direct select returns ≤ 1 row, fall back to
  `supabase.rpc('room_members_for_room', { p_room_id: roomId })`,
  mirroring the proven pattern in
  `src/hooks/useLeaderboard.ts:64–82`. The RPC (migration 0016) is
  the canonical N-safe member list when RLS visibility is incomplete
  in some environment.
- Drop the caller's id (filter out `myUserId`) and return the rest.
- States: `loading=true` until first fetch resolves (only when both
  inputs are present); empty array (and `loading=false`) for a 1-person
  room, for null `roomId`, or for null `myUserId`.

Reuse rationale: the existing `useLeaderboard` already implements
this exact lookup internally. We extract it into its own hook because
two new hooks (`useRoomMembersBuckets`, `useRoomMembersSavingPlans`)
both need the same list and we do not want them to each duplicate
the fallback logic.

Re-fetch: on `roomId` change only. No realtime subscription on
`room_members` in this task. With cap = 2 and `useLeaderboard` already
subscribing to `goals` changes (not memberships), this matches
current behaviour. A membership-change subscription is filed in §13.

#### `useRoomMembersBuckets(roomId, otherMemberIds): { bucketsByUser, allBuckets, loading }`

Replaces `usePartnerBuckets(roomId, oneUserId)` for the N case.

Inputs:
- `roomId: string | null`
- `otherMemberIds: string[]` (from `useRoomOtherMemberIds` — the caller
  is responsible for excluding self)

Returns:
- `bucketsByUser: Record<string /* user_id */, Bucket[]>` — keys are
  exactly the `otherMemberIds`. Buckets per user are sorted by
  `position asc`, matching the existing single-partner sort
  (`usePartnerBuckets.ts:39`).
- `allBuckets: Bucket[]` — flat list (concatenation of every
  per-user array, preserving each user's `position` order). Provided
  so today's `Dashboard.tsx:647` `buckets={[...buckets, ...partnerBuckets]}`
  call and `Dashboard.tsx:219` `partnerBucketTotal` calculation keep
  the same semantics with no callsite change (just swap source).
- `loading: boolean`

Implementation (single query, not a loop):
```
supabase
  .from('buckets')
  .select('*')
  .eq('room_id', roomId)
  .in('user_id', otherMemberIds)
  .order('position', { ascending: true });
```
Group the result by `user_id` client-side. One query, regardless of
how many members. RLS already permits this read for any co-member
(migration 0019, `buckets_select_co_member`).

Empty / error states:
- `roomId` null OR `otherMemberIds` empty → `{ bucketsByUser: {},
  allBuckets: [], loading: false }`. Same shape as today's empty
  return from `usePartnerBuckets` (`buckets: [], loading: false`)
  scaled to N.
- **Stale-data reset on input change (mandatory):** whenever `roomId`
  changes OR `otherMemberIds` changes (referentially or by content —
  compare ids as a sorted joined string), clear `bucketsByUser` and
  `allBuckets` to empty and set `loading: true` BEFORE issuing the new
  fetch. Prior data must not survive a switch from room X to room Y,
  or a membership change, even if the new fetch then fails. This
  prevents room Y's partner section from briefly showing room X's
  buckets while loading, or worse, continuing to show room X's data if
  the room Y fetch errors out.
- Supabase error: behaviour depends on whether inputs are unchanged
  from the prior successful fetch.
  - Inputs unchanged (transient retry on the same room/members): keep
    prior data visible, set `loading: false`, log to console once.
    Matches today's resilience for momentary network blips.
  - Inputs changed (we already reset above): leave `bucketsByUser`
    and `allBuckets` empty, set `loading: false`, log to console once.
    Old room/member data must not remain visible if the new fetch
    fails. No `error` field is surfaced on the result (matches today's
    `UsePartnerBucketsResult`); failures are observable only via the
    empty state + console log.
- Cancellation: identical `cancelled` flag pattern as
  `usePartnerBuckets.ts:25–48`.

No realtime subscription in this task (membership and bucket changes
already trigger re-fetches via `useLeaderboard`'s goal channel and
re-mounts; adding a `buckets` channel here is a S4 concern).

#### `useRoomMembersSavingPlans(roomId, otherMemberIds): { plansByUser, loading, error }`

Replaces `usePartnerSavingPlan(roomId, oneUserId)` for the N case.

Inputs identical to `useRoomMembersBuckets`.

Returns:
- `plansByUser: Record<string /* user_id */, SavingPlan | null>` —
  keys are exactly the `otherMemberIds`. A user with no active plan
  maps to `null` (same as today's `usePartnerSavingPlan` returning
  `plan: null`).
- `loading: boolean`
- `error: string | null` — first error encountered while loading any
  member's plan. Matches the existing
  `UsePartnerSavingPlanResult.error` field.

Implementation:
1. Fetch all active plan rows in one query:
   ```
   supabase
     .from('saving_plans')
     .select('*')
     .eq('room_id', roomId)
     .in('user_id', otherMemberIds)
     .is('archived_at', null);
   ```
2. Collect `plan.id` values. Fetch revisions and pauses in two
   parallel `.in('plan_id', planIds)` queries (NOT per-user — keeps
   total round-trips at 3 regardless of N).
3. Group revisions and pauses by `plan_id`, then build a
   `SavingPlan` object per `user_id` using `normalizeRevision` and
   `normalizePause` imported from a **new shared helper module**
   `src/lib/savingPlanNormalization.ts` (see §4.5). Do NOT duplicate
   the normalisation logic, and do NOT import these helpers from
   `usePartnerSavingPlan.ts` — that would create a circular dependency
   once `usePartnerSavingPlan` becomes a wrapper over this hook.
4. For `otherMemberIds` without a plan row, set `plansByUser[id] =
   null`. Do not omit the key — consumers should be able to write
   `plansByUser[userId]` without `undefined` checks beyond
   "plan is null".

States:
- `roomId` null OR `otherMemberIds` empty → `{ plansByUser: {},
  loading: false, error: null }`.
- **Stale-data reset on input change (mandatory):** whenever `roomId`
  changes OR `otherMemberIds` changes (referentially or by content),
  clear `plansByUser` to `{}` and `error` to `null` and set
  `loading: true` BEFORE issuing the new fetch. Prior plans must not
  survive a switch from room X to room Y, or a membership change,
  even if the new fetch then fails.
- Error during any of the three queries: behaviour depends on whether
  inputs are unchanged from the prior successful fetch.
  - Inputs unchanged: keep prior `plansByUser` visible (transient
    retry), set `loading: false`, set `error` to the message.
  - Inputs changed (we already reset above): `plansByUser` stays `{}`,
    set `loading: false`, set `error` to the message. Old room/member
    plan data must not remain visible if the new fetch fails. Matches
    the abort-on-first-error spirit of
    `usePartnerSavingPlan.ts:133–172` but with explicit reset on input
    change.
- Cancellation: identical `cancelled` flag pattern.

RLS: relies on migration 0047 (`saving_*_select_co_member`), which
is already a co-member policy, not exact-two. No SQL change required.

### 4.2 Backward-compatible wrappers (the contract preservation step)

To keep `Dashboard.tsx`, `SavingPlan.tsx`, and every other
consumer untouched, the existing `usePartner*` hooks are **rewritten
in place** as thin selectors over the new N-safe internals. Their
public signatures and return shapes do not change.

#### `usePartnerBuckets(roomId, partnerUserId): UsePartnerBucketsResult`

New body (sketch):
```
export function usePartnerBuckets(
  roomId: string | null,
  partnerUserId: string | null | undefined,
): UsePartnerBucketsResult {
  // The wrapper still accepts a single id so existing callers
  // compile unchanged. We pipe it through the N-safe internal so
  // that even the 2-user case uses the same code path.
  const ids = useMemo(
    () => (partnerUserId ? [partnerUserId] : []),
    [partnerUserId],
  );
  const { bucketsByUser, loading } = useRoomMembersBuckets(roomId, ids);
  const buckets = partnerUserId ? (bucketsByUser[partnerUserId] ?? []) : [];
  return { buckets, loading };
}
```
Behaviour parity:
- Returns the same `buckets: Bucket[]` shape.
- Returns the same `loading: boolean` shape.
- Empty/error contract identical (empty array on no roomId / no
  partner id / RLS-filtered no rows).
- Sort order identical (`position asc`) because the underlying query
  uses the same `.order('position', { ascending: true })`.

#### `usePartnerSavingPlan(roomId, partnerUserId): UsePartnerSavingPlanResult`

New body (sketch):
```
export function usePartnerSavingPlan(
  roomId: string | null,
  partnerUserId: string | null | undefined,
): UsePartnerSavingPlanResult {
  const ids = useMemo(
    () => (partnerUserId ? [partnerUserId] : []),
    [partnerUserId],
  );
  const { plansByUser, loading, error } = useRoomMembersSavingPlans(roomId, ids);
  const plan = partnerUserId ? (plansByUser[partnerUserId] ?? null) : null;
  return { plan, loading, error };
}
```
Behaviour parity:
- Returns `{ plan: SavingPlan | null, loading, error }` exactly as
  today.
- Empty/error contract identical (null plan on no roomId / no
  partner id / no row in DB).
- The `normalizeRevision` and `normalizePause` helpers are moved out
  of `usePartnerSavingPlan.ts` into the new shared module
  `src/lib/savingPlanNormalization.ts` (see §4.5). After the wrapper
  rewrite, `usePartnerSavingPlan.ts` itself no longer calls them
  directly (delegation happens via `useRoomMembersSavingPlans`, which
  imports them from the shared module). The wrapper file keeps its
  existing path so any external import of the hook resolves
  unchanged. If any external code imported `normalizeRevision` /
  `normalizePause` directly from `usePartnerSavingPlan.ts`, a thin
  re-export would keep that path working — but a search confirms
  there are no such external imports today, so no re-export is
  needed.

Rationale for keeping the wrappers:
- The audit doc explicitly says "Keep old hook names as wrappers if
  needed" — preserving them removes the need to touch every consumer
  in this slice.
- They are one function each, ~5 lines including types. Cost of
  maintaining the wrapper is negligible and disappears in S4 when
  the consumers migrate to `useRoomMembers*` directly.
- They guarantee zero behavioural change for 2-user rooms because
  the wrapper passes a single-element id array through the same
  code path used by N-user rooms.

### 4.3 `DataContext` changes

`src/components/DataContext/DataContext.tsx` is extended to expose
**both** shapes:
- The existing singular `partnerBuckets` and `partnerSavingPlan`
  (driven by the wrapper hooks; consumers untouched).
- New plural `otherMemberIds`, `roomMembersBuckets`,
  `roomMembersSavingPlans` (driven by the N-safe internals).

New body sketch:
```
const otherMembers = useRoomOtherMemberIds(roomId, user?.id);
const roomMembersBuckets = useRoomMembersBuckets(roomId, otherMembers.memberIds);
const roomMembersSavingPlans = useRoomMembersSavingPlans(roomId, otherMembers.memberIds);

// Preserve today's "first other member" surface for legacy callers.
// We deliberately keep this derivation alive through this slice so
// Dashboard/SavingPlan keep rendering the same single-partner widgets.
const leaderboard = useLeaderboard(...);
const partnerEntry = leaderboard.entries.find(entry => !entry.isYou);
const partnerBuckets = usePartnerBuckets(roomId, partnerEntry?.userId ?? null);
const partnerSavingPlan = usePartnerSavingPlan(roomId, partnerEntry?.userId ?? null);
```

The two layers share underlying network calls only at the SQL/RLS
level, not at the hook level — `usePartnerBuckets` calls
`useRoomMembersBuckets` internally with a 1-element id array, and
`useRoomMembersBuckets` is called separately with the full
`otherMembers.memberIds` array at the DataContext level. **This is
the one duplicated query in this design.** See §4.4 below for why
the duplication is intentional and bounded.

In `src/components/DataContext/DataContextValue.ts`:
- Keep `partnerBuckets: ReturnType<typeof usePartnerBuckets>;` and
  `partnerSavingPlan: ReturnType<typeof usePartnerSavingPlan>;`.
- Add:
  ```
  otherMemberIds: ReturnType<typeof useRoomOtherMemberIds>;
  roomMembersBuckets: ReturnType<typeof useRoomMembersBuckets>;
  roomMembersSavingPlans: ReturnType<typeof useRoomMembersSavingPlans>;
  ```
- Update the `useMemo` deps list in `DataContext.tsx:32` to include
  the new values.

### 4.4 Duplicated-query note (intentional, time-boxed)

In a 2-user room, the design above issues:
- 1 query for `partnerBuckets` (single id IN-clause via the wrapper)
- 1 query for `roomMembersBuckets` (single id IN-clause directly)
- Same for saving plans (1 + 1)

That is 2 extra Supabase round-trips per Dashboard mount over today.
Acceptable trade because:
- Cap is 2, the extra query is `.in('user_id', [oneId])` — same cost
  as the existing single-id query.
- The duplication disappears in slice S4 when Dashboard migrates to
  the plural shape and the wrappers are removed.
- Avoids a more invasive "selector that derives the singular value
  from the plural map" refactor that would couple DataContext
  internal layout to this slice's exact shape.

**Acceptable cost ceiling** (verify during implementation): cold
Dashboard mount should add ≤ 200 ms of total round-trip on a typical
mobile network. If profiling shows otherwise, fall back to the
selector approach: drop the wrappers' independent
`useRoomMembersBuckets/Plans` call inside DataContext and instead
read `bucketsByUser[partnerEntry?.userId]` from the plural map. The
wrapper hooks would still be exported (for tests / external imports)
but DataContext would stop instantiating them. **Do not make that
optimisation up front** — start with the duplicated-query approach
because it is the lowest-risk and the cost is provably bounded at
N=2.

### 4.5 Shared normalisation module (circular-import prevention)

A new module is added at `src/lib/savingPlanNormalization.ts`. It is
the single source of truth for the `normalizeRevision` and
`normalizePause` helpers that today live inside
`usePartnerSavingPlan.ts`.

Required dependency direction (strict, enforced by code review):

```
src/lib/savingPlanNormalization.ts        (leaf — imports nothing from src/hooks)
        ▲                              ▲
        │                              │
src/hooks/useRoomMembersSavingPlans.ts  src/hooks/usePartnerSavingPlan.ts
                                              │
                                              └──▶ may import useRoomMembersSavingPlans
```

Rules:
- `savingPlanNormalization.ts` is a leaf: it imports nothing from
  `src/hooks/`. It only depends on `src/types/index.ts` and any pure
  helpers it already needs.
- `useRoomMembersSavingPlans.ts` imports `normalizeRevision` and
  `normalizePause` from `savingPlanNormalization.ts`. It MUST NOT
  import anything from `usePartnerSavingPlan.ts`.
- `usePartnerSavingPlan.ts` imports `normalizeRevision` and
  `normalizePause` from `savingPlanNormalization.ts` (NOT from its own
  current file — the helpers are moved out, not re-exported in
  place).
- `usePartnerSavingPlan.ts` MAY import `useRoomMembersSavingPlans`
  because the wrapper is now downstream of the N-safe hook.
- `useRoomMembersSavingPlans.ts` MUST NOT import from
  `usePartnerSavingPlan.ts`. Any temptation to read a helper from the
  old file path is a circular-dependency bug.

Module contents (sketch — exact body lifted verbatim from today's
`usePartnerSavingPlan.ts`):
```
// src/lib/savingPlanNormalization.ts
import type { SavingPlanRevision, SavingPlanPause } from '../types';

export interface RawRevisionRow { /* … same as today */ }
export interface RawPauseRow { /* … same as today */ }

export function normalizeRevision(row: RawRevisionRow): SavingPlanRevision {
  // exact body from usePartnerSavingPlan.ts, no changes
}

export function normalizePause(row: RawPauseRow): SavingPlanPause {
  // exact body from usePartnerSavingPlan.ts, no changes
}
```

Verification during implementation:
- After the move, search the repo for `from '../hooks/usePartnerSavingPlan'`
  and confirm no file (other than `DataContext.tsx`, which imports the
  hook itself, not the helpers) imports the normalisation helpers
  from the old path.
- Run `npm run build`. A circular import would not always fail the
  build but would surface as `undefined` helper at module load; the
  manual QA deep-equal check in §9 step 3 catches that immediately.

## 5. TypeScript type changes

### 5.1 New types (additive only)

In `src/hooks/useRoomOtherMemberIds.ts`:
```
export interface UseRoomOtherMemberIdsResult {
  memberIds: string[];
  loading: boolean;
}
```

In `src/hooks/useRoomMembersBuckets.ts`:
```
export interface UseRoomMembersBucketsResult {
  bucketsByUser: Record<string, Bucket[]>;
  allBuckets: Bucket[];
  loading: boolean;
}
```

In `src/hooks/useRoomMembersSavingPlans.ts`:
```
export interface UseRoomMembersSavingPlansResult {
  plansByUser: Record<string, SavingPlan | null>;
  loading: boolean;
  error: string | null;
}
```

No new entries in `src/types/index.ts` — these types belong to the
hooks that own them, like the existing `UsePartnerBucketsResult` and
`UsePartnerSavingPlanResult`.

### 5.2 Modified types

`src/components/DataContext/DataContextValue.ts`: three new fields on
`DataContextValue`. No removed or renamed fields.

### 5.3 Strict-typing rules (per CLAUDE.md)

- No `any` anywhere in the new hooks. Replicate the existing
  `RawProfile` / `RawGoal` / `RawPlanRow` / `RawRevisionRow` /
  `RawPauseRow` patterns from `useLeaderboard.ts` and
  `usePartnerSavingPlan.ts`.
- `Record<string, Bucket[]>` for `bucketsByUser` is fine; do not
  introduce a `Map<string, Bucket[]>` to "be safer" — the rest of
  the codebase uses object maps for user-id-keyed data.

## 6. Loading, error, and empty states

This task only changes the shape of the data, not the rendering. The
contract for each new hook below is what UI builders in S4 will rely
on; the wrappers preserve today's contract for current UI.

### 6.1 `useRoomOtherMemberIds`

- Initial (both `roomId` and `myUserId` present): `{ memberIds: [],
  loading: true }`.
- After resolution in an N-user room: `{ memberIds: [...N−1 ids],
  loading: false }`.
- 1-user room (creator solo): `{ memberIds: [], loading: false }`.
- `roomId == null`: `{ memberIds: [], loading: false }`. **No query
  is issued.**
- `myUserId == null`: `{ memberIds: [], loading: false }`. **No query
  is issued.** This is critical — fetching `room_members` without a
  known caller id would surface every member as "other", including
  the (eventual) caller, breaking every downstream consumer.
- No `error` field — failures fall back to the RPC; if both the
  direct read and RPC fail we log to console and return
  `{ memberIds: [], loading: false }`. Matches the
  best-effort spirit of `useLeaderboard.ts:73–82`.

### 6.2 `useRoomMembersBuckets`

- Initial: `{ bucketsByUser: {}, allBuckets: [], loading: true }`.
- Resolved: keys present for every id in `otherMemberIds` (empty
  array for members with no buckets). `allBuckets` is the
  concatenation in `otherMemberIds` order, each member's array
  sorted by `position asc`.
- Empty inputs (`!roomId` or `otherMemberIds.length === 0`):
  `{ bucketsByUser: {}, allBuckets: [], loading: false }`.
- **Input change (`roomId` or `otherMemberIds` changed):** reset to
  `{ bucketsByUser: {}, allBuckets: [], loading: true }` before
  issuing the new fetch.
- DB error after an input change: data stays empty (from the reset),
  `loading: false`, log the error once. Old room/member data must
  not remain visible.
- DB error with inputs unchanged (transient retry): keep prior data,
  set `loading: false`, log the error once. No `error` field
  surfaced (matches today's `UsePartnerBucketsResult`).

### 6.3 `useRoomMembersSavingPlans`

- Initial: `{ plansByUser: {}, loading: true, error: null }`.
- Resolved: keys present for every id in `otherMemberIds`. Members
  without an active plan map to `null`.
- Empty inputs: `{ plansByUser: {}, loading: false, error: null }`.
- **Input change (`roomId` or `otherMemberIds` changed):** reset to
  `{ plansByUser: {}, loading: true, error: null }` before issuing
  the new fetch.
- DB error after an input change: `{ plansByUser: {}, loading: false,
  error: <message> }`. Old room/member plan data must not remain
  visible.
- DB error with inputs unchanged (transient retry): keep prior
  `plansByUser`, set `loading: false`, set `error: <message>`.
  Matches today's `UsePartnerSavingPlanResult` resilience for the
  same-inputs case.

### 6.4 Wrappers

`usePartnerBuckets` and `usePartnerSavingPlan` continue to return
exactly the existing shapes:
- `usePartnerBuckets` → `{ buckets: Bucket[], loading: boolean }`.
- `usePartnerSavingPlan` → `{ plan: SavingPlan | null, loading:
  boolean, error: string | null }`.

For both: when the wrapper's `partnerUserId` is null/undefined the
return is identical to today's "no partner" state (empty list /
null plan, `loading: false`, no error).

## 7. Room total / vault total (sum-of-all-members)

The audit and current code confirm room total is **already** a
sum-of-all-members in `Dashboard.tsx` via
`leaderboard.entries.reduce((sum, e) => sum + e.saved, 0)`. This
task does not change that derivation. We add **one** thin selector
under the new context shape so future UI work has a single canonical
read:

`DataContextValue.roomTotalRecordedDeposits: number` — derived from
`leaderboard.entries`, equal to today's inline sum. **Optional in
this slice.** If it adds churn we defer it; the audit does not
require it for S3.

Recommendation: **defer to S4 / S6** to keep this task strictly
about the partner-data hooks. Adding a context-level total here would
invite consumers to switch readers in S3 and re-switch in S4, which
is exactly the kind of churn the wrapper strategy avoids.

(Note: the `useLogs(100)` cap is still a pre-existing under-count
risk for the vault total at large N. See §13.)

## 8. Acceptance criteria

For the current 2-user behaviour (the only behaviour exercised
today):

- `data.partnerBuckets` exposed by `DataContext` returns the same
  list, in the same order, with the same loading transitions as
  before this task. Verified by reading the value at every render
  and comparing it byte-for-byte against the pre-task baseline.
- `data.partnerSavingPlan` exposed by `DataContext` returns the same
  plan object (same `revisions` order, same `pauses` order, same
  `loading`/`error` transitions) as before this task.
- `Dashboard.tsx` renders the partner bucket section identically
  (same names, totals, ordering, segmented control labels).
- `Dashboard.tsx`'s `partnerBucketTotal` and the goal bucket-floor
  warning behave identically.
- `SavingPlan.tsx`'s Mine/Partner segmented control behaves
  identically (same partner name, plan summary, pause state).
- `NudgeButton` renders for the same single partner and triggers
  the same nudge.
- `useLeaderboard.entries` order and content unchanged for the same
  inputs (logs, profiles, goals).

For the future N-user case (reasoned, NOT exercised today because
the cap is still 2):

- `useRoomOtherMemberIds` returns N−1 ids for an N-user room,
  excluding the caller.
- `useRoomMembersBuckets` returns one `bucketsByUser[userId]` entry
  per other member, each sorted by `position asc`; `allBuckets` is
  the concatenation in `otherMemberIds` order.
- `useRoomMembersSavingPlans` returns one `plansByUser[userId]` per
  other member, mapping users without an active plan to `null`.
- All N-safe hooks tolerate `roomId == null` and empty
  `otherMemberIds` without throwing or fetching.
- Adding a 3rd member (in a local dev DB only, bypassing the cap
  trigger) does not break Dashboard rendering. The Dashboard still
  shows only the first other member (because the UI wrappers haven't
  changed yet) but the new N-safe hooks expose all 2 other members'
  data in their plural shape. A console log of
  `data.roomMembersBuckets.bucketsByUser` and
  `data.roomMembersSavingPlans.plansByUser` shows entries for both
  other members.

## 9. Implementation steps

Order chosen so each step is independently verifiable.

1. **Add `useRoomOtherMemberIds`.**
   - New file: `src/hooks/useRoomOtherMemberIds.ts`.
   - Port the member-id resolution block from
     `useLeaderboard.ts:64–82` into the new hook.
   - Unit-style smoke test in console: in the current 2-user room,
     `useRoomOtherMemberIds(roomId, myId).memberIds` returns the
     partner id; in a 1-user room it returns `[]`.

2. **Add `useRoomMembersBuckets`.**
   - New file: `src/hooks/useRoomMembersBuckets.ts`.
   - One `.in('user_id', otherMemberIds)` query.
   - Group by `user_id` client-side. Sort each user's array by
     `position asc`.
   - Smoke test: in the current 2-user room,
     `bucketsByUser[partnerId]` matches what the old
     `usePartnerBuckets(roomId, partnerId).buckets` returns.

3. **Extract the normalisation helpers into a shared module
   (prerequisite for step 3b).**
   - New file: `src/lib/savingPlanNormalization.ts`.
   - Move `normalizeRevision`, `normalizePause`, and their `Raw*Row`
     types out of `usePartnerSavingPlan.ts` and into the new module.
     Export each from the new module.
   - Update `usePartnerSavingPlan.ts` to import them from
     `src/lib/savingPlanNormalization.ts`. No behavioural change in
     the wrapper output — the helpers' bodies are unchanged, only
     their file path.
   - Run `npm run build` here as a checkpoint. The Dashboard and
     SavingPlan partner views must still render identically at this
     intermediate state (the wrappers have not yet been rewired).

3b. **Add `useRoomMembersSavingPlans`.**
   - New file: `src/hooks/useRoomMembersSavingPlans.ts`.
   - Import `normalizeRevision` and `normalizePause` from
     `src/lib/savingPlanNormalization.ts` (NOT from
     `usePartnerSavingPlan.ts`). The new hook MUST NOT import
     anything from `usePartnerSavingPlan.ts` — that would create a
     circular dependency in step 4 when the wrapper imports this hook.
   - Three queries: plans → revisions → pauses, each with `.in(...)`
     on the appropriate id list.
   - Group by `plan_id` / `user_id` client-side.
   - Smoke test: in the current 2-user room,
     `plansByUser[partnerId]` matches `usePartnerSavingPlan(roomId,
     partnerId).plan` field-for-field (use a deep-equal assertion in
     the dev console).

4. **Rewrite the wrappers.**
   - `usePartnerBuckets.ts` body becomes a wrapper over
     `useRoomMembersBuckets`. Public signature and return shape
     unchanged.
   - `usePartnerSavingPlan.ts` body becomes a wrapper over
     `useRoomMembersSavingPlans`. Public signature and return shape
     unchanged.
   - Smoke test: Dashboard and SavingPlan render identically; no
     visual diff; no new console warnings.

5. **Extend `DataContext`.**
   - Add `useRoomOtherMemberIds`, `useRoomMembersBuckets`, and
     `useRoomMembersSavingPlans` mounts inside `DataProvider`.
   - Extend the `useMemo` value with three new fields.
   - Extend `DataContextValue` typedef with the same three fields.
   - The existing `partnerEntry` / `partnerBuckets` /
     `partnerSavingPlan` derivations stay in place verbatim. They
     now share no state with the new plural hooks at the React
     level; see §4.4 for the duplication note.

6. **Verify type safety.**
   - `npm run build` must pass.
   - `npm run lint` should pass; expect no new warnings.
   - Search for any consumer that imported `usePartnerBuckets` or
     `usePartnerSavingPlan` types and confirm the unchanged
     `UsePartnerBucketsResult` / `UsePartnerSavingPlanResult` shape
     still satisfies them.

7. **Manual QA per §11.** Do not skip the deep-equal step from
   step 3 above — it is the primary safety net against subtle
   regressions in `normalizeRevision` / `normalizePause` paths.

8. **Report**: changed files, checks run, the §11 QA outcomes, any
   risks observed, and the deferred follow-ups (notably: membership
   realtime subscription, `useLogs(100)` cap, vault-total selector).

Strict rule: do not bundle UI, copy, or SQL changes into the
implementation commit. The diff for this task must touch only
`src/hooks/` and `src/components/DataContext/`.

## 10. Risk level

**Medium.**

- Touches `DataContext`, which is mounted by every page through
  `AppLayout`. A subtle regression in the wrapper layer would
  cascade to Dashboard, SavingPlan, AddMoney, ManageProject, and
  Profile simultaneously.
- The wrapper approach (§4.2) intentionally routes today's
  single-partner calls through the new plural code path, so a bug
  in `useRoomMembersBuckets` or `useRoomMembersSavingPlans` would
  immediately surface as a 2-user regression. This is desirable —
  we want failures to be loud and immediate, not quietly N-only.
- No SQL change. No RLS change. No realtime change. No notification
  change. The blast radius is bounded to the hooks layer.
- `normalizeRevision` / `normalizePause` extraction is the one place
  where a copy-paste error would silently corrupt plan rendering.
  Mitigation: both `useRoomMembersSavingPlans` and the rewritten
  `usePartnerSavingPlan` **import** the helpers from a single shared
  module `src/lib/savingPlanNormalization.ts` (§4.5). The helper
  bodies are moved verbatim into that module — no re-implementation,
  no copy-paste. This also prevents the circular-import trap of
  having the new hook depend on the wrapper file.

- **Circular import between `usePartnerSavingPlan.ts` and
  `useRoomMembersSavingPlans.ts`.** With the wrapper-over-N-safe-hook
  design, the wrapper imports the N-safe hook; if the N-safe hook
  also imported helpers from the wrapper file, the module graph would
  cycle. Mitigation is structural (§4.5): the helpers live in a leaf
  module (`src/lib/savingPlanNormalization.ts`) that imports nothing
  from `src/hooks/`. Code review must reject any change that adds an
  import from `useRoomMembersSavingPlans.ts` (or
  `savingPlanNormalization.ts`) back into `usePartnerSavingPlan.ts`.

Specific failure modes to watch for during code review:

- A grouping bug that drops a member with no buckets out of
  `bucketsByUser` (key omission) would make consumers crash on
  `bucketsByUser[id].length`. Mitigation: tests explicitly include
  a member with no buckets, and the implementation must seed the
  result with `Object.fromEntries(otherMemberIds.map(id => [id,
  []]))` before merging in the actual rows.
- A grouping bug that drops a member with no plan out of
  `plansByUser` would do the same. Mitigation: same seeding pattern.
- Sort instability in `allBuckets`: if the implementation uses
  `Object.values(bucketsByUser).flat()` the iteration order may not
  match `otherMemberIds` order (newer JS engines preserve insertion
  order, but mixing inserts and reads can be subtle). Mitigation:
  iterate `otherMemberIds` and push each user's array; do not rely
  on object-key iteration order.
- A wrapper that passes a stale `partnerUserId` to the N-safe
  internal would silently fall through to "no partner" state.
  Mitigation: the wrapper memoizes the single-id array via
  `useMemo([partnerUserId])` so identity changes only when the id
  changes.

## 11. Manual QA — 2-user (regression suite) and 3-user (reasoned)

### 11.1 Two-user room (the only behaviour exercised in production)

Setup: an existing 2-user room with member A (caller) and member B,
both having buckets and an active saving plan. A and B each have at
least one bucket with `position` ≠ 0 to verify ordering.

- [ ] Open Dashboard. Partner section renders B's name and bucket
      list, in the same order as before the task. `partnerBucketTotal`
      and the goal bucket-floor warning behave identically. Confirm
      no extra spinner flicker (loading state transitions match the
      pre-task baseline).
- [ ] Open the Partner tab on the bucket segmented control. Bucket
      names, targets, current totals, and `position` order match the
      pre-task snapshot.
- [ ] Open Saving Plan, switch to the Partner segment. B's plan
      renders with the same summary, same revisions order, same
      pauses order.
- [ ] Tap NudgeButton. It targets B and sends one nudge (the existing
      `send-nudge` edge function), same as before.
- [ ] Add a deposit as A. B receives one in-app `partner_deposited`
      row + one push (Task 31 fan-out unchanged).
- [ ] Verify console output of `data.roomMembersBuckets.bucketsByUser`
      contains exactly one key (B's id) with B's bucket array.
      Verify `data.roomMembersSavingPlans.plansByUser` contains
      exactly one key (B's id) with B's plan (or `null` if B has no
      plan).
- [ ] Verify `data.otherMemberIds.memberIds` returns `[B.id]`.
- [ ] Leave the room as A → no error; B continues to render solo.

### 11.2 Reasoned three-user verification (no production data)

Setup: in a local dev DB only, bypass the cap trigger to add a third
user C to an existing 2-user room. Do **not** run this against
staging or production.

- [ ] `data.otherMemberIds.memberIds` returns 2 ids (B and C), in
      `joined_at asc` order.
- [ ] `data.roomMembersBuckets.bucketsByUser` has two keys (B's id,
      C's id), each containing that user's buckets sorted by
      `position asc`.
- [ ] `data.roomMembersBuckets.allBuckets.length` equals
      `B.buckets.length + C.buckets.length`.
- [ ] `data.roomMembersSavingPlans.plansByUser` has two keys, each
      mapping to a `SavingPlan | null`.
- [ ] **UI must still show only B's data** (because the wrappers
      route `partnerEntry?.userId` — the first non-self leaderboard
      entry — through the N-safe hooks). This is the explicit
      design: UI replacement is S4. The 3rd member's data is
      reachable only via `data.roomMembersBuckets` /
      `data.roomMembersSavingPlans` for now.
- [ ] No regressions in Dashboard or SavingPlan rendering compared
      to step §11.1's snapshot.
- [ ] Roll the test 3rd member back when done. Production cap
      trigger remains untouched.

### 11.3 Empty / loading / error

- [ ] A 1-user room (creator solo, no one has joined) renders with
      `data.otherMemberIds.memberIds === []`,
      `data.roomMembersBuckets.bucketsByUser === {}`,
      `data.roomMembersSavingPlans.plansByUser === {}`, and Dashboard
      partner-section emptiness identical to today.
- [ ] Switching between rooms via the room switcher does not leak
      stale `bucketsByUser` / `plansByUser` from the previous room.
      Specifically: in room X, log
      `data.roomMembersBuckets.bucketsByUser` and
      `data.roomMembersSavingPlans.plansByUser` and snapshot the keys.
      Switch to room Y. The very next render of those values must NOT
      contain any user id from room X — neither during loading nor
      after resolution. Confirm `loading: true` appears briefly during
      the transition.
- [ ] Stale-data-on-error check: in room X, snapshot the partner
      data. Switch to room Y while the buckets query is forced to
      fail (DevTools network throttling + forced 500 on the
      `buckets` request). Confirm Dashboard does NOT keep showing
      room X's buckets — `bucketsByUser` is `{}` and the partner
      section is empty/loading. (Contrast with the same-room
      transient error case below.)
- [ ] Transient error, same inputs: with the Dashboard already
      rendered in room X (no room switch), simulate a DB error on a
      bucket re-fetch. The prior list stays visible, `loading` flips
      to `false`, and the error is logged once. The Partner tab does
      not blank.
- [ ] Null-`myUserId` guard: while signed out (or in a transient
      moment before `user?.id` resolves), confirm
      `useRoomOtherMemberIds` returns `{ memberIds: [], loading:
      false }` and that no `room_members` query is issued (verify in
      DevTools Network tab — no request).

## 12. Rollback plan

Pure-frontend rollback. No SQL, no edge function, no migration.

- Revert the commits that introduced `useRoomOtherMemberIds`,
  `useRoomMembersBuckets`, `useRoomMembersSavingPlans`, the
  `src/lib/savingPlanNormalization.ts` extraction, and the
  `DataContext` extension.
- Revert `usePartnerBuckets.ts` and `usePartnerSavingPlan.ts` to
  their pre-task bodies (the direct single-id queries, with
  `normalizeRevision` / `normalizePause` defined inline as today).
- Remove the new fields from `DataContextValue`.
- Delete `src/lib/savingPlanNormalization.ts` if no other code has
  picked it up.

The wrapper-first design guarantees the rollback restores byte-for-byte
the pre-task behaviour because consumers never read the new plural
fields (they're additive in this slice).

No data, no schema, no realtime, no notification, no money-state
surface is touched, so there is no risk of data loss or partial
rollback state.

## 13. Risks and follow-ups (filed for the next slices)

These are documented here so they are not lost; none are addressed
in this task.

- **Membership realtime subscription.** Today,
  `useRoomOtherMemberIds` re-fetches only on `roomId` change.
  Joining or leaving a room mid-session does not auto-refresh the
  partner data layer. With cap = 2 this is already the case (the
  room switcher fires a remount), but at N = 7 mid-session
  membership changes will be more common. File a follow-up to
  subscribe to `room_members` changes for the active room and
  re-fetch `otherMemberIds` on change. Out of scope for this task.

- **`useLogs(100)` cap.** With N up to 7 and a busy day, the
  capped log list could under-count `TotalVaultCard`'s sum. This is
  a pre-existing bug. Out of scope for this task; filed as a
  blocker for the cap-raise slice (S1 in the audit) rather than for
  this slice. Possible fix: switch the vault total to a
  server-side aggregate RPC or remove the cap on the totals path.

- **`partnerEntry` is non-deterministic for N ≥ 3.** Today's
  `leaderboard.entries.find(!isYou)` returns the highest-ranked
  non-self entry (after the leaderboard sort). At N = 3 this is
  surprising: the "partner" surface would switch between member B
  and member C depending on who saved more this week. **Not fixed
  in this task.** This is exactly why slice S4 replaces the
  single-partner UI with an N-aware list — once that lands, the
  `partnerEntry` derivation can be removed entirely. While the
  wrapper exists, document this gotcha in the new
  `useRoomOtherMemberIds.ts` so future readers know the legacy
  surface is intentionally non-deterministic.

- **Realtime subscriptions for partner buckets/plans.** Today's
  `usePartnerBuckets` and `usePartnerSavingPlan` have no realtime
  channels; updates are picked up on next route navigation. The
  new N-safe hooks preserve this (no subscriptions). For S4, add a
  per-room channel that re-fetches the N-safe hooks on
  `buckets`/`saving_plans` changes.

- **Vault total selector.** As described in §7, a future selector
  `roomTotalRecordedDeposits` would centralise the sum-of-all-members
  read. Deferred to S4 / S6.

- **Copy cleanup.** "Partner" labels (the segmented control, the
  empty states, the i18n strings) keep their current 1:1 wording.
  Deferred to S6.

- **Smart-event semantics at N ≥ 3.** `_smart_check_overtaking`
  remains a Task-31 deferred follow-up. Not affected by this slice;
  noted here only to keep the list of N-related debt in one place.
