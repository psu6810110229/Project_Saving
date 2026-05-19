# Multi-User Room + Companion Features — Planning Document

Status: Planning only. No code, no migrations, no implementation in this document.
Owner: Senior FE / FS pair (Claude) with Fran (junior dev).
Date drafted: 2026-05-20.

This document plans five separable feature tasks that, together, evolve GO-OUT
from a strict 1:1 (2-player) shared savings tracker into a small-group tracker
(2 to 7 members) while adding plan-start push notifications, a per-member
profile drill-in, room renaming, and per-member sub-goals under a single room
goal.

The current 2-user behaviour MUST continue to work end-to-end while these
land. Money rules from `CLAUDE.md` stay in force:
- `savings_logs.amount > 0` only; no negative deposits.
- No withdrawals or bucket allocation hacks.
- No silent mixing of Recorded Deposits / Verified Balance / Planned Balance.
- Reconcile remains personal; partner sees sanitized activity only.

The feature list below is intentionally ordered for review; the recommended
implementation order is at the bottom.

---

## Cross-feature context (read this first)

Relevant existing surfaces these features touch:
- DB: `rooms`, `room_members`, `goals`, `savings_logs`, `buckets`,
  `saving_plans`, `saving_plan_revisions`, `saving_plan_pauses`,
  `notifications`, `notification_preferences`, `push_subscriptions`,
  `nudges`, `balance_checkpoints`, `balance_adjustments`,
  `milestone_acknowledgements`, `streak_freeze_*`.
- RPCs already enforcing 2-player cap or creator-only:
  `join_room_by_code` (0023), trigger `enforce_two_player_cap` (0023),
  `update_room_goal` (0025 / 0029), `archive_room` / `restore_room` (0020),
  `room_members_for_room` (0016).
- Client state: `RoomContext` (active room), `useRoom`, `useRooms`,
  `useLeaderboard`, `usePartnerBuckets`, `usePartnerSavingPlan`,
  `useReactionBroadcast`, `useSavingPlan`, `useNotifications`.
- UI: `Dashboard.tsx`, `HeadToHeadCard`, `PlayerProgressRow`,
  `TotalVaultCard`, `BucketGrid`, `SavingPlanCard`, `ManageProject.tsx`,
  `Profile.tsx`, `JoinProjectFlow`, `BottomNav`.
- Edge functions: `scheduled-saving-reminders`, `notify-partner-deposit`,
  `send-nudge` (all run with service role and use VAPID web-push).

Decisions that apply across multiple tasks (so individual tasks stay short):
1. The hard cap of 7 members is enforced in three places: the
   `join_room_by_code` RPC, the `room_members` BEFORE INSERT trigger, and the
   client (disable the QR/invite share once room is full). Three layers
   mirrors the existing 2-player approach.
2. "Room creator" remains the only privileged role. We deliberately do NOT
   introduce a generic admin / role table in this round — keeps RLS simple
   and reversible. If we later add admins, every "creator-only" check becomes
   a "creator-or-admin" helper.
3. The room/main goal becomes a true room-level field (`rooms.target_amount`).
   Each member's `goals.target_amount` becomes their personal sub-goal,
   bounded by the room goal.
4. All partner-facing reads that today assume exactly one "partner" must be
   generalised to "every other room member". Hooks named `usePartner…` are
   either generalised to `useRoomMembers…` or kept as a thin wrapper over a
   new multi-member hook. Old names must not be removed without callers being
   updated in the same task.
5. Push notifications continue to flow through the existing
   `notifications` table + edge-function path. No new transport.

---

## Feature 1 — Plan-start push notification

### Product requirement
When a member creates (or changes) a saving plan whose first revision's
`effective_from_date` is in the future, the app must automatically deliver a
push notification to that owner on the morning (Bangkok-local) of the plan
start date, telling them "Your saving plan starts today."

Scope:
- Owner-only notification. Not sent to partners/room members.
- Fires once per plan revision start (deduped by plan_id + revision_id +
  start date).
- Honors existing notification preferences (`master_enabled`,
  `saving_reminders_enabled` OR a new `plan_lifecycle_enabled`; see
  decision below).
