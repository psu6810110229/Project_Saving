# Task 40-41 Audit Summary

Date: 2026-05-24

Scope: static source audit, migration review, build, and lint for Task 40 bucket transfer/remove/activity and Task 41 bucket category intelligence. Per request, no MCP browser or UI browser smoke check was run.

## Verification

- `npm run build` passed.
- `npm run lint` passed.
- Browser UI verification was intentionally skipped.
- Live Supabase SQL/RLS probes were not run in this pass.

## Fix Pass

Applied on 2026-05-24 after the audit:

- Fixed bucket drag hint persistence so Dashboard marks `profiles.bucket_drag_hint_seen_at` through `markBucketDragHintSeen()` instead of relying on `localStorage`; the hint also auto-dismisses.
- Hardened `bucket_intent_settings` update RLS in `0063` and added forward migration `0066_harden_bucket_intent_settings_update_rls.sql`.
- Fixed category review save failure handling so the modal stays open and shows an inline error.
- Added forward migration `0067_fix_transfer_archive_zero_balance_idempotency.sql` so zero-balance `transfer_and_archive_bucket` retries can return `reused = true`.
- Added done-lock guidance copy rendering and category-derived icons in the Manage Project transfer sheet.
- Re-ran `npm run lint` and `npm run build`; both passed after fixes.

## Current Branch / Worktree

- Current branch: `feat/41-bucket-category-intelligence`.
- Recent task commits show Task 40 split through `task40: final hardening fixes`, and Task 41 split through `feat(bucket-intel): 41.8 smarter transfer defaults`, plus `feat(bucket-intel): add shimmer hint on draggable buckets + localStorage persistence`.
- Worktree is dirty before this audit doc, including bucket UI/hook/i18n changes, untracked `src/components/CompleteBucketLock/`, and untracked hotfix migrations `0064` and `0065`.

## Overall Status

Task 40 is mostly implemented. The backend schema, transfer/archive RPCs, transfer-aware balance helper, archive-style remove, transfer sheet, drag-to-transfer shortcut, activity feed rows, and in-app notification fan-out are present. Build and lint are clean.

Task 41 is mostly implemented through the foundation and smart-default slices. Shared bucket category metadata/icons, category migration, review UI, intent settings/events, deterministic intent engine, dashboard focus/next/done status, done-bucket soft lock, and transfer smart defaults are present. Build and lint are clean.

The initial release blockers were contract gaps rather than compilation issues. The high/medium findings below have now been patched in the working tree.

## Findings

### High - Drag Hint Is Not Account-Level Persistent

Status: fixed in `src/pages/Dashboard.tsx` and `src/components/BucketDragHint/BucketDragHint.tsx`.

Original finding: Task 40.9 requires account-level persistence through `profiles.bucket_drag_hint_seen_at`, and the code already had `markBucketDragHintSeen()` in `src/hooks/useProfile.ts:158`. Dashboard was gating and persisting the hint only with `localStorage`.

Also, `BucketDragHint` called `onShown()`, but Dashboard wired `onShown` to a no-op. The component comment said it auto-dismissed, but there was no timer.

Impact: the hint can reappear on another device/account session, and once visible it remains until explicit dismiss or drag.

Implemented fix: Dashboard now gates with `data.profile.profile?.bucket_drag_hint_seen_at`, calls `data.profile.markBucketDragHintSeen()` from `onShown`, keeps local dismissal state only for the current render, and `BucketDragHint` auto-dismisses.

### High - Intent Settings Update RLS Does Not Recheck New Room Membership

Status: fixed in `supabase/migrations/0063_bucket_intent_settings.sql` and forward migration `supabase/migrations/0066_harden_bucket_intent_settings_update_rls.sql`.

Original finding: `supabase/migrations/0063_bucket_intent_settings.sql:64` created the update policy. The `using` clause checked membership on the existing row, but the `with check` only checked `user_id = auth.uid()` and optional bucket validity. If `manual_next_bucket_id` was `null`, the new `room_id` was not revalidated.

Impact: a caller who can update one of their rows may be able to move that settings row to another room id they do not belong to when no manual next bucket is set.

Implemented fix: the same room-membership `exists (...)` check is now in the update `with check`, with forward migration `0066` for already-applied environments.

