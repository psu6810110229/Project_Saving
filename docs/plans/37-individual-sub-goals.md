# Task 37 - Individual Personal Sub-Goals Under A Room Goal

Status: Planning only. No code, migrations, or implementation in this
document.
Owner: Senior FE/FS pair (Codex) with Fran.
Date drafted: 2026-05-20.

Sources read:
- `docs/multi-user-room-feature-plan.md` - Feature 5 only.
- `CLAUDE.md` money rules and Supabase/RLS lessons.
- Room/goal/bucket migrations: `0001_init.sql`, `0002_rooms.sql`,
  `0003_fix_rooms_rls.sql`, `0004_buckets.sql`,
  `0014_bucket_sum_check.sql`, `0017_bootstrap_joiner_goal.sql`,
  `0025_room_goal_sync_rpc.sql`, `0029_harden_room_goal_bucket_floor.sql`,
  `0030_saving_plans.sql`, `0055_partner_notification_fanout.sql`,
  `0056_raise_room_capacity_to_7.sql`.
- Goal and aggregate hooks: `useGoal`, `useLeaderboard`,
  `useSavingsTotal`, `DataContext`, `useBuckets`,
  `useMemberSavingSnapshot`.
- UI surfaces: `Dashboard`, `AppLayout` milestone wrapper,
  `ManageProject`, `Profile`, `BucketManager`, `TotalVaultCard`,
  `RoomLeaderboardList`.
- Saving Plan code: `SavingPlan`, `useSavingPlan`,
  `useRoomMembersSavingPlans`, `savingPlan.ts`,
  `savingPlanNormalization.ts`.

## Hard Decisions

- `rooms.target_amount` becomes the room-level goal.
- `goals.target_amount` remains the per-user row but changes meaning to
  each member's personal sub-goal.
- `update_room_goal` remains creator-only and updates only
  `rooms.target_amount` plus `rooms.end_date`.
- `update_room_goal` must not overwrite member `goals.target_amount`
  rows after this feature lands.
- Add `update_member_goal` for self-only personal sub-goal edits.
- The creator cannot edit another member's personal sub-goal in v1.
- Saving Plan target semantics stay independent. Saving Plan revisions
  keep their own `target_amount` and are not rewritten when room goals
  or personal sub-goals change.

## Non-Goals And Guardrails

- Do not change the room cap. `0056_raise_room_capacity_to_7.sql`,
  `join_room_by_code`, `enforce_room_capacity`, and room-member cap UI
  stay out of scope.
- Do not change Member Detail privacy. No new private reads, no
  Verified Balance, no checkpoint/adjustment details, no raw email, no
  notification preferences, and no push subscriptions.
- Do not touch notification fan-out mechanics. Existing per-recipient
  loops, dedupe behavior, push behavior, and notification transport stay
  as-is.
- Do not change Saving Plan target semantics.
- Do not allow withdrawals, negative `savings_logs`, bucket allocation
  hacks, or direct mutation of meaningful financial history.
- Do not mix Recorded Deposits, Verified Balance, and Planned Balance.
  This task only changes goal denominators.

## 1. Existing Goal Semantics And Usage

### Database today

- `rooms` currently owns project identity and shared `end_date`, but no
  target amount.
- `goals` is keyed by `(user_id, room_id)` after the room migrations.
  It has `target_amount > 0`, `start_date`, `end_date`, and
  `updated_at`.
- `update_room_goal` from migration `0029` is the current authoritative
  shared-goal writer. It is creator-only, validates membership, validates
  target > 0 and end date, prevents lowering below any member's bucket
  target total, updates `rooms.end_date`, then upserts matching
  `goals.target_amount` and `goals.end_date` for every current member.
- `bootstrap_joiner_goal` currently mirrors the creator's goal row into
  the joiner so the Dashboard has a denominator immediately after join.
- `enforce_bucket_sum_le_goal` currently reads the owner's
  `goals.target_amount` and blocks bucket target totals above that value.
  After this task, that same trigger remains conceptually correct, but
  the value is the owner's personal sub-goal instead of the shared goal.