- Surfaces in the in-app Notification Center as well as push.

### Affected files/components
- `supabase/functions/scheduled-saving-reminders/index.ts` — extend the cron
  loop to also call a new `enqueue_plan_start_notifications()` RPC, OR add a
  sibling edge function. Recommendation: reuse the same scheduled function;
  one cron, one VAPID flow, one secret.
- New migration (NOT in this doc): `00xx_plan_start_notifications.sql`.
- `src/types/index.ts` — add `'plan_started'` to `NotificationEventKey`.
- `src/components/Notifications/*` — render new event type (icon + copy).
- `src/i18n/*` — EN + TH strings for title/body and CTA.
- `src/hooks/useNotificationPreferences.ts` — only if a dedicated toggle is
  added.
- Possibly `src/hooks/useSavingPlan.ts` to render an "Upcoming start" badge
  before the start date (already partly handled).

### Database / schema changes needed
New migration adds:
- A security-definer RPC `enqueue_plan_start_notifications()` that:
  - Selects active `saving_plans` whose earliest revision has
    `effective_from_date = today (Bangkok)` AND the plan was created before
    today (so we do not fire on same-day plan creations — those should be
    handled by `plan_created`, not `plan_started`).
  - Filters by `notification_preferences.master_enabled` AND a new toggle
    (`plan_lifecycle_enabled` default `true`) OR reuses
    `saving_reminders_enabled` — see Decision A.
  - Inserts one notification per eligible plan with
    `event_key = 'plan_started'`, `category = 'saving_reminder'` (or
    new `'plan_lifecycle'` — see Decision A), `dedupe_key =
    'plan_started:<plan_id>:<effective_from_date>'`, `target_route =
    '/saving-plan'`, `fallback_route = '/saving-plan'`,
    `push_safe = true`.
  - Returns inserted rows so the edge function can push them.
- A morning time gate at the SQL layer (e.g. only fire if Bangkok hour ∈
  [7, 10]) so reminders land at breakfast and not at midnight.
- Optional: a column on `saving_plans` like `start_notified_at timestamptz`
  for cheap dedupe — though the existing `notifications.dedupe_key` unique
  constraint already handles this; column adds redundancy and is NOT
  required.

Decision A (pick during implementation, not now):
- Option 1: add `plan_lifecycle_enabled` preference + `'plan_lifecycle'`
  category. Cleaner conceptually; one more migration column + UI toggle.
- Option 2: classify under existing `'saving_reminder'` category. Zero new
  preference plumbing; downside is users who muted saving reminders also
  miss plan-start. Recommended for v1 because it is reversible.

### RPC / RLS / permission changes
- New SECURITY DEFINER function as above, callable only by service role
  (`revoke all from public`, `grant execute to service_role` is implicit but
  we explicitly grant to `authenticated` only if we want manual debugging —
  default no).
- No RLS changes on `notifications` itself — existing
  `notifications_select_own` is sufficient.
- No client write paths added; this is server-driven only.

### UX / UI changes
- New notification cell in the Notification Center: title "Your saving plan
  starts today", body short, CTA "Open plan" → `/saving-plan`.
- On the Saving Plan screen, optionally show a small "Plan starts in N days"
  pill (already plausibly present — verify before adding).
- Settings: if Decision A → Option 1, add a toggle row in Notification
  Settings under "Saving reminders".

### Notification behavior
- Quiet hours: do not fire before 07:00 Bangkok or after 10:00 Bangkok on
  the start date.
- Dedupe: enforced by `(recipient_user_id, dedupe_key)` unique constraint.
- If push fails (404/410 endpoint), in-app row remains; expired endpoints
  removed by the existing edge function loop.
- If the user creates a plan with `effective_from_date = today`, they get
  the existing `plan_created` notification, NOT `plan_started`.
- If a future revision is added that shifts the start, the **plan**'s start
  date is the earliest revision; re-firing on subsequent revisions is out
  of scope for v1.