### Medium - `transfer_and_archive_bucket` Has A Zero-Balance Retry Edge

Status: fixed by forward migration `supabase/migrations/0067_fix_transfer_archive_zero_balance_idempotency.sql`.

Original finding: the combined RPC idempotency path looked for an existing `bucket_transfers` row by `client_request_id`. But when the source balance was zero, the RPC skipped inserting `bucket_transfers` and still archived.

Impact: retrying the same zero-balance combined remove request can miss the idempotency short-circuit and return an archived-source error instead of `reused = true`. Current UI mostly uses `archive_bucket` for empty buckets, but the hook documents the combined path as safe for zero balance.

Implemented fix: `0067` stores `client_request_id` on the archive activity payload and replays zero-balance archive calls from that activity row.

### Medium - Category Review Save Errors Are Swallowed

Status: fixed in `src/components/BucketCategoryReviewModal/BucketCategoryReviewModal.tsx`.

Original finding: `BucketCategoryReviewModal` awaited `onSave(updates)`, but did not inspect `{ error }`; it closed immediately.

Impact: if category review persistence fails, the user sees the modal close as though it worked.

Implemented fix: the modal keeps selections, stays open, and shows an inline error when `onSave()` returns an error or throws.

### Low - Done Lock Does Not Render The Optional Next-Bucket Line

Status: fixed in `src/components/CompleteBucketLock/CompleteBucketLock.tsx`, `src/components/BucketSheet/BucketSheet.tsx`, and `src/pages/AddMoney.tsx`.

Original finding: `BucketSheetProps` included `nextBucketName`, and Dashboard passed it, but `BucketSheet` did not destructure or render it. `CompleteBucketLock` only received a title and actions.

Impact: Task 41.7's optional "next bucket" guidance is absent from the dashboard deposit sheet.

Implemented fix: `CompleteBucketLock` now accepts body/next-line copy, and Dashboard/Add Money render the next-bucket guidance when available.

### Low - Manage-Project Transfer Sheet Uses A Generic Bucket Icon

Status: fixed in `src/components/BucketManager/BucketManager.tsx`.

Original finding: Task 41.1 says bucket icons should be derived from `category`. Dashboard/Add Money/Member Detail used `BucketCategoryIcon`, but `BucketManager` built transfer sheet options with `<IconPiggyBank />`.

Impact: one transfer surface does not follow the normalized category icon contract.

Implemented fix: `BucketManager` now uses `BucketCategoryIcon` for transfer-sheet bucket options.

## Coverage Notes

Task 40 coverage observed:

- Schema/RLS: `0058_bucket_transfers_archive.sql` adds archive fields, append-only transfers, activity events, active bucket uniqueness, and removes normal bucket delete policy.
- RPCs: `0059_bucket_transfer_rpcs.sql` adds `transfer_bucket_money`, `archive_bucket`, `transfer_and_archive_bucket`, stable hint tokens, idempotency for normal transfers, and transfer-aware balance math.
- Notifications: `0060_bucket_transfer_notifications.sql` fans out in-app-only transfer/remove notifications without push.
- UI/data: transfer-aware `bucketSaved`, active-only `useBuckets`, transfer/archive hooks, transfer sheet, remove modal, activity/history rows, and drag-to-transfer are present.
- Hotfixes: `0064` and `0065` address archive trigger permission and ambiguous `archived_at`.

Task 41 coverage observed:

- Category normalization and shared icons are present.
- Migration `0062` adds category metadata and normalizes old category values.
- Category review UI and `category_reviewed` intent event wiring are present.
- Intent settings/events migration and hook are present.
- `computeBucketIntent()` is pure and deterministic.
- Dashboard status badges, manual next picker, done lock, and transfer suggestion defaults are present.
- Add Money supports done lock and "use next bucket".

## Remaining QA

- Run the SQL probes from `docs/plans/40-sprint-3-rpc-verification.md` against a real Supabase environment.
- Manually smoke-test without MCP browser if desired: transfer, remove empty bucket, transfer-first remove, category review failure/success, manual next select/clear, done lock add-anyway, and move-extra.
- Mobile/Thai visual QA still needs a human/browser pass because this audit intentionally skipped UI browser checks.