- `goals_member_select` lets room members read every member's goal row.
  `goals_own_upsert` and `goals_own_update` let users write their own
  goal row directly today.

### Client today

- `useGoal` fetches only the caller's own `goals` row. It exposes
  `goal`, a direct `save` upsert helper, and `saveRoomGoal`, which calls
  `update_room_goal`.
- `DataContext` hoists `useGoal`, `useLeaderboard`, `useBuckets`,
  `useSavingPlan`, and room-member aggregate hooks into the shared page
  data layer.
- `useLeaderboard` fetches every room member's `goals.target_amount` and
  exposes `entry.target`. It computes each member's `saved` from
  positive recorded deposits in `savings_logs`.
- `useSavingsTotal` is caller-only and sums recorded deposits for one
  user. Dashboard's room Vault total does not use it for room totals; it
  sums `leaderboard.entries[*].saved`.
- `Dashboard` currently computes:
  - caller target fallback from `goal?.target_amount ?? you?.target`.
  - Vault saved as sum of all leaderboard saved amounts.
  - Vault denominator as sum of all leaderboard targets, falling back to
    caller target.
  - member row denominator from each leaderboard entry target.
  - bucket capacity from caller `goal.target_amount`.
  - creator room-goal editing from the Dashboard modal.
- `AppLayout` milestone celebrations also use sum of all leaderboard
  targets, falling back to caller goal.
- `ManageProject` currently uses caller `goal.target_amount` as
  `BucketManager.goalTarget`; it does not yet expose separate room goal
  and personal sub-goal controls.
- `Profile` create-project flow passes one target value into
  `useRooms.createRoom`, which creates the room and then inserts the
  creator's goal row with the same target.
- `SavingPlan` stores and mutates targets only through
  `saving_plan_revisions.target_amount`. When creating a plan, the form
  seeds from the current `goal.target_amount`, but after creation the
  plan target is independent.

### Compatibility observation

Current code has an important denominator mismatch:
- the old shared goal editor and bucket validation read the caller's
  goal row;
- the current Dashboard Vault denominator and milestone denominator use
  the sum of member goal rows.

The implementation must preserve existing room visuals deliberately.
For this plan, "existing rooms look identical" means preserving the
currently visible Dashboard Vault denominator and milestone denominator,
while leaving each member's existing row denominator unchanged.

## 2. Database Migration

Create a new migration, likely `0057_individual_sub_goals.sql`.

### Schema

- Add `rooms.target_amount numeric(12,2)` as nullable.
- Add a check constraint that allows null during rollout but enforces
  positive values when present:
  `target_amount is null or target_amount > 0`.
- Do not enforce `NOT NULL` in this migration.
- Do not add any room-cap columns and do not edit room-cap triggers.

### Backfill

Backfill `rooms.target_amount` from existing `goals` rows.

Backfill rule for visual compatibility:
- For each room with current member goal rows, set `rooms.target_amount`
  to the value the current app uses as the room Vault denominator:
  the sum of positive `goals.target_amount` values for current
  `room_members`.
- Keep every existing `goals.target_amount` unchanged so each member row,
  Member Detail target, bucket ceiling, and personal display stay
  identical after migration.
- For rooms with no member-scoped goal rows but at least one historical
  goal row, fallback to the max positive goal for that room.
- Leave `rooms.target_amount` null only when no positive source exists;
  those rows must be reported by verification SQL before any `NOT NULL`
  follow-up.

This backfill is intentionally based on existing visible behavior, not on
an inferred historical business meaning. If product later wants an old
room's room goal lowered to the original creator-entered number, the
creator can do that through the new room-goal editor as an explicit user
action.

Explicit backfill decision:
- Task 37 intentionally backfills `rooms.target_amount` as the current
  visible Vault denominator: the sum of current member
  `goals.target_amount` values.
- This preserves existing room visuals immediately after migration.
- Tradeoff accepted: for old rooms where both members had the same
  shared goal, the new room goal may become 2x that old per-member
  value. This is accepted for visual compatibility.
- Users can later lower the room goal manually, subject to
  `room goal >= max(personal sub-goal)`.