### Implementation steps
1. Add `'plan_started'` to `NotificationEventKey` type + i18n copy.
2. Write migration adding `enqueue_plan_start_notifications()` RPC.
3. Wire `scheduled-saving-reminders/index.ts` to call the new RPC after the
   existing saving-reminders RPC, on the same cron tick.
4. Add notification cell rendering for `plan_started`.
5. Manual QA (see checklist).
6. Add unit/integration coverage for the RPC if test infra exists.

### Acceptance criteria
- A plan created with `effective_from_date = today + 5` causes exactly one
  in-app `plan_started` notification and exactly one push delivery on
  day +5, between 07:00–10:00 Bangkok.
- Re-running the cron the same day does not insert a duplicate (dedupe key
  holds).
- A plan created with `effective_from_date = today` does NOT trigger
  `plan_started` (only `plan_created`).
- User who disabled `master_enabled` receives nothing.
- User with no push subscription still gets the in-app notification.

### Manual QA checklist
- [ ] Insert a plan with a future start; confirm DB row exists and no
      notification fires before start day.
- [ ] Wait/force cron run on start day morning (mock the time gate in dev),
      verify single push + in-app cell.
- [ ] Tap notification → routes to `/saving-plan`.
- [ ] Run cron a second time → no duplicate.
- [ ] Disable master → no notification.
- [ ] Disable push but keep in-app → in-app appears, no push.
- [ ] Verify TH copy renders correctly.

### Risk level
Low.
- The notification infrastructure is mature; this is one more RPC + one
  more event key.
- Time gate + dedupe key are SQL-enforced, not client-trusted.

### Rollback notes
- The migration is additive (new RPC + optional column). Rollback = drop
  the RPC. Notifications already created remain harmless.
- Edge function change is one extra RPC call; revert the function deploy
  to disable.

---

## Feature 2 — Multi-user rooms (2 → up to 7 members)  ⚠️ HIGH RISK SCHEMA

### Product requirement
Rooms must support 2–7 members. Joining a room with 7 existing members
returns "room is full". The 1:1 head-to-head experience must gracefully
adapt to N players.

### Affected files/components
DB & RPCs:
- `0023_two_player_cap.sql` — `join_room_by_code` returns `'full'` only at
  ≥2. Must become ≥7.
- `enforce_two_player_cap` trigger — rename to `enforce_room_capacity` and
  read the cap from a constant (or a `rooms.max_members` column).
- `update_room_goal` (0025 / 0029) — already loops over all
  `room_members`; should work unchanged for N members.
- `room_members_for_room` (0016) — already returns all members.
- Any RPC or RLS policy that assumes exactly one "other" user — audit
  needed. Known suspects: `partner_buckets_visibility` (0019),
  `partner_saving_plan_visibility` (0047),
  `partner_activity_*` (0040, 0041), `goal_change_request_notification`
  (0049).

Hooks:
- `usePartnerBuckets.ts` → generalise to fetch buckets for every member
  (excluding self). Either rename to `useRoomMembersBuckets` or refactor
  the internals.
- `usePartnerSavingPlan.ts` → same generalisation.
- `useLeaderboard.ts` → already iterates over all `room_members`; verify
  sort + tie-break still correct for N entries.
- `useReactions*` → reactions today are 1:1; for N people decide whether
  reactions remain "to the room" or become "from→to specific user".
  Recommended: keep room-scoped for v1.
- `useReconcile.ts` → personal; no change.
- `useSavingsTotal.ts` — verify it sums over all members for room totals.

UI:
- `Dashboard.tsx` — replace `HeadToHeadCard` (which expects exactly 2
  `PlayerInput`s) with a scalable list. Likely a new
  `RoomLeaderboardCard` rendering N `PlayerProgressRow`s, with the leader
  badged. `HeadToHeadCard` can either be deleted or kept for 2-player
  rooms only (cleaner: delete and make the new list handle the 2-case).
- `TotalVaultCard` — totals already aggregate; verify.
- `BucketGrid` / `BucketRow` / partner buckets sections — partner buckets
  must be groupable per member. Recommended: a collapsible block per
  member labelled by avatar + name.
- `JoinProjectFlow` — error copy for "room is full (7/7)".
- `ManageProject.tsx` — member list with avatars + "joined date";
  creator can see invite/QR while < 7.
