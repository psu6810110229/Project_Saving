# Task 21 - Reconcile And Correction Implementation Plan

## 1. Summary Of What Changed From Plan 20

Plan 20 is now historical context after its first five implementation-order items:

1. Release update popup and version visibility.
2. PWA freshness handling.
3. Shared room goal sync.
4. Manage Project consolidation.
5. Bucket rename, target edit, and delete confirmation.

The next money-state feature should not be Plan 20's next implementation-order item, "Bucket transfer and withdrawal RPCs." The product direction has changed to Reconcile-first:

- Keep deposit extremely fast and positive-only.
- Add lightweight "เช็กยอด" as an optional confidence loop.
- Compare "ยอดจริง" with "ยอดในแอป" before introducing withdrawal-heavy flows.
- Prefer audit-friendly checkpoint and adjustment records over mutating old deposit history.
- Avoid partner approval for normal personal-bucket actions; use partner-visible activity summaries instead.

This plan also separates three balance concepts that Plan 20 blurred:

- Planned balance: what a future saving plan says the user should have.
- App ledger balance: what the app currently records.
- Actual verified balance: what the user confirms they really have after checking cash, bank, envelopes, or other storage.

Task 21 focuses only on actual verified balance vs app ledger balance. Saving-plan engines, daily required amounts, credit-forward, pauses, and plan revisions are deferred.

## 2. Risks In Continuing Plan 20 Item 6 As Written

Plan 20's next implementation-order item is bucket transfer and withdrawal RPCs. Earlier Plan 20 text proposed allowing negative `savings_logs.amount` rows for withdrawals and transfer-out rows. Continuing that now has several risks:

- It changes the meaning of `savings_logs` from "manual deposits" into a mixed accounting ledger. Current UI copy, activity feed labels, charts, streaks, leaderboard, and bucket progress all assume positive deposits.
- It requires relaxing the existing `amount > 0` database check from `0001_init.sql`, which broadens blast radius across every sum of `savings_logs.amount`.
- It makes "withdrawal" feel like a banking action even though the app does not hold real money and users only record money stored elsewhere.
- It solves a narrower symptom before the app has a clear model for "ยอดจริง" vs "ยอดในแอป".
- It risks turning normal personal corrections into partner-approval or accounting-heavy workflows, which conflicts with the desired lightweight product feel.
- It does not address opening balances from Alpha v0.7.5 rooms, duplicate deposits, forgotten logs, or storage moves cleanly.

Safer alternatives:

- Recommended now: keep `savings_logs` positive-only and add separate `balance_checkpoints` plus signed `balance_adjustments`.
- Possible but deferred: add void/correction records tied to specific old deposit logs.
- Not recommended: hard-delete or mutate old `savings_logs` rows to make totals match.

## 3. Current Repo Observations

Repo and docs:

- The app is React 19, TypeScript, Vite, Tailwind, Supabase, and PWA. Current `package.json` version is `0.7.5`.
- Existing plan files are under root `plans/`, not `docs/plans/`. This new plan is intentionally created at `docs/plans/21-reconcile-and-correction-plan.md` because that was the requested path.
- `CLAUDE.md` says schema changes should be new Supabase migrations, data access should live in focused hooks, and the app should not be refactored casually.
- `npm run build` passes on the current working tree. Vite reports the existing large chunk warning and `inlineDynamicImports` deprecation warning.

Current money schema:

- `savings_logs.amount` is `numeric(12,2) not null check (amount > 0)`.
- `savings_logs` has `room_id`, `bucket_id`, optional `slip_url`, and is used as the source for current saved totals.
- `buckets` are per `user_id` and `room_id`; partners can select bucket plans after migration `0019`, but writes remain owner-scoped.
- `goals` are per `(user_id, room_id)` after migration `0006`; migration `0025_room_goal_sync_rpc.sql` adds `update_room_goal`.
- Rooms are two-person, soft-archiveable projects. `archive_room`, `restore_room`, `join_room_by_code`, and `active_room_for_creator` RPCs already exist.

Current hooks and implementation:

- `useLogs` fetches room logs, listens to realtime `savings_logs`, and inserts optimistic positive deposits with a 300ms client cooldown.
- `useSavingsTotal`, `useLeaderboard`, `bucketSaved`, `dailyAmountSeries`, `cumulativeAmountSeries`, and `cumulativeRaceSeries` sum `savings_logs.amount` directly.
- `AddMoney` and `BucketRowExpandable` keep deposit fast through bucket selection, quick amounts, and a confirm action.
- `ManageProject` now contains shared goal editing, quick amounts, bucket creation, bucket edit/delete, archive, and leave project.
- `BucketManager` blocks deletion of buckets with deposit history.
- `ActivityFeed` and `ActivityHistoryModal` are deposit-oriented. The main feed can show slip references; history currently does not open slips because it does not pass `onViewSlip`.

Current working-tree notes:

- `src/hooks/useRooms.ts` has a local modification to call `active_room_for_creator()` with no arbitrary user id.
- `supabase/migrations/0026_harden_active_room_for_creator.sql` is untracked and matches that hook change.
- If that migration is kept, the reconcile migration should be numbered `0027_reconcile_checkpoints.sql`. If not, do not overwrite the existing `0026` intent; decide migration order before coding.

Security observation to verify before shipping:

- Early migrations created broad policies such as `"savings_logs: authenticated users can read"` and owner update/delete policies. Later room-scoped policies were added under different names and may not have dropped every old policy in every environment.
- Before introducing reconcile records, verify actual Supabase policies in staging/production. If broad financial-history policies still exist, add a hardening migration that drops broad read/update/delete policies and keeps room-member read plus owner-only inserts/RPC writes.

## 4. Reconcile-First Implementation Order

Recommended order:

1. Migration and RPC foundation:
   - Add checkpoint, adjustment, and optional storage-item tables.
   - Add server-side helper/RPC to compute ledger balance and create checkpoint records atomically.
   - Add RLS hardening for new tables and verify old financial-history policies.

2. Client data layer:
   - Add typed `BalanceCheckpoint`, `BalanceAdjustment`, and storage item types.
   - Add `useReconcile` or focused hooks for latest checkpoint, activity summaries, and `createBalanceCheckpoint`.
   - Add pure helper labels for Thai reason text and difference formatting.

3. Lightweight status surfaces:
   - Dashboard: small status near the top or near Total Vault.
   - Profile: small row under Manage Project or account settings.
   - Copy: "ยังไม่ได้เช็กยอดมา X วัน" and button "เช็กยอด".

4. Check Balance flow:
   - Step 1 shows "ยอดในแอป" and asks "ตอนนี้เงินจริงของคุณมีเท่าไหร่?"
   - Optional note/storage split is hidden behind a secondary affordance, not shown as a long first form.
   - If amount matches, save checkpoint and exit.
   - If amount differs, show "ส่วนต่าง" and ask "ส่วนต่างนี้เกิดจากอะไร?"
   - Save checkpoint plus adjustment.

5. Activity transparency:
   - Show partner-safe activity summary in existing feed/history or a small separate "Balance activity" list.
   - Do not require partner approval for normal personal reconcile.

6. Dashboard total integration:
   - Decide deliberately whether Total Vault and leaderboard should use raw deposits or reconciled balance.
   - Recommendation: after the adjustment table lands, use reconciled user total for overall room/user totals, but keep bucket rows deposit-based until bucket-level correction UX exists.
   - If this mismatch is visible, show copy such as "ยอดปรับรวมยังไม่ได้แยกถัง" only to the owner.

7. Follow-up correction tools:
   - Specific duplicate-log voiding.
   - Wrong-bucket transfer.
   - Wrong-owner correction.
   - Shared/high-risk approval flows.

## 5. Proposed Schema And Migration Strategy

Create a new migration after the current working-tree migration number:

- Preferred name if `0026_harden_active_room_for_creator.sql` is kept: `supabase/migrations/0027_reconcile_checkpoints.sql`.

Recommended tables:

### `public.balance_checkpoints`

Purpose: immutable record of a user's check of actual money against app balance.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references public.rooms(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `ledger_amount_at_time numeric(12,2) not null check (ledger_amount_at_time >= 0)`
- `actual_amount numeric(12,2) not null check (actual_amount >= 0)`
- `difference_amount numeric(12,2) not null`
- `note text null`
- `checked_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`
- `client_request_id uuid null`