- If this decision is not accepted before implementation, switch the
  backfill rule to max/most-common personal goal instead and update the
  acceptance criteria because existing Vault denominators will change
  immediately after migration.

### Verification SQL required in migration notes

Before enforcing `NOT NULL` later, verify:
- no active room has `rooms.target_amount is null`;
- every non-null `rooms.target_amount > 0`;
- every room target is `>= max(goals.target_amount)` for current
  members;
- every member goal is `>= sum(buckets.target_amount)` for that member;
- no `savings_logs.amount <= 0` rows exist.

### Follow-up migration, not v1

After production data is verified, add a separate follow-up migration to
enforce `rooms.target_amount not null`. Do not combine that with v1.

## 3. RPC Changes

### `update_room_goal`

Replace the current `update_room_goal(p_room_id, p_target_amount,
p_end_date)` body.

Contract preservation:
- keep the existing function name, argument list, and return shape;
- existing callers must continue compiling without TypeScript or SQL
  callsite changes caused by this RPC contract;
- if implementation discovers the return shape must change, stop and
  report before coding that change;
- after `CREATE OR REPLACE FUNCTION`, preserve the current privilege
  posture by revoking from `public` and granting only to
  `authenticated`.

It must:
- require `auth.uid()`;
- require `p_room_id`, `p_target_amount`, and `p_end_date`;
- require `p_target_amount > 0`;
- require caller membership in the room;
- require caller equals `rooms.created_by`;
- reject archived rooms;
- reject `p_target_amount < max(existing member personal goals)`;
- keep the existing "end date cannot be before an existing goal start
  date" guard unless implementation proves `goals.start_date` is no
  longer read anywhere meaningful;
- update only `public.rooms.target_amount` and `public.rooms.end_date`;
- not insert, update, or overwrite any member `goals.target_amount`.

It should still be the only normal path for creator room-goal edits.
Client code can keep calling `notify_goal_changed(roomId)` after a
successful room-goal edit; this task does not change notification fan-out.

### `update_member_goal`

Add a new security-definer RPC for personal sub-goal edits. Preferred
signature:

`update_member_goal(p_room_id uuid, p_target_amount numeric)`

Return shape:
- return `void`, matching `update_room_goal` and keeping this as a
  command-style RPC;
- after success, the client should refresh or update local goal state
  through the hook layer rather than depending on a custom RPC payload;
- if implementation discovers a payload is required, stop and report
  before coding a different shape.

Do not accept a user id unless there is a strong implementation reason.
If a user id argument is kept for compatibility, reject it unless it
equals `auth.uid()`.

It must:
- require `auth.uid()`;
- require caller membership in `p_room_id`;
- reject archived rooms;
- require `p_target_amount > 0`;
- require room target to exist; during rollout, use the backfilled
  `rooms.target_amount`, and if null return a clear "room goal not set"
  error rather than guessing;
- reject `p_target_amount > rooms.target_amount`;
- compute the caller's bucket target total and reject
  `p_target_amount < bucket target total`;
- upsert only the caller's `goals` row for that room;
- preserve existing `goals.start_date` where present;
- use `rooms.end_date` only to satisfy the legacy non-null
  `goals.end_date` column on insert;
- update `goals.updated_at`.

No notification is sent for personal sub-goal edits in v1.

### `bootstrap_joiner_goal`

Update `bootstrap_joiner_goal` so a new joiner gets an initial personal
sub-goal row without changing room-cap behavior.

Recommended seed:
- `goals.target_amount = rooms.target_amount`;
- `goals.start_date = least(current_date, rooms.end_date)`;
- `goals.end_date = rooms.end_date`.

Fallback only for migration gaps:
- if `rooms.target_amount` is null, use the max positive current member
  goal for that room;
- never insert 0, because `goals.target_amount` is positive-only.

### Direct write hardening

RPC validation alone is not enough because existing RLS allows direct
creator room updates and own goal updates.

Add trigger-level defense in depth:
- add a room target invariant trigger on `rooms` before
  `target_amount` updates. Name it explicitly in the migration, for
  example `trg_rooms_target_amount_invariant`, backed by a function such
  as `enforce_room_target_amount_invariant()`. It must prevent
  `target_amount <= 0` and prevent lowering a room target below max
  current member personal goals.