- `BottomNav` / `AppShell` — no change.
- `Profile.tsx` — small "in N rooms" stat unchanged.

### Database / schema changes needed
Two paths; pick during implementation (Decision B):

Option B1 — constant cap (simpler, recommended for v1):
- New migration that:
  - Drops `enforce_two_player_cap` trigger.
  - Creates `enforce_room_capacity` with `if current_count >= 7 then raise…`.
  - Replaces `join_room_by_code` to use the same constant.
  - Backfills nothing (existing rooms already have ≤ 2 members).
- Pros: zero schema churn, single source of truth (the SQL constant).
- Cons: changing the cap later requires another migration.

Option B2 — column-driven cap:
- Add `rooms.max_members int not null default 7 check (max_members between
  2 and 7)`.
- Trigger and RPC read from row. Creators could (in theory) lower the cap
  per room.
- Cons: more code paths, more UI to expose, more RLS surface; we do NOT
  need per-room cap configuration today.

Either option must verify the audit list above for "partner" assumptions.

### RPC / RLS / permission changes
- `join_room_by_code` — change `>= 2` to `>= 7` (or column reference).
- `enforce_two_player_cap` trigger renamed.
- Audit each RPC that names "partner":
  - `partner_saving_plan_visibility` RLS — should already be "room member
    other than caller"; verify the WHERE clause does not assume
    `user_id != caller AND room_members count = 2`.
  - `notify-partner-deposit` edge function — must fan out to every other
    room member, not just one. Push payload + in-app notification per
    recipient.
  - `goal_change_request_notification` — same fan-out.
  - `partner_activity_prefs` — keep one row per (recipient, source); fan
    out on event creation.
- `update_room_goal` already member-loops; verify the bucket-floor check
  (0029) tolerates N members (it does — `max(member_bucket_total)`).
- New RLS read policies are not needed; existing
  `room_members_select` (recursive-safe pattern from 0012) covers N.

### UX / UI changes
- Dashboard: switch to a vertical leaderboard list ordered by saved desc
  (current sort). Leader gets the badge; "tied" handling still applies.
- Member's row shows: avatar, name, saved / target (their personal
  sub-goal — see Feature 5), streak, today-checkmark.
- Tapping a row → Feature 3 member-detail.
- Partner buckets section becomes "Other members' buckets", grouped by
  member, collapsible.
- Manage Project: members list with badge for creator, "leave room"
  available for everyone except the creator (creator must transfer or
  archive — out of scope here, keep current creator-leave behaviour:
  archives the room).
- JoinProjectFlow: capacity error copy ("This project is full — it
  already has 7 members.").

### Notification behavior
- Every place that today sends a notification to "the partner" must fan
  out to "all other members of the room" by iterating
  `room_members_for_room`.
- Per-member preferences continue to gate each delivery.
- Dedupe keys for partner-activity events must include the recipient
  (they already do via the `(recipient_user_id, dedupe_key)` unique
  constraint), so fan-out cannot trip the constraint.
- Push fan-out cost: at most 6 recipients × ~3 devices = 18 push calls
  per event. Edge functions should tolerate this; no batching needed.

### Implementation steps
1. **Audit pass (read-only)**: list every "partner" assumption in SQL,
   hooks, components, and edge functions. Produce a small checklist.
2. Generalise hooks: `usePartnerBuckets` → all-other-members,
   `usePartnerSavingPlan` → all-other-members. Keep behaviour for 2-user
   rooms identical.
3. Replace `HeadToHeadCard` usage in `Dashboard.tsx` with a
   N-aware leaderboard list.
4. Update edge functions (`notify-partner-deposit`) to fan out.
5. Write the cap-raise migration (B1 chosen).
6. Update `JoinProjectFlow` error copy + capacity hint in Manage Project.
7. Manual QA across 2-, 3-, and 7-user scenarios.

### Acceptance criteria
- A 2-user room behaves exactly as before (no visible UX regression).
- A 3-user room shows 3 leaderboard rows; partner-buckets section shows
  buckets for 2 other members.
- The 8th user trying to join receives "room is full".
- Recording a deposit in a 4-user room delivers in-app notifications to
  the 3 other members (each respecting their own preferences).
- The total Vault number matches sum of every member's recorded deposits.

### Manual QA checklist
- [ ] Create a fresh room → invite + join until 7 members. 8th attempt =
      "full".
- [ ] Each member can see every other member's profile + buckets +
      saving plan (read-only).
- [ ] Deposit by member A → in-app notification appears for members B–G
      (push too, for those subscribed).
- [ ] Reconcile by member A leaves member B's view unaffected (Verified
      Balance remains personal).
