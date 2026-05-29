# 54 — Three-Page Nav Restructure (Dashboard · Team · Profile)

Status: PROPOSED — awaiting approval before any code.
Branch base: current work branch.
Author context: design agreed with product owner over chat (decisions locked below).

---

## 1. Goal

Move from a 3-tab nav of **Dashboard · Add(+) · Profile** to **Dashboard · Team · Profile**, and
in the process make the Dashboard a complete, self-contained "my money" loop while moving all
group/social surfaces onto a new **Team** page.

This also commits the Dashboard fully to the **per-bucket plan model** (migration 0071 / v0.10.0)
and stops surfacing the legacy **global Saving Plan** in the UI.

The deposit action does **not** change: it already lives on the bucket card → `BucketSheet`.
The `/add` route is already a redirect stub (`<Navigate to="/dashboard" />`).

---

## 2. Locked decisions (from product owner)

1. Nav becomes **Dashboard · Team · Profile**. Remove the `add` tab. (Deposits stay on bucket cards.)
2. New third page identity = **Team / Group hub**.
3. Move **all** group surfaces to Team: Leaderboard (TeamSection), full Momentum chart
   (room/me/compare), the whole Activity feed, Member-detail entry, and **Nudge**.
4. Dashboard keeps a **me-only** trend — rendered as a **GitHub-style contributions heatmap**
   (new component), not the line chart.
5. **Vault card = read-only tracking hub** (saved/target, %, period goal, STREAK, CHECKED status).
   No money actions on it.
6. **Balance Check = separate, always-visible action surface** on the Dashboard (→ `/check-balance`).
   This fixes the current bug where the check entry only appears as a fallback.
7. **Plan = per-bucket only.** Retire the global Saving Plan **from the UI** (dashboard card +
   `/saving-plan` page). Do **not** delete DB revisions or migrations (money-state guardrail).
8. **No separate plan-summary card** on the Dashboard — plan tracking is folded into the Vault card
   (which already shows the period goal ticker + STREAK metric).

### Heatmap spec (locked)
- Cell colour = **amount deposited that day**, intensity scaled from the user's own deposit
  distribution (e.g. quartiles of non-zero days), GitHub-style 5-ish levels.
- Layout = weeks as columns, days as rows; **horizontal scroll**.
- **Date range = project timeline** — from the earliest of (room start / earliest bucket start)
  through the latest bucket deadline / room `end_date`. (Not a fixed 53 weeks, so deadline markers
  beyond a year remain visible.)
- **Auto-scroll to today on load.** Persist the user's last scroll position in `sessionStorage`
  and restore it within the session.
- **Markers:** small icon on cells that are a bucket **start date** or **due/deadline date**, so the
  user can see which cell is a deadline.
- Bangkok date logic; reuse existing tokens (`well`/`surface`/`brand-*`); honour
  `prefers-reduced-motion`.

---

## 3. Final layout

### Dashboard — "my money", lean
1. Header (room · members · 🔔)
2. Migration banner *(conditional — keep; it onboards old buckets into the per-bucket plan model)*
3. **Vault card** — tracking hub (saved/target, %, period goal ticker, OWNER·BUCKETS·STREAK·CHECKED)
4. **ActionAlert** — behind/critical bucket warnings (per-bucket pace)
5. **Balance Check row** *(always visible)* — status + "Check" → `/check-balance`
6. **My buckets** — deposits via `BucketSheet`
7. **Me-only heatmap** — new contributions calendar

### Team — group hub
1. **Leaderboard** (full, from `TeamSection`)
2. **Momentum chart** (room / me / compare) — the existing `MomentumChart` with all controls
3. **Activity feed** (whole room)
4. Member-detail entry + **Nudge** action

### Profile — unchanged

---

## 4. Scope boundary for "retire global Saving Plan"

**In scope (this plan) — UI only, safe:**
- Remove `SavingPlanCard` from the Dashboard render.
- Stop computing/using `moneyStatus`, `displayRevision`, `habitStatus` on the Dashboard
  (Dashboard already prefers bucket-derived `displayedHabitStatus`/`bucketStreak` when
  `hasBucketRules`; we make bucket-derived the only path on the Dashboard).
- `/saving-plan` route → redirect to `/dashboard` (mirror the `/add` pattern).
- Remove the in-Dashboard link/entry to the saving-plan page if any.

**Out of scope (deferred, separate effort) — do NOT touch here:**
- `useSavingPlan`, `savingPlan.ts`, `savingPlanNormalization.ts`, `DataContext` plan fields.
- `saving_reminder` notifications (`notifications.ts`, `sw.ts`, `notificationCopy.ts`).
- Partner/room-member plan displays (`usePartnerSavingPlan`, `useRoomMembersSavingPlans`,
  `MemberDetail`).
- Any DB migration / RLS / edge-function change.