- add a personal goal invariant trigger on `goals` before insert or
  update. Name it explicitly in the migration, for example
  `trg_goals_personal_target_invariant`, backed by a function such as
  `enforce_personal_goal_target_invariant()`. It must prevent personal
  goals above `rooms.target_amount` and below that member's bucket target
  total.
- triggers must skip unchanged irrelevant columns where appropriate, so
  updates to unrelated `rooms` or `goals` fields do not perform needless
  validation or block valid legacy maintenance writes.
- triggers must be compatible with `createRoom` and
  `bootstrap_joiner_goal`: new room creation with a positive
  `rooms.target_amount`, creator goal seeding, and joiner goal seeding
  must pass without special client-side ordering hacks.

These triggers protect direct PostgREST/Supabase writes and future
callers that accidentally bypass the RPCs.

## 4. RLS And Policy Considerations

- Keep `rooms_select_member`: room members need to read
  `rooms.target_amount`.
- Keep `rooms_update_creator`: creator-only room updates remain valid,
  but the new room-target trigger must enforce invariants even when the
  creator writes directly.
- Keep `goals_member_select`: member rows and Member Detail need to read
  each member's personal sub-goal.
- Keep `goals_own_upsert` and `goals_own_update` only if the new goal
  trigger enforces the same bounds as `update_member_goal`. Otherwise
  direct writes could bypass `personal <= room goal` or
  `personal >= bucket total`.
- `update_room_goal` and `update_member_goal` must be
  `security definer`, `set search_path = public`, revoked from
  `public`, and granted only to `authenticated`.
- No RLS policy should let the creator update another member's
  `goals.target_amount` in v1.
- No policies on `savings_logs`, balance tables, notifications, or push
  subscriptions are changed.

## 5. TypeScript Data Model Changes

- Update `Room` in `src/types/index.ts` with
  `target_amount?: number | null`.
- Update `Goal` comments to say `target_amount` is the member's
  personal sub-goal for the room.
- Add a small room-goal view type if useful, for example:
  `RoomGoal = { room_id: string; target_amount: number | null;
  end_date: string }`.
- Update `LeaderboardEntry` so the denominator is explicit:
  either add `personalGoalTarget` and keep `target` as a temporary alias,
  or rename `target` only if every callsite is updated in the same task.
  The plan prefers adding `personalGoalTarget` first to reduce breakage.
- Update local room creation objects in `useRooms.createRoom` to include
  `target_amount`.
- No Saving Plan revision types change.

## 6. Hook Changes

### `useGoal`

Refactor `useGoal(roomId)` into the canonical source for both goal
concepts.

Expose:
- `roomGoal`: room target/end-date row, from `rooms`;
- `personalGoal`: caller's `goals` row;
- `roomGoalTarget: number | null`;
- `personalGoalTarget: number | null`;
- `roomGoalEndDate: string | null`;
- `saveRoomGoal({ target_amount, end_date })`;
- `saveMemberGoal({ target_amount })`;
- `refetch`.

Compatibility:
- Keep `goal` as an alias for `personalGoal` only during the migration
  window, or update all callsites in the same PR.
- Remove or stop exporting the direct `save` upsert helper. Personal
  sub-goal writes should go through `update_member_goal`.

Fetching:
- fetch the caller's `goals` row and the `rooms.target_amount/end_date`
  row in parallel;
- normalize numeric strings to numbers;
- subscribe to the caller's `goals` row for personal sub-goal changes;
- subscribe to the room row for `target_amount` and `end_date` changes
  so non-creators see creator room-goal edits without a refresh.

Fallback:
- while `rooms.target_amount` is nullable, derive a legacy room target
  from current leaderboard totals only as a UI fallback when the room
  target is null;
- surface null in diagnostics so missing backfill rows are visible.

### `useLeaderboard`

- Continue using `goals.target_amount` for each member row.
- Label that value as the member's personal sub-goal in comments and
  returned shape.
