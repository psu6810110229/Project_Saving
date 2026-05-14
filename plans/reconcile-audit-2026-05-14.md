# Reconcile MVP Audit Report (2026-05-14)

## A. Verdict
- BLOCKED: must fix before commit

## B. Changed Files Summary
- Git status: main...origin/main [ahead 5], working tree clean
- Modified:
  - CLAUDE.md
  - src/App.tsx
  - src/hooks/useRooms.ts
  - src/pages/Dashboard.tsx
  - src/pages/Profile.tsx
  - src/types/index.ts
- Added:
  - docs/plans/21-reconcile-and-correction-plan.md
  - src/components/BalanceActivityFeed/BalanceActivityFeed.tsx
  - src/components/BalanceCheckStatus/BalanceCheckStatus.tsx
  - src/hooks/useReconcile.ts
  - src/lib/reconcile.ts
  - src/pages/CheckBalance.tsx
  - supabase/migrations/0026_harden_active_room_for_creator.sql
  - supabase/migrations/0027_reconcile_checkpoints.sql

## C. Build/Lint Result
- npm run build: pass
  - Warnings: chunk size > 500kB, inlineDynamicImports deprecation
- npm run lint: pass

## D. Blockers
1. App balance is derived from a truncated log list. `useLogs` caps results, and `useSavingsTotal` sums that subset. This can miscompute app balance and trigger the wrong reconcile path once users have many logs. This affects Check Balance and Dashboard status.
2. `current_reconciled_balance` is a security-definer function with no `auth.uid()` or room membership validation, allowing authenticated users to query any room/user balance.

## E. Warnings
- Sanitized activity RPC returns ledger and actual amounts to any room member. The UI hides them, but the data is still exposed. Confirm whether this aligns with the privacy intent for partner visibility.

## F. Safe-to-Continue Notes
- savings_logs amount positivity is preserved; adjustments are separate.
- Reason is enforced only when the difference is nonzero (server-side).
- Idempotency is handled via client_request_id plus unique index and RPC reuse behavior.
- New reconcile tables are owner-select only; no client insert/update/delete policies are defined.
- Deposit insert flow remains unchanged.

## G. Suggested Fixes
- must fix before commit:
  1. Derive app balance from a server-side sum rather than the limited `useLogs` list, and use it in Check Balance + status surfaces.
  2. Add auth + room membership validation to `current_reconciled_balance`, or revoke execute if unused.
- should go into Task 22 or later:
  1. If partner activity must be more sanitized, remove ledger/actual amounts from `balance_activity_for_room` output.

## H. Commit Recommendation
- Not recommended until blockers are resolved.