- [ ] Bucket floor check still blocks lowering the room goal below any
      member's bucket total.
- [ ] Leaderboard sort + tied behaviour stays correct for N members.
- [ ] Archive/restore still creator-only.

### Risk level
**HIGH (schema + RLS + many hook touchpoints).** This is the riskiest
feature in the document. Land it on its own branch, with a freeze on
unrelated changes, and verify a 2-user demo end-to-end before merging.

### Rollback notes
- The cap-raise migration is additive (trigger replaced + RPC replaced).
  To roll back, redeploy the old `0023` definitions (drop new trigger,
  recreate old). All rooms with > 2 members would then start refusing new
  joins but existing members stay.
- Frontend changes: revert the leaderboard component; old
  `HeadToHeadCard` still in git history if kept as a separate commit.
- Edge functions: re-deploy previous version to stop fan-out.

---

## Feature 3 — Member detail view

### Product requirement
Tapping a member's row on Dashboard navigates to a screen showing that
member's profile (name, avatar, theme), their saving plan summary, and
their bucket list (read-only).

Privacy:
- Public to room members: display name, avatar, theme, sub-goal,
  recorded deposits total, saving plan summary, buckets + targets.
- Private (never shown to others): reconcile/Verified Balance, balance
  adjustments, checkpoint notes, push subscriptions, notification
  preferences, raw email.

### Affected files/components
- New page: `src/pages/MemberDetail.tsx` (route `/members/:userId`).
- New hook (optional): `useMemberSummary(userId, roomId)` aggregating
  profile + sub-goal + plan + buckets.
- `Dashboard.tsx` — make each leaderboard row navigate on tap.
- `App.tsx` (or wherever routes live) — register new route.
- Reuse `SavingPlanCard`, `BucketGrid`, `Avatar`, `ProgressBar`.
- `i18n/*` — page title + privacy line.

### Database / schema changes needed
- None. All required data is already readable by room members via
  existing RLS (`profiles`, `goals`, `buckets`, `saving_plans`,
  `saving_plan_revisions`) given the partner-visibility migrations
  (0019, 0047).
- One check: `saving_plan_pauses` visibility — verify members can read
  another member's pause history; if not, extend RLS via a small
  migration in a sub-task (NOT in this doc).

### RPC / RLS / permission changes
- No new RLS. Verify `saving_plan_pauses` row-level reads for room
  members (likely already covered by the 0047 visibility migration; if
  not, file a sub-task).
- Block the route unless the viewer is in the same active room as
  `:userId` — client check via `room_members_for_room`. SQL also still
  enforces it through existing RLS.

### UX / UI changes
- Header: avatar + name + theme accent + "Member of <project name>".
- Section 1: sub-goal progress bar (their `goals.target_amount`, their
  recorded deposits).
- Section 2: saving plan summary card — reuse `SavingPlanCard` in
  read-only mode (hide edit/pause CTAs).
- Section 3: bucket list — reuse `BucketGrid` in read-only mode.
- Footer: a single "Nudge" button (uses existing nudge throttle) only
  if recipient has not opted out.
- No reconcile / Verified Balance / private notes shown.

### Notification behavior
- Visiting the page does not generate notifications.
- The nudge button fires the existing `send-nudge` edge function flow
  (already supports any recipient).

### Implementation steps
1. Add route + page skeleton + breadcrumb back to Dashboard.
2. Reuse `SavingPlanCard` and `BucketGrid` in read-only mode (add a
   `readOnly` prop if not present).