- Keep saved totals as Recorded Deposits from positive `savings_logs`.
- Do not read `rooms.target_amount` here unless needed for a fallback;
  room goal belongs to `useGoal`.

### `useSavingsTotal`

- No semantic change. It remains a caller-only recorded-deposit sum.
- Do not use it as the room Vault total.

### `DataContext`

- Update the `goal` return type to the new `useGoal` shape.
- Keep existing consumers compiling by migrating callsites in the same
  slice.
- Do not add private Member Detail data or Reconcile data to solve this
  task.

## 7. Dashboard Changes

- Vault saved remains `sum(leaderboard.entries[*].saved)`, which is the
  sum of Recorded Deposits across all members.
- Vault denominator becomes `roomGoalTarget`, not the sum of personal
  goals.
- `TotalVaultCard.target` receives `roomGoalTarget ?? legacy fallback`.
- Member rows use each member's personal sub-goal:
  `entry.personalGoalTarget` or the temporary `entry.target` alias.
- If a member has no personal goal row, show an unset state for that
  member instead of silently using the room goal. For the current user,
  offer a path to Manage Project to set the personal sub-goal.
- Remove the Dashboard room-goal edit modal in v1.
- Dashboard room-goal edit affordance decision:
  - creators who can edit the room goal from Dashboard must be
    navigated to `/manage-project`;
  - non-creators must not see a Dashboard room-goal edit affordance;
  - Manage Project is the only editing surface for both room goal and
    personal sub-goal in v1.
- If the existing goal-change request remains in the codebase, it should
  not be the primary v1 path for this feature.
- Update `AppLayout` milestone celebration denominator to use
  `roomGoalTarget`; it currently matches the old Dashboard
  sum-of-targets behavior.
- Keep Dashboard charts from mixing states: Recorded Deposits for Vault,
  Saving Plan expected values for plan insight, Verified Balance only in
  the existing verified-balance slot.

Server-side smart event note:
- `_smart_check_goal_reached` currently reads the depositor's
  `goals.target_amount` and compares it to combined room deposits.
  With the new semantics, `_smart_check_goal_reached` must be updated in
  this task to use `rooms.target_amount` as the room-level target.
- After this feature lands, `_smart_check_goal_reached` must not use
  `goals.target_amount` as the room goal.
- Change only the target source and the payload target if needed. Do not
  change fan-out recipients, dedupe shape, push behavior, or
  notification transport in this task.

## 8. Manage Project Changes

Manage Project becomes the primary goal-management surface.

### Creator view

Show:
- a "Room goal" section with target amount and end date, editable by the
  creator through `saveRoomGoal`;
- a "Your personal sub-goal" section, editable by the creator only for
  their own member goal through `saveMemberGoal`;
- room goal validation copy that says the room goal cannot be below the
  highest existing personal sub-goal;
- personal sub-goal validation copy that says the personal sub-goal must
  be between the user's bucket target total and the room goal.

The creator must not see controls for editing another member's personal
sub-goal in v1.

### Non-creator view

Show:
- the room goal and end date as read-only;
- the user's own personal sub-goal as editable;
- the same personal sub-goal min/max validation.

Non-creators cannot edit `rooms.target_amount` or `rooms.end_date`.

### Bucket manager integration

Pass `personalGoalTarget` to `BucketManager.goalTarget`, not
`roomGoalTarget`.

## 9. Bucket Validation Updates

Bucket target totals are bounded by the member's personal sub-goal.

Client updates:
- `useBuckets.saveBuckets` should keep checking the caller's
  `goals.target_amount`, but user-facing copy must say "personal
  sub-goal" instead of "main goal".
- `Dashboard` add-bucket modal and `ManageProject` bucket modal must use
  `personalGoalTarget`.
- `BucketManager` prop naming can stay `goalTarget` for a small diff, or
  be renamed to `personalGoalTarget` if all callsites are updated.
  User-facing text should be updated either way.

Database updates:
- keep `buckets.target_amount > 0`;
- keep `savings_logs.amount > 0`;
- keep `enforce_bucket_sum_le_goal`, but update comments/error text to
  personal-goal language;
