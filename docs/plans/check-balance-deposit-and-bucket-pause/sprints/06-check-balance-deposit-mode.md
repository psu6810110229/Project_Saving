# Sprint 6: Check Balance Deposit Mode

## Branch

`feat/check-balance-deposit-mode`

## Goal

Add single-bucket deposit mode inside Check Balance sheet.

## Global Rules

- Run `npm run build`
- Do not run MCP Browser or in-app browser
- Deposit mode must create `savings_logs`
- Deposit mode must not call reconcile checkpoint/allocation RPCs

## Required Context

- Sprint 5 shared deposit recorder
- `src/components/CheckBalanceSheet/CheckBalanceSheet.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/BalanceCheckStatus/BalanceCheckStatus.tsx`
- quick amount source in profile/shared data
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`

## UI Requirements

Add segmented control:

- `เช็คยอด`
- `หยอดเงิน`

Check mode:

- keep current flow
- keep initial mode default as check
- keep shortfall sync panel

Deposit mode:

- amount input
- quick amount chips
- bucket picker
- selected bucket preview
- paused bucket helper
- confirm button
- success state
- action `เช็คยอดต่อ`

## Bucket Picker Rules

Eligible buckets:

- own buckets only
- active, not archived

Default bucket:

1. focus bucket if available
2. first active not-done bucket
3. first active bucket

Paused bucket:

- selectable
- helper says money enters bucket but plan/streak stays paused

## Ledger Rules

- On confirm, call shared deposit recorder.
- Write positive `savings_logs`.
- Do not create `balance_allocations`.
- Do not create checkpoint.
- Verified balance updates naturally because deposits are part of current reconciled balance.

## Success State

Show:

- amount
- bucket name
- new saved/target summary
- if paused: `เงินเข้าแล้ว · แผนยังพักอยู่`
- if active and streak affected: normal success copy

Actions:

- `เสร็จ`
- `เช็คยอดต่อ`

## Files Likely Touched

- `src/components/CheckBalanceSheet/CheckBalanceSheet.tsx`
- `src/pages/Dashboard.tsx`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`
- maybe new compact bucket picker component

## Verification

- `npm run build`
- No MCP Browser

## Manual Test Checklist

- Check Balance opens in check mode by default.
- Existing check-equal flow works.
- Existing check-surplus flow works.
- Existing check-shortfall flow works.
- Switch to deposit mode.
- Deposit 250 into active bucket.
- Deposit 250 into paused bucket.
- Deposit success can switch to check mode.
- No allocation row is created by deposit mode.

## Risks

- `CheckBalanceSheet` has internal step state. Mode switch must reset only the relevant state.
- The sheet can become too tall on mobile if bucket picker is not compact.