3. Wire taps on Dashboard rows to navigate.
4. Verify RLS reads from a logged-in second account.
5. Manual QA in a 3-user room.

### Acceptance criteria
- Tapping a member row navigates to their detail page within ~300 ms.
- All three sections (profile, plan, buckets) populate.
- No reconcile/Verified Balance numbers appear anywhere on the page.
- Edit/pause/delete controls are hidden when viewing someone else.
- A non-member who guesses the URL gets an empty/forbidden state
  (because RLS returns no rows).

### Manual QA checklist
- [ ] Tap each member row → land on their page.
- [ ] Confirm sub-goal, plan, and buckets render.
- [ ] Confirm no Verified Balance / checkpoint data leaks.
- [ ] Try the URL while signed out → redirected to login.
- [ ] Try the URL as a non-member → empty state.
- [ ] Nudge button triggers exactly one push to the member.

### Risk level
Low–Medium. Mostly UI; the data is already readable. Medium because if
`SavingPlanCard` doesn't currently support `readOnly` we need a small
refactor.

### Rollback notes
- Pure additive — remove the route + page, restore original Dashboard
  tap behaviour (was none).

---

## Feature 4 — Rename room (creator only)

### Product requirement
The room creator can rename their room after creation; non-creators see
the field as read-only.

### Affected files/components
- DB: new migration adding `rename_room(p_room_id uuid, p_name text)`
  SECURITY DEFINER RPC.
- `ManageProject.tsx` — rename row + modal.
- `useRooms.ts` — `renameRoom(roomId, name)` helper.
- `i18n/*` — labels + validation messages.

### Database / schema changes needed
- No new tables/columns. Just one RPC.
- Validation in the RPC:
  - Caller is `auth.uid()` and equals `rooms.created_by`.
  - Room is not archived.
  - New name length 1–60 characters after trim; reject empty / whitespace.
  - Disallow names that contain control chars; trim leading/trailing
    spaces.

### RPC / RLS / permission changes
- The existing `rooms_update_creator` policy already allows the creator
  to update the row, so theoretically the client could update `name`
  directly. We still add the RPC because:
  - Centralises trimming + length validation.
  - Future-proofs if we add audit logging or push notifications on
    rename.
- `revoke all from public`, `grant execute to authenticated`.
- Optional: emit a `'room_renamed'` notification to all other members
  via `notifications` (Decision C below).

Decision C: notify on rename? Recommended **yes** with category
`'product'` or a new `'room_lifecycle'` event. Cheap, transparent, and
fits the spirit of "activity transparency over approvals".

### UX / UI changes
- Manage Project → "Project name" row.
  - Creator: tap → modal with text input pre-filled.
  - Non-creator: row shown but disabled / "Only the creator can rename".
- After save, success toast; the new name flows through `useRooms` →
  `RoomContext` → header label.

### Notification behavior
- Per Decision C: one in-app notification per other member, no push.
  Title: "<creator> renamed the project to <new name>." Tap → Dashboard.
- Dedupe key: `'room_renamed:<room_id>:<created_at_timestamp>'` to
  allow multiple renames over time but avoid duplicate notifications
  per render.

### Implementation steps
1. Write `rename_room` RPC + tests.
2. Add helper to `useRooms`.
3. Add UI row + modal to `ManageProject`.
4. Wire optimistic update on `RoomContext`.
5. Manual QA.

### Acceptance criteria
- Creator renames → header + project list reflect the new name on both
  members' clients within ~1 s (subject to realtime cadence).
- Non-creator attempting via direct SQL/REST → `42501` permission
  denied.
- Whitespace-only name rejected.
- Other members receive one notification (if Decision C → yes).

### Manual QA checklist
- [ ] Rename to a normal name → success, both clients update.
- [ ] Rename to "" or "   " → rejected with clear copy.
- [ ] Try as non-creator → row is read-only.
- [ ] Try via REST as non-creator → denied.
- [ ] Verify notification appears for other members.

### Risk level
Low.

### Rollback notes
- Drop the RPC, hide the UI row. Old creator-update policy stays in
  place; no data loss.

---

## Feature 5 — Individual main goals under room goal  ⚠️ MEDIUM-HIGH RISK SCHEMA