- add the `goals` trigger described above so lowering a personal
  sub-goal below existing bucket targets is blocked even on direct goal
  writes.

No bucket allocation hacks, negative deposits, withdrawal flows, or
Reconcile allocation changes are introduced.

## 10. Profile Display Updates

- Update create-project copy so the target field is clearly the room
  goal.
- `useRooms.createRoom` must insert `rooms.target_amount` and seed the
  creator's personal `goals.target_amount` to the same amount for a new
  room.
- Any active-project summary that displays a target should distinguish:
  room goal vs your personal sub-goal.
- The Profile page should continue to link to Manage Project for goal
  editing; do not re-add standalone bucket or quick-amount management to
  Profile.
- Join flow behavior stays the same except that `bootstrap_joiner_goal`
  seeds the joiner's personal sub-goal from the room goal.

## 11. Saving Plan Verification

Saving Plan remains independent.

No schema changes:
- do not alter `saving_plans`;
- do not alter `saving_plan_revisions.target_amount`;
- do not rewrite existing saving plan revisions;
- do not connect saving plans to `rooms.target_amount`.

Client behavior:
- For a new plan with no existing revisions, the form may continue to
  seed the initial target from the user's `personalGoalTarget` as a
  convenience.
- Once a plan revision exists, the form uses the revision's own
  `target_amount`, exactly as it does today.
- Changing the room goal must not change any existing saving plan target.
- Changing the personal sub-goal must not change any existing saving plan
  target.
- Saving Plan progress continues to use Recorded Deposits via
  `recorded_deposits_summary`, not Verified Balance and not Planned
  Balance inserted into logs.

Manual verification must explicitly cover this because the current
`SavingPlan` page seeds from `goal.target_amount`.

## 12. Backward Compatibility For Existing Rooms

Compatibility contract:
- existing room Vault saved numbers do not change;
- existing room Vault denominator does not change immediately after the
  backfill;
- existing member row denominators do not change;
- existing bucket capacity does not change for any member;
- existing personal goal rows remain untouched by the backfill;
- rooms with valid existing goals receive a non-null `rooms.target_amount`;
- rooms with no positive goal source are left nullable and flagged for
  manual repair before a `NOT NULL` migration.

Deployment compatibility:
- Preferred rollout for Task 37 is one locked database plus client
  release: add `rooms.target_amount`, backfill, add triggers, add
  `update_member_goal`, replace `update_room_goal`, update
  `_smart_check_goal_reached`, and deploy the client that reads room
  target and personal sub-goals together.
- Avoid a long window where old clients expect `update_room_goal` to
  sync member `goals.target_amount` rows.
- No partial rollout is allowed if it lets old clients silently desync
  room goal and personal goals.
- If split rollout is unavoidable, use this safe order:
  1. First deploy additive database work only: nullable
     `rooms.target_amount`, backfill, validation triggers that preserve
     current writes, and `update_member_goal`; keep old
     `update_room_goal` sync behavior during this temporary window.
  2. Then perform a locked client plus RPC release: deploy the new
     client, replace `update_room_goal` so it only writes
     `rooms.target_amount` and `rooms.end_date`, and update
     `_smart_check_goal_reached` to read `rooms.target_amount`.
  3. Temporarily allowed behavior during step 1 only: old clients may
     continue syncing member goals through `update_room_goal`. That
     behavior ends at the locked client plus RPC release and must not
     overlap with new clients expecting independent personal sub-goals.

## 13. Acceptance Criteria

- Creator creates a room with room goal 75,000. The room row stores
  `rooms.target_amount = 75000`; the creator's personal goal row is also
  seeded to 75,000.
- Vault total remains the sum of positive recorded deposits across all
  room members.
- Dashboard Vault denominator is the room goal.
- Each member row denominator is that member's personal sub-goal.
- Existing rooms show the same Vault denominator and member row
  denominators immediately after migration/backfill.
- Dashboard creators who use the room-goal edit affordance are routed to
  `/manage-project`.
- Dashboard non-creators do not see a room-goal edit affordance.
- Manage Project is the only v1 editing surface for room goal and
  personal sub-goal.
