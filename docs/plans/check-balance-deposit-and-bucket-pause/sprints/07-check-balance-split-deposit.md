# Sprint 7: Check Balance Split Deposit

## Branch

`feat/check-balance-split-deposit`

## Goal

Allow one saved amount entered in Check Balance deposit mode to be split across multiple buckets.

## Global Rules

- Run `npm run build`
- Do not run MCP Browser or in-app browser
- All rows must be positive `savings_logs`
- No partial insert behavior

## Required Context

- Sprint 6 deposit mode
- `src/hooks/useLogs.ts`
- `src/pages/Dashboard.tsx`
- notification path in `src/lib/notifyEvents.ts`
- bucket picker UI from Sprint 6

## UI Requirements

Entry:

- small secondary action `แบ่งหลาย bucket`

Split UI:

- total amount fixed at top
- rows per eligible bucket
- amount input per row
- tracker: `จัดสรรแล้ว {allocated} / {total}`
- confirm disabled until exact match
- warnings for under/over allocation
- paused bucket helper per selected paused row

Shortcuts:

- `ลง bucket เดียว`
- `เติมตามยอดที่ขาด`
- `กระจายเท่าๆ กัน`

Success:

- list bucket names and amounts
- show paused note for paused rows
- action `เช็คยอดต่อ`

## Data Rules

- Generate stable UUID for each `savings_logs` row before insert.
- Insert all rows in one operation.
- If existing `useLogs.insert` cannot support batch cleanly, add a separate batch helper.
- Notify partner and evaluate smart events for each inserted log.
- Add optimistic momentum flow per bucket row.

## Files Likely Touched

- `src/components/CheckBalanceSheet/CheckBalanceSheet.tsx`
- `src/hooks/useLogs.ts`
- `src/pages/Dashboard.tsx`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`

## Verification

- `npm run build`
- No MCP Browser

## Manual Test Checklist

- Split 250 into 100/150 succeeds.
- Under-allocation disables confirm.
- Over-allocation disables confirm.
- Split into paused bucket succeeds.
- Paused bucket split does not advance streak for that bucket.
- Each inserted row appears in activity data.
- Partner notifications match product expectation.

## Risks

- Multiple deposit rows may create multiple notifications. If grouped notification is desired, that is a separate product/notification sprint.
- Retrying failed batch must not duplicate rows.
