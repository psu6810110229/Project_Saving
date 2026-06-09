# Check Balance Deposit And Bucket Pause Plan

แผนนี้แตกเป็นไฟล์ย่อยราย sprint เพื่อให้เวลาเริ่มงานไม่ต้องอ่าน context ยาวทั้งชุดทุกครั้ง

## Global Rules

- ทำงานบน branch แยกของ sprint นั้นเสมอ
- รัน `npm run build` เสมอก่อนส่งงาน
- ห้ามใช้ MCP Browser หรือ in-app browser เพื่อเช็ค UI
- Manual test เป็นของผู้ใช้
- ถ้าข้อมูลเกี่ยวกับเงิน, streak, pause, RLS, notification หรือ chart ไม่ครบ ต้องอ่านโค้ด/สคีมาเพิ่มก่อนแก้ ห้ามเดา
- ห้ามทำ negative `savings_logs`
- ห้าม rewrite financial history
- ห้าม reuse legacy `saving_plan_pauses` เป็น source of truth สำหรับ bucket pause

## Scope

1. หยอดเงินในหน้า Check Balance
   - เพิ่ม mode `หยอดเงิน`
   - เงินใหม่ต้องเข้า `savings_logs`
   - Check Balance เดิม, surplus allocation, shortfall sync ยังอยู่ครบ

2. พักแผนการออมราย bucket
   - pause ระดับ bucket
   - deposit/check balance/allocation/write-down ยังทำได้
   - streak ไม่เพิ่มและไม่แตกระหว่าง pause
   - default resume คง deadline เดิมแล้ว recalculate

## Sprint Files

| Sprint | File | Focus |
| --- | --- | --- |
| 0 | [00-final-product-lock-and-audit.md](./sprints/00-final-product-lock-and-audit.md) | lock decisions + audit before schema |
| 1 | [01-bucket-pause-schema-and-rpcs.md](./sprints/01-bucket-pause-schema-and-rpcs.md) | bucket pause tables, revisions, RPCs |
| 2 | [02-bucket-pause-hooks-and-helpers.md](./sprints/02-bucket-pause-hooks-and-helpers.md) | hooks, types, pure pause helpers |
| 3 | [03-pause-aware-calculations.md](./sprints/03-pause-aware-calculations.md) | due, pace, streak, freeze behavior |
| 4 | [04-bucket-pause-ui.md](./sprints/04-bucket-pause-ui.md) | paused bucket UI, pause/resume sheets |
| 5 | [05-shared-deposit-recorder.md](./sprints/05-shared-deposit-recorder.md) | shared deposit orchestration |
| 6 | [06-check-balance-deposit-mode.md](./sprints/06-check-balance-deposit-mode.md) | single-bucket deposit mode in Check Balance |
| 7 | [07-check-balance-split-deposit.md](./sprints/07-check-balance-split-deposit.md) | multi-bucket split deposit |
| 8 | [08-heatmap-momentum-corrections.md](./sprints/08-heatmap-momentum-corrections.md) | chart semantics for surplus/shortfall/pause |
| 9 | [09-notifications-reminders-hardening.md](./sprints/09-notifications-reminders-hardening.md) | reminders, notifications, partner visibility |
| 10 | [10-regression-pass-and-documentation.md](./sprints/10-regression-pass-and-documentation.md) | final regression, docs, guardrail audit |

## Current Repo Facts

- Deposit path: `src/hooks/useLogs.ts`, `savings_logs`, positive-only, bucket-based
- Check Balance UI: `src/components/CheckBalanceSheet/CheckBalanceSheet.tsx`
- Reconcile data layer: `src/hooks/useReconcile.ts`
- Surplus allocation: `allocate_balance_to_bucket`
- Shortfall sync/write-down: `deallocate_balance_from_bucket`
- Bucket saving rules live on `buckets` current fields
- Streak uses `src/lib/streakCalculation.ts`
- Due summary uses `src/lib/bucketDailySummary.ts`
- Pace/action alert uses `src/lib/paceCalculation.ts`
- Heatmap uses `src/components/SavingsHeatmap/SavingsHeatmap.tsx` and `src/lib/savingsHeatmap.ts`
- Momentum uses `room_visible_momentum_flows` and `src/lib/momentumPurpose.ts`
- Legacy plan pause exists but is plan-level: `saving_plan_pauses`
- Latest migration at Sprint 0 audit: `0087_native_push_subscriptions.sql`
- `buckets` RLS allows room co-member select and owner-only update
- Existing scheduled saving reminders use legacy `saving_plan_pauses`; no bucket-level reminder pipeline exists yet
- Momentum data can contain signed negative flows, but `MomentumChart` currently clamps negative bar values to zero-height

## Product Decisions Locked In Sprint 0

- Resume pressure threshold:
  - show a resume pressure suggestion if recalculated daily equivalent is `>= 300/day`
  - also show it if recalculated daily equivalent is `> 2x` previous daily equivalent
- Check Balance deposit release scope:
  - first release is single-bucket deposit from Check Balance
  - split deposit remains Sprint 7
- Check Balance surplus allocation and streak:
  - positive `balance_allocations` count in heatmap/activity/momentum where wired
  - positive `balance_allocations` do not count toward streak
- Partner visibility for bucket pause:
  - partner may see paused/resumed status
  - partner must not see raw paused/resumed dates in first release
  - use sanitized status/read models or notification payloads, not direct co-member select of full pause history

## Product Decisions Still Required

- None for Sprint 1 or Sprint 2.

## Verification Summary

Every sprint must report:

- Branch used
- Files changed
- `npm run build` result
- Whether MCP Browser was avoided
- Manual test checklist for the user