- Creator can edit the room goal and end date from Manage Project.
- Non-creators see the room goal and end date as read-only.
- Every member can edit only their own personal sub-goal.
- Creator cannot edit another member's personal sub-goal.
- Room goal update rejects values below the max existing personal
  sub-goal.
- `update_room_goal` keeps its existing function name, arguments, return
  shape, revoke/grant posture, and existing callers continue compiling.
- `update_member_goal` returns void.
- Personal sub-goal update rejects values <= 0.
- Personal sub-goal update rejects values above the room goal.
- Personal sub-goal update rejects values below that member's bucket
  target total.
- Bucket creation/update still rejects bucket totals above the user's
  personal sub-goal at both client and database layers.
- Saving Plan revision targets do not change when room goal or personal
  sub-goal changes.
- `_smart_check_goal_reached` compares combined room deposits against
  `rooms.target_amount`.
- `goal_reached` payload target, if present, reflects the room target
  from `rooms.target_amount`, not a member's personal sub-goal.
- No room-cap behavior changes.
- No notification fan-out recipients, dedupe shape, push behavior, or
  notification transport changes.
- No Member Detail privacy behavior changes.
- No negative deposits, withdrawals, or Recorded Deposits / Verified
  Balance / Planned Balance mixing.

## 14. Manual QA

### Migration and existing room checks

- [ ] Snapshot an existing room's Dashboard Vault denominator, member row
      denominators, bucket capacity, and Saving Plan target before the
      migration.
- [ ] Apply migration.
- [ ] Confirm `rooms.target_amount` backfilled for the room.
- [ ] Confirm every existing `goals.target_amount` is unchanged.
- [ ] Open Dashboard and confirm Vault denominator and member row
      denominators match the pre-migration snapshot.
- [ ] Confirm milestone modal thresholds still use the same denominator
      immediately after backfill.
- [ ] Create a new room and confirm the room target invariant trigger
      permits positive `rooms.target_amount` plus creator goal seeding.
- [ ] Join a room and confirm the personal goal invariant trigger permits
      `bootstrap_joiner_goal` to seed the joiner's personal sub-goal from
      the room target.

### Room goal edits

- [ ] Creator edits room goal to a valid amount above all personal
      sub-goals from Manage Project; Dashboard Vault denominator
      updates.
- [ ] Dashboard room-goal edit affordance navigates creators to
      `/manage-project` instead of opening an edit modal.
- [ ] Non-creators do not see a Dashboard room-goal edit affordance.
- [ ] Manage Project is the only v1 editing surface for room goal and
      personal sub-goal.
- [ ] Creator attempts room goal below the highest personal sub-goal;
      SQL rejects it and UI shows clear copy.
- [ ] Non-creator sees room goal read-only and cannot call
      `update_room_goal` successfully.
- [ ] Existing member personal goals remain unchanged after room goal
      edit.

### Personal sub-goal edits

- [ ] Member edits their personal sub-goal within bounds; their row
      denominator updates.
- [ ] Member tries 0 or a negative value; rejected.
- [ ] Member tries above room goal; rejected.
- [ ] Member tries below their bucket target total; rejected.
- [ ] Creator tries to edit another member's personal sub-goal; rejected.

### Buckets and deposits

- [ ] Bucket creation uses personal sub-goal capacity.
- [ ] Bucket edit uses personal sub-goal capacity.
- [ ] Database trigger rejects a direct bucket write above personal
      sub-goal.
- [ ] Deposit flow remains fast and positive-only.
- [ ] No withdrawal or negative `savings_logs` path appears.

### Goal reached notification

- [ ] Seed a room where combined positive recorded deposits reach
      `rooms.target_amount` while at least one member's personal
      sub-goal differs from the room target.
- [ ] Confirm `goal_reached` fires based on `rooms.target_amount`, not
      any member's personal sub-goal.
- [ ] Confirm the `goal_reached` payload target, if present, equals
      `rooms.target_amount`.
- [ ] Confirm fan-out recipients, dedupe shape, push behavior, and
      notification transport match the pre-Task-37 behavior.