### Product requirement
The room creator sets the room/main goal (e.g. ฿75,000). Each member
sets their own personal sub-goal that cannot exceed the room goal. The
Vault total continues to be the sum of every member's recorded deposits
(not the sum of sub-goals).

This is a semantic change: today's `goals.target_amount` already exists
per (user, room) but is kept in sync to the room-wide value by
`update_room_goal`. After this feature, `goals.target_amount` becomes
the *personal sub-goal*, and the *room-wide* target moves to a
dedicated `rooms.target_amount` field.

### Affected files/components
DB:
- New migration: add `rooms.target_amount numeric(12,2)` (nullable for
  backward compatibility during cut-over).
- New / modified RPC: split `update_room_goal` into:
  - `update_room_goal(p_room_id, p_target_amount, p_end_date)` — creator
    only, writes `rooms.target_amount` + `rooms.end_date`. Does NOT
    overwrite each member's personal `goals.target_amount` anymore.
  - `update_member_goal(p_room_id, p_user_id, p_target_amount)` — member
    sets their own sub-goal. Validates 0 < amount ≤ rooms.target_amount.
  - Or: keep a single RPC that accepts both, with an arg discriminator.
    Recommended: two RPCs; clearer authorisation.
- Backfill: for each existing room, copy the most common current
  `goals.target_amount` (or `max`) into `rooms.target_amount`. Keep
  each member's personal goal as-is so behaviour is identical on day 1.

Hooks:
- `useGoal.ts` — now exposes both `roomGoalTarget` (from `rooms`) and
  `personalGoalTarget` (from `goals`).
- `useLeaderboard.ts` — `target` field becomes the personal sub-goal.
- `useSavingsTotal.ts` — verify it does not use `target` for math.

UI:
- `Dashboard.tsx` — Vault card shows room goal as denominator; each
  member's row shows personal sub-goal.
- `ManageProject.tsx` — split into "Room goal" (creator) and "Your
  personal sub-goal" (any member).
- `Profile.tsx` — show personal sub-goal under the project list.
- `BucketManager` — bucket floor check switches to "≤ personal
  sub-goal" (not "≤ room goal").

### Database / schema changes needed
- Add `rooms.target_amount numeric(12,2)` (nullable initially).
- Backfill from existing `goals` (see above).
- `update_room_goal`:
  - Stop upserting each member's `goals` row.
  - Validate `p_target_amount >= max(personal goal across members)`,
    not `max(bucket targets)` — bucket-floor check moves to
    `update_member_goal`.
- New `update_member_goal`:
  - Caller can only update their own row (or creator can update
    anyone's — Decision D, recommend self-only for v1).
  - Validate 0 < personal ≤ room target.
  - Validate personal ≥ sum of caller's bucket targets (existing
    bucket floor).
- Optional follow-up migration to enforce `rooms.target_amount not null`
  once backfill verified safe.

Decision D: who edits a member's sub-goal?
- Recommended: self only. Keeps RLS simple, matches "personal" framing.
- Alternative: creator can edit too. Adds permission complexity.

### RPC / RLS / permission changes
- Existing `goals` policies (`goals_own_upsert`, `goals_own_update`,
  `goals_member_select`) remain. Self-only edits are already enforced.
- `update_room_goal` stays creator-only.
- `update_member_goal` validates `auth.uid() = p_user_id`.

### UX / UI changes
- Manage Project (creator view):
  - "Room goal" card with the room-wide target + end date.
  - Below it: "Your personal sub-goal" with a number input bounded by
    `[sum-of-buckets, room-goal]`.
- Manage Project (non-creator view):
  - Read-only "Room goal" display.
  - Editable "Your personal sub-goal" card.
