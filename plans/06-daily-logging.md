# Task 6 — Frictionless Daily Logging

## Goal
One-tap quick-log buttons and a manual entry form, both inserting into `savings_logs`. A recent-logs list visible on the dashboard.

## Files Created / Edited
- `src/components/QuickLogBar/QuickLogBar.tsx` — three buttons: +100, +500, +1000.
- `src/components/ManualLogForm/ManualLogForm.tsx` — amount + optional note + submit.
- `src/components/LogList/LogList.tsx` — list of recent logs.
- `src/components/LogItem/LogItem.tsx` — single row (amount, note, time, who).
- `src/hooks/useLogs.ts` — fetch + insert.
- `src/hooks/useInsertLog.ts` — split out for clarity (or keep inside `useLogs`).
- `src/lib/format.ts` — `formatCurrency(n)`, `formatRelativeTime(date)`.
- `src/pages/Dashboard.tsx` — wire the new components in.
- `src/types/index.ts` — `SavingsLog` interface.

## Types
```ts
interface SavingsLog {
  id: string;
  user_id: string;
  amount: number;
  note: string | null;
  created_at: string;
  // joined for display (separate query or view):
  display_name?: string;
}
```

## Quick-Log Behavior
- Single tap inserts a `savings_logs` row with `amount = preset, note = null`.
- Optimistic UI: prepend a temp row immediately, replace with server row on success, remove on error with toast.
- Disable buttons for ~300ms after click to prevent double-submits.

## Manual Form
- Amount (number, > 0, max 1,000,000 sanity cap).
- Note (text, max 140 chars).
- Submit clears the form and prepends to list.

## Recent Logs List
- Initially fetches last 30 logs across BOTH users (realtime in Task 7 will keep it fresh).
- Group header per day ("Today", "Yesterday", "May 8") — based on local TZ.
- Rows show: avatar/initial, amount in terracotta, note, relative time.

## Hooks
- `useLogs({ limit = 30 })`:
  - Initial query: `select id, user_id, amount, note, created_at, profiles(display_name) from savings_logs order by created_at desc limit ?`.
  - Returns `{ logs, loading, error, insert(amount, note?) }`.
  - `insert` handles optimistic update.

## Edge Cases / Risks
- Network failure mid-insert → optimistic row must roll back AND show retry toast.
- Concurrent inserts from both partners → list ordering by `created_at desc` is stable.
- Currency: store as numeric, format on display only. Never compute totals from formatted strings.
- Prevent negative or zero amounts client-side AND rely on DB check constraint.
- Joining `profiles` requires the FK relationship to be exposed; if RLS blocks the join, do a second query for profile names and map locally.
- 140-char note limit enforced on both client (input maxLength) and ideally a DB check (add later if needed).

## Acceptance Criteria
- [ ] Quick-log button click adds a row in ≤ 200ms perceived (optimistic).
- [ ] Manual form validates amount > 0 and note length.
- [ ] Recent list shows both users' logs grouped by day.
- [ ] Failed insert visibly rolls back the optimistic row.
- [ ] Currency displayed via `formatCurrency` everywhere — no inline `${...}` strings.
- [ ] No `any` types.