Rationale: the global plan threads through notifications + partner comparison + money-state.
Ripping the machinery out now would destabilise those. UI retirement is the safe, complete slice.

---

## 5. Slices (each ends green: `tsc -b` + scoped eslint; commit between slices)

> Build/lint note: per project memory, `npm run build`/`npm run lint` are red on a clean checkout
> (PWA precache + stray temp files). Verify with `tsc -b` and scoped eslint on changed files.

### Slice 1 — Nav swap (Dashboard · Team · Profile) + Team page shell
- `BottomNav.tsx`: `BottomNavTab` `'add'` → `'team'`; swap `IconPlus` for a people/group icon.
- `AppLayout.tsx`: `tabFromPath` / `pathFromTab` update `add`→`team` (`/team`).
- i18n: add `copy.nav.team` (en + th); remove/repurpose `copy.nav.add`.
- New `src/pages/Team.tsx` — empty shell (header + placeholder), route in `App.tsx`.
- `/add` route stays a redirect (already is).
- ✅ Done: nav shows three tabs, Team route loads a shell, deposits still work via bucket card.

### Slice 2 — Move group surfaces onto Team
- Move from `Dashboard.tsx` to `Team.tsx`: `TeamSection` (leaderboard), full `MomentumChart`
  (+ its mode/purpose/compare controls + `SavingRaceSection` if shown), Activity feed
  (`mergedActivity` + `ActivityHistoryModal`), member-click → `/members/:id`, **Nudge** action.
- Carefully relocate the supporting state/hooks/memos these sections depend on (chart series,
  leaderboard entries, activity items, nudge handler). Watch shared selectors in `DataContext`.
- Dashboard stops rendering these sections.
- ✅ Done: Team page shows leaderboard + chart + activity + nudge; Dashboard no longer does.

### Slice 3 — Dashboard plan = per-bucket only; remove global Saving Plan card; retire `/saving-plan`
- Remove `SavingPlanCard` usage from Dashboard.
- Remove Dashboard reliance on `moneyStatus`/`displayRevision`/global `habitStatus`
  (keep bucket-derived path only).
- Ensure Vault card still shows period goal (`bucketSummaryItems[0]`) + STREAK (bucket streak).
- `/saving-plan` → redirect to `/dashboard` in `App.tsx`.
- Leave global-plan hooks/notifications/DB untouched (see §4).
- ✅ Done: Dashboard renders with no global-plan code; `/saving-plan` redirects.

### Slice 4 — Always-visible Balance Check row + Vault CHECKED enrichment
- New always-on Balance Check surface under the Vault card (its own action card/row):
  shows verified amount + matched/diff chip + days-since + permanent "Check" CTA → `/check-balance`.
  (Reuse/adapt `BalanceCheckStatus`; drop the fallback-only condition.)
- Re-home the verified-balance slot that used to fold into `SavingPlanCard`.
- Optionally enrich the Vault `CHECKED` metric with the matched/diff chip (tracking only, no action).
- ✅ Done: balance check is reachable in every state; Vault stays action-free.

### Slice 5 — Me-only contributions heatmap (new component)
- New `src/components/SavingsHeatmap/SavingsHeatmap.tsx` per the spec in §2.
- Pure helper for day-bucketing + level scaling (Bangkok dates) in `src/lib/` (reuse existing
  date/streak helpers where possible — `streakCalculation`, Bangkok date utils).
- Inputs: `logs`, project start/end + bucket start/deadline dates for markers.
- `sessionStorage` scroll persistence; auto-scroll to today.
- Render on Dashboard in place of the old me-trend.
- ✅ Done: heatmap renders, scrolls, marks deadlines, restores scroll.

### Slice 6 — Polish + cleanup
- i18n strings for Team page + balance check + heatmap legend (en + th).
- Remove now-dead imports/props; verify preview screens (`/reference/*`, atoms/molecules/organisms)
  still compile.
- Final scoped `tsc -b` + eslint; manual smoke per slice.

---

## 6. Risks / watch-list
- `Dashboard.tsx` is ~2,800 lines with tightly-coupled state/hooks/memos — moving sections
  (Slice 2) is the highest-risk step. Move state with its consumers; don't duplicate selectors.
- `MomentumChart` `me` mode appears on Team (full) and is replaced on Dashboard by the heatmap —
  ensure no Dashboard code still references the line-chart me-series after Slice 5.
- Keep preview/demo screens compiling (CLAUDE.md rule).
- Do not regress the fast deposit flow on bucket cards.
- Notifications referencing the global plan must keep working (we are not touching them).

## 7. Explicitly NOT doing
- No DB migration, RLS, or edge-function changes.
- No removal of global-plan hooks/notifications/partner displays (deferred).
- No negative `savings_logs`, no reconcile allocation, no new ledger model.
- No new top-level folders.