- Dashboard:
  - Vault card denominator = room goal (creator's authoritative target).
  - Leaderboard row denominator = each member's personal sub-goal.
  - If a member has no sub-goal set, show "Set your sub-goal" CTA.

### Notification behavior
- Changing the room goal continues to fire `goal_changed`
  notification to other members (existing flow).
- Changing a personal sub-goal does NOT notify others by default
  (private). If we want a "X set a sub-goal of ฿Y" event, defer to a
  later sub-task.

### Implementation steps
1. Write migration adding `rooms.target_amount`, backfill from existing
   data, do NOT yet enforce not-null.
2. Add `update_member_goal` RPC; modify `update_room_goal` to stop
   touching member goals.
3. Add a TS layer that derives `roomGoalTarget` and `personalGoalTarget`
   cleanly (single source of truth per concept).
4. Update Dashboard / ManageProject / Profile to use the right value in
   the right place.
5. Bucket floor: switch UI + trigger validation to personal sub-goal.
6. Manual QA, then a follow-up migration to set `rooms.target_amount`
   NOT NULL once production data is verified.

### Acceptance criteria
- Creator sets room goal = 75 000 → Vault card denominator is 75 000.
- Member A sets personal sub-goal = 30 000 → their row shows 30 000
  denominator and a personal progress bar.
- Member B sets personal sub-goal = 80 000 → rejected because >
  room goal.
- Member A sets personal sub-goal = 5 000 while their bucket total is
  6 000 → rejected (bucket floor).
- Vault total is `sum(recorded deposits across members)`, unchanged
  from today.
- A 2-user existing room shows identical numbers on day 1 after the
  migration backfill.

### Manual QA checklist
- [ ] Existing room (pre-migration) opens with identical UI after
      migration (backfill correctness).
- [ ] Creator changes room goal → other members see the new room
      denominator; their personal sub-goals stay where they were.
- [ ] Member edits personal sub-goal within bounds → success.
- [ ] Out-of-bounds edits are rejected at SQL and at the client.
- [ ] Bucket floor still enforced.
- [ ] Saving Plan math (which targets a `target_amount`) verified —
      Decision E below.

Decision E: which target does Saving Plan use?
- Saving plan currently uses its own `target_amount` per revision,
  independent of `goals` / `rooms`. So no change required, but
  verify during QA.

### Risk level
**Medium-High.** Touches the room/goal contract that almost every
screen reads. Migration ordering matters; do not enforce NOT NULL
until backfill is verified.

### Rollback notes
- Migration: backfill is data-only and reversible. Dropping
  `rooms.target_amount` requires a small reverse migration; old
  `update_room_goal` definition (0029) can be restored from git
  history.
- UI: revert the dashboard/manage-project changes; the old
  behaviour (each member's `goals.target_amount` is the room target)
  remains valid in the data.

---

## Recommended implementation order

1. **Feature 1 — Plan-start push notification.**
   Smallest blast radius, exercises the notification infra, gives the
   team a quick win + confidence in the cron path.
2. **Feature 4 — Rename room.**
   Independent of everything else; low risk; nice product polish.
3. **Feature 2 — Multi-user rooms (cap raise + fan-out).** ⚠️ HIGH RISK
   Land on a feature branch with a 2-user regression demo. Audit
   "partner" assumptions before touching code.
4. **Feature 3 — Member detail view.**
   Depends on Feature 2 (otherwise there is only ever one "other"
   member to tap). Quick to build once #2 is in.
5. **Feature 5 — Individual sub-goals under room goal.** ⚠️ MEDIUM-HIGH
   RISK
   Last because it changes the meaning of `goals.target_amount` and is
   easier to reason about after the multi-user UI is settled.

For each feature: write a dedicated implementation plan under
`docs/plans/` before coding (per the user's
`feedback_plan_before_task` memory), then implement the smallest
complete slice and stop.

---

## Open questions (raise with Fran before implementation)

- Decision A (Feature 1): dedicated preference toggle or reuse
  saving-reminders?
- Decision B (Feature 2): constant cap of 7 or column-driven
  `rooms.max_members`?
- Decision C (Feature 4): notify members on rename?
- Decision D (Feature 5): who can edit a member's sub-goal — self only,
  or also the creator?
- Decision E (Feature 5): confirm Saving Plan target stays independent
  of room/personal goals.
- Do we want a "creator transfer" flow before raising the cap? Today,
  if the creator leaves, the room archives. With up to 7 members that
  may feel harsh; consider as a follow-up.
