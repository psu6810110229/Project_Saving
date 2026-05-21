# Task 40 - Bucket Transfer, Remove, Activity, and In-App Notifications

Status: Planning only. No app code, migrations, RLS, RPCs, hooks, UI components, routes, package installs, or notification fan-out changes in this task.
Date drafted: 2026-05-21.

This task plans a safe bucket money-movement feature for v0.9.9+. The product goal is simple on the surface: users can remove buckets, move money from one of their buckets to another, see clear activity history, and receive in-app notifications. The engineering goal is stricter: no cross-user transfer, no fragile frontend-only money logic, no accidental destructive delete, and no vague UI actions.

This must be implemented as separate task slices, not as one large one-time implementation.

## 1. Goals

- Let a user transfer money from Bucket A to Bucket B within the same user and room.
- Prevent transfers across users, even if another user's bucket is visible in the room.
- Let a user remove a bucket through archive-style behavior instead of hard deletion.
- Preserve bucket history after removal.
- Log all bucket create, update, remove, and transfer activity in an append-only record.
- Create in-app notifications for bucket actions where useful.
- Do not add push notifications for this feature.
- Add polished drag-and-drop transfer from one bucket card onto another.
- Keep the normal visible `Transfer` action so drag is a shortcut, not the only path.
- Add a one-time first-use drag hint only when the user has at least two active buckets.
- Make every button action-specific and useful; avoid generic `OK`, `Got it`, `Submit`, or vague `Confirm` labels.
- Keep mobile, reduced-motion, keyboard, and screen-reader paths usable.

## 2. Non-Goals And Hard Rules

- Do not implement in this planning task.
- Do not ship this as one large implementation.
- Do not move money with frontend-only state changes.
- Do not represent bucket transfer as a new positive deposit.
- Do not use negative `savings_logs` rows for transfer.
- Do not hard-delete buckets with historical activity.
- Do not allow Bucket A -> Bucket A transfer.
- Do not allow User Z -> User X transfer.
- Do not allow partner/read-only buckets as transfer destinations.
- Do not trust disabled buttons or hidden UI as security.
- Do not create push notifications for transfer/remove events.
- Do not add a new broad UI framework.
- Do not use browser-native drag-and-drop as the primary implementation.
- Do not add noisy animation, confetti, bounce-heavy motion, or modal tutorials.
- Do not use vague button labels where a specific action label is available.
- Do not churn documentation during implementation unless a meaningful bug lesson needs to be recorded.

## 3. Required Work Discipline

This feature must be implemented on a feature branch.

Recommended branch name:

- `feature/task-40-bucket-transfer-remove-activity`

Task slicing rules:

- Split the implementation into small, reviewable task slices.
- Complete one slice before starting the next when the next depends on it.
- Commit after each finished slice.
- Each commit should leave the app in a buildable state whenever practical.
- Do not make one giant final commit for the whole feature.
- Do not mix unrelated refactors into the feature commits.

Assistant working rule for this plan:

- This plan and its slices are pre-approved. When the user starts a slice (for example `start 40.3`), the assistant implements the code directly without writing a new approval plan or asking for confirmation.
- The one-slice-at-a-time rule still holds. After each slice is finished and committed, the assistant must stop and wait for the next explicit start command instead of rolling forward into the following slice.
- The assistant may still flag a question only when something is genuinely ambiguous (an unstated product decision, a schema/security trade-off not covered here, or a missing prerequisite). Routine implementation choices already covered by this plan do not need confirmation.
- Each slice still ends with the relevant checks (build/lint/manual where applicable) and a focused commit covering only that slice.

Suggested commit shape:

- `task40: add bucket transfer schema`
- `task40: add transfer and archive RPCs`
- `task40: wire bucket transfer hook`
- `task40: add transfer sheet UI`
- `task40: add bucket drag shortcut`
- `task40: add in-app bucket notifications`
- `task40: polish remove bucket flow`

Documentation discipline:

- Keep docs edits minimal during implementation.
- Do not repeatedly rewrite this plan while fixing normal bugs.
- Only update docs when a significant bug is discovered and the lesson affects future maintenance, security, or product behavior.
- If a big bug is found, record what was learned briefly instead of turning the docs into an implementation diary.

## 4. Current Repo Observations

