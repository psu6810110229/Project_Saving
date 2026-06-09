# Sprint 10: Regression Pass And Documentation

## Branch

`fix/bucket-pause-check-balance-regression`

## Goal

Audit the full feature set, close regressions, and update project documentation.

## Global Rules

- Run `npm run build`
- Run `npm run lint` if practical
- Do not run MCP Browser or in-app browser
- Do not add new behavior unless required to fix a regression

## Required Context

- All previous sprint diffs
- `CLAUDE.md`
- this plan folder
- final product decisions
- changed migrations
- changed calculation helpers
- changed UI components

## Tasks

### Guardrail Audit

Confirm:

- no negative `savings_logs`
- deposit mode does not call checkpoint/allocation RPCs
- check mode still uses reconcile path
- surplus allocation still uses `balance_allocations`
- shortfall sync still uses negative allocation
- pause does not block deposit/check/allocation/write-down
- pause does not consume freeze
- pause does not rewrite old revisions
- no MCP Browser was used

### UX Audit

Confirm:

- paused bucket is visible but not disabled
- paused state is not styled as danger
- Check Balance sheet mode switch is understandable
- deposit success offers check balance continuation
- heatmap markers explain unusual cells
- momentum chart explains negative bars

### Documentation

- Update `CLAUDE.md` current feature notes after implementation.
- Update plan README decisions if they changed.
- Add implementation notes for:
  - bucket pause source of truth
  - deposit vs reconcile vs allocation
  - heatmap/momentum correction semantics
  - branch/build/no-browser verification rule if it should persist

## Files Likely Touched

- `CLAUDE.md`
- `docs/plans/check-balance-deposit-and-bucket-pause/README.md`
- relevant sprint docs if decisions changed
- bug-fix files discovered during regression

## Verification

- `npm run build`
- `npm run lint` if practical
- No MCP Browser

## Manual Test Checklist

Full user journey:

- pause bucket
- deposit into paused bucket
- resume with same deadline
- resume with adjusted deadline if implemented
- Check Balance equal
- Check Balance surplus and allocate
- Check Balance shortfall and sync
- Check Balance deposit mode
- Check Balance split deposit if Sprint 7 shipped
- inspect heatmap manually
- inspect momentum manually
- inspect reminders manually or through logs if available

## Done Criteria

- Build passes.
- User has a clear manual checklist.
- Docs reflect final implemented behavior.
- No known money/streak/chart blocker remains.