Indexes and constraints:

- `(room_id, user_id, checked_at desc)`
- unique `(room_id, user_id, client_request_id)` where `client_request_id is not null`
- check `difference_amount = actual_amount - ledger_amount_at_time` is best enforced inside the RPC, because Postgres check constraints cannot safely reference computed values with rounding decisions unless using a generated column.

### `public.balance_adjustments`

Purpose: signed correction record created when `actual_amount != ledger_amount_at_time`. This is not a deposit and should not live in `savings_logs`.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `checkpoint_id uuid not null references public.balance_checkpoints(id) on delete restrict`
- `room_id uuid not null references public.rooms(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `amount numeric(12,2) not null check (amount <> 0)`
- `reason text not null`
- `note text null`
- `created_at timestamptz not null default now()`
- optional audit fields now or later:
  - `voided_at timestamptz null`
  - `voided_by uuid null references auth.users(id)`
  - `void_reason text null`

Reason check:

- `forgot_to_log` = ลืมบันทึก
- `over_recorded` = บันทึกเกิน
- `miscounted` = นับเงินผิด
- `spent_or_used` = ถอน/ใช้ไปก่อน
- `opening_balance` = ยอดยกมา
- `other` = อื่น ๆ

Indexes and constraints:

- unique `(checkpoint_id)` for MVP, because one total-level checkpoint should create at most one total-level adjustment.
- `(room_id, user_id, created_at desc)`
- `(room_id, created_at desc)` for activity summaries.

### `public.checkpoint_storage_items`

Purpose: optional snapshot of where the money actually is. This supports "cash + bank" without making storage setup mandatory.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `checkpoint_id uuid not null references public.balance_checkpoints(id) on delete cascade`
- `room_id uuid not null references public.rooms(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `label text not null`
- `amount numeric(12,2) not null check (amount >= 0)`
- `position int not null default 0`
- `created_at timestamptz not null default now()`

MVP validation:

- Storage items are optional.
- If supplied, their sum should equal `actual_amount`.
- Enforce that in the `create_balance_checkpoint` RPC, not via client-only validation.

### `public.storage_locations`

Defer this table unless product wants saved recurring locations. It is useful later for "Cash", "Bank", "Envelope", and "Other" presets, but not necessary for the first lightweight flow.

Future fields:

- `id`, `room_id`, `user_id`, `label`, `kind`, `position`, `active`, `created_at`, `archived_at`.

### RPCs and SQL helpers

Add:

- `public.current_reconciled_balance(p_room_id uuid, p_user_id uuid)`
  - Returns `sum(savings_logs.amount) + sum(non-void balance_adjustments.amount)` for that user and room.
  - Checks caller is the same user or a room member only when used for partner-visible summaries.

- `public.create_balance_checkpoint(...)`
  - Parameters:
    - `p_room_id uuid`
    - `p_actual_amount numeric`
    - `p_reason text default null`
    - `p_note text default null`
    - `p_storage_items jsonb default '[]'::jsonb`
    - `p_client_request_id uuid default null`
  - Server behavior:
    - Caller must be authenticated.
    - Caller must be a member of the room.
    - Caller can only create for `auth.uid()`.
    - Server computes ledger amount at time.
    - Difference is `actual - ledger`.
    - If difference is zero, insert checkpoint only.
    - If difference is nonzero, require `p_reason`, insert checkpoint and signed adjustment in one transaction.
    - If storage items are provided, validate labels and amounts and insert them.
    - Return the created checkpoint and optional adjustment.

- `public.balance_activity_for_room(p_room_id uuid, p_limit int default 20)`
  - Security-definer RPC for partner transparency.
  - Checks caller is a room member.
  - Returns sanitized rows: checkpoint id, user id, checked_at, actual amount, ledger amount, difference amount, reason, display name.
  - Does not return free-form notes or storage split unless the product explicitly decides those are shared.

Why separate adjustments are recommended:

- `savings_logs` remains a clean deposit history.
- Negative values are isolated to a correction table with explicit reason text.
- Existing deposit flow does not become slower or scarier.
- Later void/approval rules can target corrections without rewriting old deposits.

## 6. RLS And Security Rules

New table rules:

- Users can insert checkpoints only through the RPC, not direct table insert, if practical.
- Owner can select their full checkpoint, adjustment, and storage item rows.
- Partner should not get full table access if notes/storage splits are private.
- Partner transparency should use `balance_activity_for_room` sanitized RPC.
- No client-side update/delete on checkpoints or adjustments in MVP.
- If an adjustment is wrong, create a new checkpoint; later add voiding with audit fields and stricter permissions.

Suggested policies:

- `balance_checkpoints_select_own`: `user_id = auth.uid()`.
- `balance_adjustments_select_own`: `user_id = auth.uid()`.
- `checkpoint_storage_items_select_own`: `user_id = auth.uid()`.
- Optional direct insert policies can be omitted if all writes use RPCs.

RPC validation:

- `auth.uid()` must not be null.
- Caller must be in `room_members` for `p_room_id`.
- Caller cannot create or void records for partner.
- `actual_amount >= 0`.
- `reason` required only when difference is nonzero.
- Reason must match the allow-list.
- `client_request_id` protects against double-submit.

Old policy hardening to verify:

- Drop any lingering broad financial policies from `0001_init.sql` if they still exist:
  - authenticated read of all `savings_logs`
  - owner update of `savings_logs`
  - owner delete of `savings_logs`
- Keep room-member select for logs.
- Keep owner insert for deposits.
- Avoid direct update/delete of meaningful financial history.

## 7. UI Flow

Status surface:

- Dashboard and Profile should show a compact row/card:
  - If never checked: "ยังไม่ได้เช็กยอด"
  - If checked before: "เช็กยอดล่าสุด X วันที่แล้ว"
  - If stale: "ยังไม่ได้เช็กยอดมา X วัน"
  - Button: "เช็กยอด"
- Do not block deposits when status is stale.
- Do not make this feel like a mandatory monthly close.

Check Balance route or modal:

- Preferred route: `/check-balance`, because it can be opened from Dashboard or Profile and keeps the modal stack simpler.
- Acceptable MVP: a full-screen modal if route work would be slower.

Step 1:

- Header: "เช็กยอด"
- Show:
  - "ยอดในแอป" with current ledger amount.
  - Prompt: "ตอนนี้เงินจริงของคุณมีเท่าไหร่?"
- Input:
  - Numeric amount, THB.
  - Large tap target.
  - No accounting labels.
- Secondary collapsed affordance:
  - "แยกตามที่เก็บ" for optional cash/bank split.
  - Optional note only if product accepts note visibility rules.

If actual equals app ledger:

- Save checkpoint.
- Success copy: "เช็กยอดแล้ว ยอดตรงกัน"
- Return to Dashboard/Profile quickly.

If actual differs:

- Show:
  - "ยอดจริง"
  - "ยอดในแอป"
  - "ส่วนต่าง" with signed amount.
- Ask one short question:
  - "ส่วนต่างนี้เกิดจากอะไร?"
- Reason buttons:
  - "ลืมบันทึก"
  - "บันทึกเกิน"
  - "นับเงินผิด"
  - "ถอน/ใช้ไปก่อน"
  - "ยอดยกมา"
  - "อื่น ๆ"
- Save checkpoint plus adjustment.
- Avoid words like debit, credit, journal, close period, reconciliation statement, or balance sheet.

Deposit flow protection:

- Do not add reconcile prompts to `/add`.
- Do not add partner approval to deposit.
- Do not ask users to check balance after every deposit.

## 8. Activity Transparency Design

Principle: partner visibility, not partner approval.

Show a sanitized activity row when a user checks balance:

- Equal balance:
  - "{name} เช็กยอดแล้ว ยอดตรงกัน"
- Difference:
  - "{name} เช็กยอดแล้ว ส่วนต่าง +฿500"
  - Reason label may be shown: "ลืมบันทึก"

Do not show by default:

- Private note content.
- Storage split labels like a bank account nickname.
- Exact storage locations, unless product decides those are shared.

Implementation options:

- Add a small `BalanceActivityFeed` below recent deposits.
- Or merge sanitized reconcile rows into the existing activity feed with a `type` field in a combined client-side list.

Recommended MVP:

- Keep deposit feed unchanged for the first pass.
- Add a compact "Balance activity" section with the latest 3 checkpoint summaries.
- Add merge into `ActivityHistoryModal` later when event typing is broader than deposits.

## 9. Approval Boundaries

No partner approval for MVP:

- Deposits.
- Checking own balance.
- Creating checkpoint for own balance.
- Creating normal own adjustment from a checkpoint.
- Adding an opening balance for own new room.
- Correcting own total through a later checkpoint.

Use warning/confirmation, not approval:

- Large adjustment above a threshold, for example over 20% of current app balance or over a product-chosen THB amount.
- Actual amount lower than app amount.
- Repeated adjustments in a short period.

Reserve approval for later:

- Withdrawal from a shared/project-level balance, if such a shared balance is introduced.
- Moving money to another user.
- Deleting, voiding, or hiding important old transactions.
- Deleting or archiving a project.
- Large suspicious adjustment after threshold rules are defined.

## 10. Edge Cases

1. User saves a large amount ahead of plan.
   - Not an error. Reconcile compares actual vs app ledger only. Planned balance is deferred.

2. User forgets to log for many days and logs one catch-up amount.
   - Deposit remains allowed as one positive log. Reconcile can later confirm actual equals app.

3. User double-clicks or logs duplicate deposit.
   - Current `useLogs` has a 300ms cooldown but no durable deposit idempotency key. Reconcile reason "บันทึกเกิน" can offset the duplicate without deleting history. Later add void-specific tools.

4. Actual balance is lower than app balance.
   - Save checkpoint and negative `balance_adjustments.amount` with reason such as "บันทึกเกิน", "นับเงินผิด", or "ถอน/ใช้ไปก่อน". Do not create negative `savings_logs`.

5. Actual balance is higher than app balance.
   - Save checkpoint and positive adjustment with reason such as "ลืมบันทึก" or "ยอดยกมา". Later, reason-specific UX can convert "ลืมบันทึก" into a normal deposit if the user wants bucket-level detail.

6. Money is split across cash and bank.
   - Optional `checkpoint_storage_items` can record the split. If no split is entered, store only total actual amount.

7. User moves money from cash to bank without increasing total savings.
   - If total actual equals app ledger, save checkpoint only. Storage split can change without creating an adjustment.

8. User enters wrong bucket.
   - Total reconcile may show no difference. Bucket-level transfer/correction is a deferred feature. Do not force partner approval.

9. User enters wrong owner.
   - Total reconcile can identify each user's mismatch. Moving money between users should be deferred and treated as high-risk/shared.

10. User changes plan mid-way.
    - Future saving plans should use plan revisions with `effective_from_date`; do not rewrite old checkpoints or logs.

11. User pauses saving.
    - Pause belongs to the future plan engine. Reconcile still works.

12. User starts a new production room with opening balance from Alpha v0.7.5.
    - Use reason "ยอดยกมา" to create a checkpoint and positive adjustment. This avoids fake backdated deposits.

13. User wants to archive old alpha room and start fresh.
    - Existing archive flow remains the project-level action. Reconcile should not archive rooms.

14. User wants to correct a mistake without partner approval spam.
    - Normal own reconcile creates activity transparency only. Approval is deferred for destructive/shared/high-risk cases.

## 11. Acceptance Criteria

Data and security:

- A new migration adds checkpoint/adjustment storage without changing `savings_logs.amount > 0`.
- User can create a checkpoint only for their own `user_id`.
- User cannot create a checkpoint for partner.
- Partner can see sanitized activity summary but not private notes/storage details.
- Direct update/delete of checkpoint and adjustment rows is not available to the client.
- Duplicate submit with the same `client_request_id` does not create duplicate adjustments.

UX:

- Dashboard or Profile shows "ยังไม่ได้เช็กยอดมา X วัน" or equivalent latest-check status.
- "เช็กยอด" starts the flow.
- Step 1 shows "ยอดในแอป" and asks "ตอนนี้เงินจริงของคุณมีเท่าไหร่?"
- If amounts match, checkpoint saves and the flow ends quickly.
- If amounts differ, the flow shows "ส่วนต่าง" and asks only "ส่วนต่างนี้เกิดจากอะไร?"
- Reason options use the requested Thai labels.
- Deposit remains 1-3 taps and is not blocked by reconcile status.

Ledger behavior:

- Equal check creates no adjustment.
- Higher actual creates a positive adjustment.
- Lower actual creates a negative adjustment.
- No negative rows are inserted into `savings_logs`.
- Existing deposit history remains visible and unchanged.

Verification:

- `npm run build` passes.
- Manual smoke test with two users confirms owner-only creation and partner-visible summary.
- Manual smoke test confirms a storage move with equal total creates no adjustment.

## 12. What Claude Code Should Implement Tomorrow

Recommended first implementation slice:

1. Resolve migration numbering:
   - Keep or land the current untracked `0026_harden_active_room_for_creator.sql`.
   - Add reconcile as the next migration number.

2. Add migration:
   - `balance_checkpoints`
   - `balance_adjustments`
   - `checkpoint_storage_items`
   - RLS policies
   - `current_reconciled_balance`
   - `create_balance_checkpoint`
   - `balance_activity_for_room`
   - old financial-policy hardening if verified necessary.

3. Add shared types:
   - `BalanceCheckpoint`
   - `BalanceAdjustment`
   - `CheckpointStorageItem`
   - `BalanceAdjustmentReason`

4. Add data layer:
   - `src/hooks/useReconcile.ts`
   - or split into `useBalanceCheckpoints.ts` and `useBalanceActivity.ts` if that fits better.

5. Add UI:
   - `src/pages/CheckBalance.tsx` or a dedicated full-screen flow component.
   - Route `/check-balance`.
   - `BalanceCheckStatus` component for Dashboard/Profile.
   - Thai reason labels and difference formatting helper.

6. Wire status:
   - Dashboard status near top or near Total Vault.
   - Profile row near Manage Project.
   - Button text "เช็กยอด".

7. Add activity summary:
   - Fetch sanitized balance activity via RPC.
   - Show a small summary list without touching deposit feed semantics yet.

8. Verify:
   - `npm run build`
   - Two-user manual RLS smoke test.
   - Same amount, higher amount, lower amount, storage split, duplicate submit.

## 13. What Should Be Deferred

Defer from Task 21 MVP:

- Withdrawal-first UI.
- Negative `savings_logs`.
- Bucket-to-bucket transfers.
- Wrong-owner transfers.
- Partner approval flows.
- Specific old-log void/delete UI.
- Full saving-plan engine.
- Daily/weekly/monthly required saving plan.
- Increasing daily amount plans.
- Cap-at-maximum daily amount plans.
- Credit-forward plan behavior.
- Ahead/behind planned balance.
- Plan revisions with `effective_from_date`.
- Persistent storage location settings, unless users ask for recurring storage locations.
- Merging all activity event types into one polymorphic feed.
- Making partner notes/storage details visible.

## Short Risk Report For Items 1-5

Blockers:

- None found from static inspection and `npm run build`; build passes.

Warnings:

- The working tree has uncommitted security-related changes: `src/hooks/useRooms.ts` and untracked `supabase/migrations/0026_harden_active_room_for_creator.sql`.
- Migration numbering must be resolved before adding reconcile.
- Existing migration history may leave broad `savings_logs` read/update/delete policies from `0001_init.sql`; verify deployed policies before adding more financial history.
- Current totals and charts sum only `savings_logs.amount`; adding adjustments will require deliberate helper adoption so totals do not quietly disagree.
- `ActivityHistoryModal` still treats all rows as deposits and does not pass slip view handlers; avoid merging reconcile activity there until the feed has typed event rows.

Safe-to-continue notes:

- Release popup, PWA freshness, shared goal sync, Manage Project consolidation, and bucket edit/delete are present in code.
- Shared goal sync uses `update_room_goal` and `useGoal.saveRoomGoal`.
- Bucket delete is history-aware and blocks buckets with logs.
- Deposit flow remains positive-only and quick, which is a good base for Reconcile-first.
- Partner bucket visibility is read-only at the hook/policy level, matching the personal-bucket ownership principle.