Project stack:

- Vite + React 19.
- Supabase client.
- Framer Motion is already installed and used.
- Current package version is `0.9.9`.

Current bucket model:

- `public.buckets` stores bucket setup: owner, room, name, target, position, category.
- Bucket saved amount is currently derived from `savings_logs`, not stored on `buckets`.
- `savings_logs.amount` is positive-only deposit history.
- Current bucket delete path in `useBuckets` performs a hard `.delete()` after checking for logs.
- Co-members can select/read each other's buckets through RLS, so visibility does not mean transfer permission.

Current notification model:

- `public.notifications` already supports in-app notification rows.
- Notification rows have recipient, actor, room, event key, category, payload, dedupe key, read state, and routes.
- Existing bucket notifications cover `bucket_added` and `bucket_updated`.
- Partner deposit notification may go through an edge function for push; Task 40 transfer/remove events must not use push.

Current UI:

- Dashboard bucket cards are rendered through `BucketGrid` and `BucketRow`.
- `BucketRow` already uses `Pressable` and Framer Motion micro-interactions.
- `BucketSheet` is currently deposit-oriented.
- `ConfirmModal` currently uses generic cancel/confirm style labels in some flows.

## 5. Product Decisions

### 5.1 Transfer

Bucket transfer means moving saved value between two active buckets owned by the same user in the same room.

Example:

- Valid: Fran's Flight bucket -> Fran's Hotel bucket.
- Invalid: Fran's Flight bucket -> Partner's Hotel bucket.
- Invalid: Fran's Flight bucket -> Fran's Flight bucket.
- Invalid: active bucket -> archived bucket.

Transfer changes bucket allocation, not total room savings.

### 5.2 Remove

The UI may say `Remove Bucket`, but the database should archive the bucket.

Reasons:

- Bucket history should remain readable.
- Existing activity and notifications should not point to missing rows.
- Future analytics and audit trails need stable references.

Recommended behavior:

- If bucket balance is zero, allow `Remove Empty Bucket`.
- If bucket balance is greater than zero, guide the user to transfer the balance first.
- Preferred polished flow: `Transfer Balance & Remove`.
- Simpler fallback flow: block removal and offer `Transfer Balance First`.
- Block removing the last active bucket unless the product explicitly decides otherwise.

### 5.3 Activity

Activity is the source of truth for user-facing history.

Notifications are a surface derived from activity, not the permanent audit record.

### 5.4 Drag Shortcut

Dragging a bucket card onto another bucket should prepare a transfer. It must never execute money movement directly.

Flow:

1. User presses and drags Bucket A.
2. User drops it on Bucket B.
3. Transfer sheet opens with source and destination prefilled.
4. User enters amount and optional note.
5. User reviews the transfer.
6. User chooses `Move {amount}`.
7. Backend RPC performs the transfer atomically.

## 6. Data Model Direction

### 6.1 Bucket Archive Fields

Add archive fields to `public.buckets`:

- `archived_at timestamptz`
- `archived_by uuid`

Queries for active bucket screens should filter `archived_at is null`.

Historical screens may include archived buckets when needed to render old activity.

### 6.2 Bucket Transfers Table