### Dashboard and Profile

- [ ] Vault saved equals sum of recorded deposits across members.
- [ ] Vault denominator equals room goal.
- [ ] Member rows use personal sub-goals.
- [ ] Profile create-project target copy reads as room goal.
- [ ] Manage Project exposes room goal and personal sub-goal separately.

### Saving Plan

- [ ] Existing Saving Plan target remains unchanged after room goal edit.
- [ ] Existing Saving Plan target remains unchanged after personal
      sub-goal edit.
- [ ] New plan creation still writes the user-entered target into
      `saving_plan_revisions.target_amount`.
- [ ] Saving Plan progress uses Recorded Deposits summary, not Verified
      Balance.

### Non-goal regression

- [ ] 7-member cap still works; 8th join still fails.
- [ ] Notification fan-out still sends existing events to the same
      recipients as before.
- [ ] Member Detail does not query or display private balance/reconcile
      data.

## 15. Rollback Plan

Fast rollback:
- Revert the frontend to the previous goal model.
- Keep `rooms.target_amount` in place temporarily; it is additive and
  harmless if unused.
- Restore the previous `update_room_goal` behavior only if the frontend
  rollback needs shared goal sync again.

Database rollback:
- Before reverting database behavior, export `rooms.id`,
  `rooms.target_amount`, and all `goals.target_amount` rows. Personal
  sub-goals may have diverged, and collapsing them back into a shared
  goal is lossy.
- If rolling all the way back to shared goals, decide explicitly whether
  to overwrite every member goal with `rooms.target_amount` or with the
  creator's personal goal. Do not do this silently.
- Drop `update_member_goal` only after no deployed client calls it.
- Drop validation triggers only if the old shared-goal trigger/RPC path
  is restored.
- Drop `rooms.target_amount` only in a final cleanup migration after data
  backup and product approval.

Partial rollback:
- If only the UI has issues, leave the migration in place and hide the
  new personal sub-goal editor. Existing data remains valid.
- If only `update_room_goal` has issues, temporarily block room-goal
  edits in the UI while preserving personal sub-goal reads.

## 16. Risks And Rollout Order

### Main risks

- Current code uses two different denominators for "goal": caller goal
  in editors/buckets and summed member goals in Vault/milestones. The
  backfill must preserve the current visible Dashboard denominator or
  existing rooms will appear to change.
- Direct writes can bypass RPC validation unless triggers are added.
- `update_room_goal` deployment timing matters. Old clients expect it to
  sync member goals; new clients require it not to.
- `goals.end_date` becomes legacy metadata once room end date lives only
  on `rooms`. All display and Saving Plan seed paths must use
  `rooms.end_date`.
- `_smart_check_goal_reached` currently reads `goals.target_amount` as a
  room target. It must be updated in Task 37 to read
  `rooms.target_amount` without changing fan-out recipients, dedupe
  shape, push behavior, or notification transport.
- Saving Plan form seeding from `goal.target_amount` can accidentally be
  mistaken for coupling. QA must prove revisions remain independent.

### Rollout order

1. Read-only audit: confirm all current target callsites from this plan
   still match the code before implementation starts.
2. Preferred locked Task 37 release: in one coordinated database plus
   client release, add nullable `rooms.target_amount`, backfill,
   verification SQL, validation triggers, `update_member_goal`, the
   preserved-contract `update_room_goal` replacement,
   `_smart_check_goal_reached` room-target update, hook/type changes,
   Dashboard/AppLayout changes, Manage Project editors, Profile copy,
   and bucket validation labels.
3. Saving Plan verification: run manual checks proving revision targets
   are independent.
4. Regression QA: existing rooms, room cap, notification fan-out,
   Member Detail privacy, positive-only deposits.
5. If the locked release must be split, use only the safe order from
   Deployment compatibility: additive database first while preserving
   old `update_room_goal` sync behavior, then a locked client plus RPC
   release that ends that temporary behavior. Do not ship a partial
   rollout that lets old clients silently desync room goal and personal
   goals.
6. Follow-up only after production verification: enforce
   `rooms.target_amount not null`.

End of Task 37 plan.