Add a new table, likely `public.bucket_transfers`.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null`
- `user_id uuid not null`
- `source_bucket_id uuid not null`
- `destination_bucket_id uuid not null`
- `amount numeric(12,2) not null check (amount > 0)`
- `note text`
- `client_request_id uuid not null`
- `created_at timestamptz not null default now()`

Suggested constraints:

- `source_bucket_id <> destination_bucket_id`
- unique `(user_id, room_id, client_request_id)`

Important:

- Transfers should be append-only.
- Do not update or delete completed transfers from normal app flows.
- If "undo" is ever added, it should create a reverse transfer.

### 6.3 Activity Events Table

Add a server-written activity table, likely `public.activity_events` or a bucket-scoped variant if the broader app already suggests one during implementation.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null`
- `actor_user_id uuid not null`
- `event_key text not null`
- `source_table text`
- `source_id uuid`
- `bucket_id uuid`
- `target_bucket_id uuid`
- `amount numeric(12,2)`
- `payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Initial event keys:

- `bucket_created`
- `bucket_updated`
- `bucket_removed`
- `bucket_transfer_created`

Optional later event keys:

- `bucket_transfer_reversed`
- `bucket_goal_reached_by_transfer`

## 7. Balance Calculation Direction

Current saved amount is:

- positive deposits in `savings_logs`.

After Task 40, bucket saved amount should become:

- deposits into bucket
- plus incoming transfers
- minus outgoing transfers

Total room/user savings should not increase after a transfer.

Recommended helper:

- Add a SQL helper or RPC/view for bucket balances.
- Avoid duplicating transfer math in many frontend files.
- Keep TypeScript helpers aligned with SQL if local calculation is still needed for optimistic UI.

Do not add a mutable `current_balance` column to `buckets` unless later performance forces it.

## 8. Backend RPC Direction

### 8.1 `transfer_bucket_money`

Use a security-definer RPC as the only normal write path for transfers.

It should validate:

- `auth.uid()` exists.
- source bucket exists.
- destination bucket exists.
- source bucket `user_id = auth.uid()`.
- destination bucket `user_id = auth.uid()`.
- source and destination share the same `room_id`.
- requested `room_id`, if passed, matches both buckets.
- caller is a member of the room.
- both buckets are active.
- source and destination are different.
- amount is positive and rounded/validated to two decimals.
- source has enough available balance.
- `client_request_id` is present.
- duplicate `client_request_id` returns or reuses the existing transfer instead of creating a second one.

It should perform in one transaction:

1. Validate and lock relevant bucket/transfer state.
2. Compute source available balance.
3. Insert `bucket_transfers`.
4. Insert activity event.
5. Insert in-app notification rows if required.
6. Return a useful result for UI refresh.

### 8.2 `archive_bucket`

Use a security-definer RPC as the preferred remove path.

It should validate:

- `auth.uid()` exists.
- bucket exists.
- bucket owner is `auth.uid()`.
- caller is a member of the room.
- bucket is active.
- bucket balance is zero, unless using a combined transfer-and-remove RPC.
- bucket is not the last active bucket, unless product allows no-bucket state.

It should perform:

1. Set archive fields.
2. Insert activity event.
3. Insert in-app notification rows if required.
4. Return archived bucket id and timestamp.

### 8.3 Optional `transfer_and_archive_bucket`

If the polished remove flow is implemented, consider a combined RPC:

- transfer remaining balance from bucket A to bucket B
- archive bucket A
- insert one clear activity trail

This avoids race conditions between "move balance" and "remove bucket".

## 9. RLS And Security Rules

Security posture:

- RLS should still protect tables.
- RPCs should own complex mutation rules.
- Direct client inserts into transfers/activity should not be allowed.

Table policy direction:

- `bucket_transfers`
  - select: user can read own transfers in rooms they belong to.
  - insert/update/delete: no direct client policy.
- `activity_events`
  - select: room members can read sanitized activity appropriate for the room.
  - insert/update/delete: no direct client policy.
- `buckets`
  - select: keep current own/co-member visibility, but active screens filter archived buckets.
  - update: consider narrowing direct update after RPCs exist.
  - delete: remove or stop relying on direct delete for normal UI.

Specific attack cases to test:

- User changes destination bucket id to partner bucket.
- User changes source bucket id to partner bucket.
- User uses a bucket from another room.
- User uses archived bucket id.
- User retries same request id.
- User double-clicks `Move Money`.
- User sends amount `0`, negative amount, too many decimals, or string-like invalid values.
- User tries to archive a bucket with nonzero balance.
- User tries to archive last active bucket.

## 10. Notification Direction

Use existing `public.notifications` for in-app rows.

Do not use push for this feature.

New event keys may include:

- `bucket_removed`
- `bucket_transfer_created`

Recipient strategy:

- The actor should get useful in-app confirmation/activity.
- Room partners may get in-app bucket activity if current product behavior wants shared visibility.
- Be careful with notes: transfer note text should be owner-only unless product explicitly wants partner-visible notes.

Notification payload should include stable references:

- `bucket_id`
- `bucket_name`
- `target_bucket_id`
- `target_bucket_name`
- `amount`
- `activity_id`
- `transfer_id`

Notification routes:

- `target_route`: `/dashboard?section=buckets` or `/notifications`.
- `fallback_route`: `/dashboard`.

## 11. UI Direction

### 11.1 Bucket Cards

Own active buckets:

- Keep existing card visual language.
- Add transfer affordance without making the card cluttered.
- Keep drag available without requiring edit mode.

Partner/read-only buckets:

- Never draggable for transfer.
- Never valid drop targets.
- Keep read-only state visible.

Archived buckets:

- Hidden from active bucket grid.
- Visible only in history/activity when needed.

### 11.2 Transfer Sheet

Create a new transfer-specific sheet/modal rather than overloading the deposit `BucketSheet`.

Fields:

- From bucket.
- To bucket.
- Amount.
- Note.
- Review summary.

Useful controls:

- `Review Transfer`
- `Move {amount}`
- `Use Max`
- `Swap Buckets`
- `Change Details`
- `Keep Editing`

Do not use:

- `OK`
- `Got it`
- vague `Submit`
- vague `Confirm` when `Move {amount}` is available.

### 11.3 Remove Bucket Flow

If balance is zero:

- Primary action: `Remove Empty Bucket`
- Escape action: `Keep Bucket`
- Optional context action: `View Activity`

If balance is greater than zero:

- Primary action: `Transfer Balance & Remove` if combined flow is implemented.
- Fallback action: `Transfer Balance First`
- Escape action: `Keep Bucket`
- Optional context action: `View Activity`

Avoid dead-end blocking modals.

### 11.4 Activity UI

Existing Dashboard activity is deposit/balance-check oriented. Task 40 should decide whether to:

- merge bucket transfer/remove events into the existing activity surfaces, or
- add a bucket-focused activity section/filter.

Preferred:

- Show recent transfer/remove events near the bucket section.
- Keep full activity available through the existing activity history pattern if it can be extended cleanly.

Rows should answer:

- Who did it?
- What changed?
- Which buckets were involved?
- How much moved?
- When did it happen?

## 12. Drag And Drop UX

Use `@dnd-kit/core` unless implementation discovery finds a strong reason not to.

Reasons:

- Better React fit than native HTML drag/drop.
- Pointer/touch/keyboard sensor support.
- Activation constraints for press delay and movement tolerance.
- Accessibility support is easier to preserve.

Activation guidance:

- Desktop pointer: roughly `120-180ms` delay or small movement threshold.
- Touch/mobile: roughly `220-300ms` delay with movement tolerance.
- Avoid instant drag start.
- Avoid long-press that feels broken.

Motion guidance:

- Source card lifts subtly.
- Scale should be small, around `1.01-1.02`.
- Shadow may increase while dragging.
- Valid target gets calm highlight.
- Invalid target stays muted.
- Same-bucket target shows a subtle nonblocking message.
- Drop transitions into transfer sheet.
- Reduced motion users should get state changes without shimmer/lift-heavy motion.

Do not execute transfer on drop.

## 13. First-Time Drag Hint

Add a one-time hint only when useful.

Show when:

- user has at least two active owned buckets.
- user has not seen the hint before.
- bucket section is visible or near-visible.

Do not show when:

- user has one or zero active buckets.
- selected bucket view is partner/read-only.
- reduced-motion setting suggests avoiding shimmer-heavy animation.

Persistence:

- Prefer account-level persistence on `profiles`, e.g. `bucket_drag_hint_seen_at`.
- Do not rely only on localStorage for "once in their life".

Hint behavior:

- Short delay after bucket grid settles.
- One subtle shimmer/lift demonstration.
- Copy such as `Drag a bucket onto another to move money`.
- Auto-dismiss after a few seconds.
- Mark seen when shown, dismissed, or user starts a drag transfer.

Avoid:

- Large tutorial modal.
- Repeated hint every visit.
- Blocking interaction.

## 14. Button Semantics Rule

Every button must have a reason to exist.

Button must do at least one of these:

- move money.
- protect money.
- reveal useful context.
- recover from a blocked state.
- navigate to the exact place needed to continue.

Preferred labels:

- `Transfer`
- `Review Transfer`
- `Move {amount}`
- `Use Max`
- `Swap Buckets`
- `Change Details`
- `Transfer Balance & Remove`
- `Remove Empty Bucket`
- `Keep Bucket`
- `View Activity`
- `Mark as Read`
- `Mark All Read`

Avoid generic labels unless no better specific label exists:

- `OK`
- `Got it`
- `Submit`
- `Confirm`
- `Yes`
- `No`
- `Cancel`

If an escape action is needed, prefer specific language:

- `Keep Editing`
- `Keep Bucket`
- `Back to Buckets`

## 15. Task Slices For Future Implementation

This is the required split. Do not implement everything in one pass.

### Slice 40.1 - Branch And Baseline

- Create feature branch.
- Confirm current build status.
- Record existing dirty worktree state.
- Do not clean or revert unrelated user changes.

Commit after slice if branch/setup changes are meaningful.

### Slice 40.2 - Database Schema

- Add bucket archive fields.
- Add `bucket_transfers`.
- Add activity event table or chosen equivalent.
- Add indexes and constraints.
- Add initial RLS posture.

Commit after migration builds/applies locally where possible.

### Slice 40.3 - RPCs And Security

- Add transfer RPC.
- Add archive RPC.
- Add optional transfer-and-archive RPC if chosen.
- Add helper for bucket balance including transfers.
- Add idempotency behavior.
- Add server-side validation errors that UI can map cleanly.

Commit after RPC tests/manual SQL checks.

### Slice 40.4 - Frontend Data Layer

- Extend TypeScript types.
- Update bucket balance calculation path.
- Add transfer/archive hooks.
- Keep existing deposit flow working.
- Ensure active bucket queries exclude archived buckets.

Commit after build/type checks.

### Slice 40.5 - Transfer UI

- Add `BucketTransferSheet`.
- Add review step.
- Add useful action buttons.
- Add success/error states.
- Preserve entered amount/note on retryable errors.

Commit after UI smoke test.

### Slice 40.6 - Drag Shortcut

- Install/configure dnd-kit if selected.
- Make own active bucket cards draggable.
- Make own active bucket cards valid drop targets.
- Add activation delay/tolerance.
- Open transfer sheet on valid drop.
- Keep normal click/tap behavior usable.

Commit after desktop and mobile smoke checks.

### Slice 40.7 - Remove Flow

- Replace hard-delete UX with archive/remove flow.
- Add zero-balance remove path.
- Add nonzero-balance transfer-first or transfer-and-remove path.
- Remove generic dead-end modal copy.

Commit after remove-flow QA.

### Slice 40.8 - Activity And Notifications

- Surface transfer/remove events in activity UI.
- Add in-app notification copy and icon mapping.
- Ensure no push path is used.
- Ensure notification count/list refresh behavior works.

Commit after notification QA.

### Slice 40.9 - First-Time Hint And Motion Polish

- Add profile-level hint seen field if not already included.
- Add one-time drag hint.
- Respect reduced motion.
- Tune drag/drop animation.
- Confirm no annoying repeat behavior.

Commit after UX QA.

### Slice 40.10 - Final Hardening

- Security test attack cases.
- Mobile viewport QA at 320, 375, 390 px.
- Thai and English copy QA.
- Reduced-motion QA.
- Run `npm run build`.
- Run lint if feasible.

Commit final fixes separately from large earlier slices.

## 16. Error And Empty-State Policy

Transfer errors should be helpful:

- Same bucket: `Choose a different bucket`.
- Empty source: `This bucket has no money to move`.
- Not enough balance: offer `Use Max`.
- Archived bucket: `This bucket is no longer active`.
- Partner bucket: `Choose one of your buckets`.
- Duplicate request: show successful existing result or harmless no-op.
- Network failure: preserve form values and show `Try Again`.

Remove errors should guide recovery:

- Nonzero balance: `Transfer Balance First`.
- Last active bucket: `Create Another Bucket` or `Keep Bucket`.
- Has history: history is okay because archive preserves it; do not block just because history exists.

## 17. Testing And QA Plan

Backend/security:

- Transfer between own buckets succeeds.
- Transfer to partner bucket fails.
- Transfer from partner bucket fails.
- Transfer across room fails.
- Transfer to archived bucket fails.
- Transfer from archived bucket fails.
- Transfer with insufficient balance fails.
- Transfer duplicate `client_request_id` does not duplicate money movement.
- Archive zero-balance bucket succeeds.
- Archive nonzero bucket fails unless using combined transfer-and-remove.
- Archive partner bucket fails.
- Archive last active bucket follows chosen product rule.

Frontend:

- Transfer button opens sheet.
- Drag source onto valid target opens sheet.
- Drop on same bucket does not open an executable transfer.
- Partner buckets are not draggable or valid targets.
- `Use Max` uses computed source available balance.
- `Swap Buckets` changes source/destination and revalidates balance.
- `Move {amount}` disables while saving and cannot double-submit.
- Activity appears after successful transfer/remove.
- In-app notification appears where expected.
- Notification bell count updates or refreshes in an expected way.

Viewport:

- 320 px smoke check.
- 375 px main mobile target.
- 390 px common iPhone width.
- Desktop app shell.

Accessibility:

- Normal transfer path works without drag.
- Keyboard path can select source/destination and submit.
- Drag behavior does not trap focus.
- Escape/cancel behavior is clear.
- Reduced motion avoids shimmer/lift-heavy effects.

Language:

- English and Thai labels fit inside buttons/sheets.
- `Move {amount}` labels do not overflow.
- Long bucket names truncate cleanly.

## 18. Acceptance Criteria

- Feature is implemented on a feature branch.
- Implementation is split into task slices, not one mega-change.
- Each completed slice is committed separately.
- Bucket transfer is same-user only.
- Cross-user transfer is impossible server-side.
- Bucket transfer does not increase total saved amount.
- Transfer RPC validates ownership, room, active status, amount, and idempotency.
- Remove bucket archives instead of hard-deleting history.
- Active bucket screens hide archived buckets.
- Historical/activity screens can still render archived bucket references.
- Activity events are written server-side.
- In-app notifications are created where required.
- Push notification path is not used for transfer/remove.
- Drag/drop prepares transfer but never executes money movement directly.
- First-time drag hint shows only once per account and only when useful.
- Every button has specific, purposeful copy.
- Mobile and reduced-motion experiences remain professional and calm.
- `npm run build` passes.
- Available lint/type checks pass or any inability to run them is documented in the final implementation summary.

## 19. Rollback Plan

Rollback should be slice-aware.

If frontend-only slice fails:

1. Revert the affected UI/hook commits.
2. Keep database migrations only if no production deploy happened, or add forward-only cleanup migration if needed.
3. Restore old bucket card and bucket sheet behavior.

If database/RPC slice fails before production:

1. Revert migration commit.
2. Rebuild types/hooks against the old schema.

If database/RPC slice has reached production:

1. Do not manually delete production rows.
2. Add a forward-only migration to disable new RPCs or mark the feature unavailable.
3. Hide transfer/remove UI behind a feature flag or remove UI entry points.
4. Preserve existing activity/transfer rows for audit.

No rollback should hard-delete historical user money records.

## 20. Risks

- Transfer math can diverge between SQL and TypeScript. Mitigation: centralize balance computation in SQL/helper and keep frontend derivations small.
- Direct bucket delete may survive in old code paths. Mitigation: replace normal UI remove paths and consider tightening delete RLS.
- Partner bucket visibility can be mistaken for transfer permission. Mitigation: same-owner checks in RPC and invalid UI targets.
- Drag can conflict with tap/open behavior. Mitigation: activation delay, movement tolerance, and normal `Transfer` action.
- Mobile drag can conflict with scroll. Mitigation: touch-specific delay/tolerance and QA on 320-390 px.
- Notification payload may expose notes. Mitigation: keep transfer notes owner-only unless explicitly approved.
- Too many docs edits can waste time. Mitigation: only update docs for big bug lessons or final high-signal notes.

## 21. Future Implementation Order

1. Create feature branch and confirm baseline.
2. Add database schema migration.
3. Add transfer/archive RPCs and balance helper.
4. Add frontend types and data hooks.
5. Replace active bucket calculations with transfer-aware balances.
6. Add transfer sheet.
7. Add normal transfer entry point from bucket cards.
8. Add drag/drop transfer shortcut.
9. Replace hard-delete UI with remove/archive flow.
10. Add activity events to visible activity surfaces.
11. Add in-app notification copy and routing.
12. Add one-time drag hint.
13. Polish motion, reduced-motion behavior, and button labels.
14. Run security QA.
15. Run mobile, Thai/English, and build QA.
16. Commit final fixes and summarize results.
