# 60 — Widget Save-Today First Refresh (2x2 + 4x2)

Status: Planning only. No app code, native widget code, migrations,
RLS, RPCs, edge functions, or package installs in this document.
Owner: Senior FE/FS pair (Codex) with Fran.
Source:
- `docs/plans/59-android-home-screen-widget.md`
- `src/hooks/useWidgetSync.ts`
- `src/lib/widgetSnapshot.ts`
- `src/pages/Dashboard.tsx`
- `src/lib/bucketDailySummary.ts`
- `src/components/SavingsWidget/SavingsWidget.tsx`
- `android/app/src/main/java/com/goout/app/SavingsWidget.java`
- `android/app/src/main/res/layout/widget_savings_4x2.xml`
- `android/app/src/main/res/layout/widget_savings_2x2.xml`
- `android/app/src/main/res/values/strings.xml`
- `android/app/src/main/res/values-th/strings.xml`
Date drafted: 2026-05-31.

This task is a focused follow-up to Task 59. The Android widget already
exists and already deep-links into the app, but its information
hierarchy is still centered on **saved vs goal + streak**. Product
direction is now different:

- The widget must show **how much the user needs to save today**.
- `2x2` and `4x2` must be intentionally different.
- `2x2` must keep at least **one tappable button**.

The widget should therefore stop behaving like a tiny vault-summary
card and instead become a **save-today prompt with just enough overall
context**.

---

## 1. Goal

- Make the widget's primary metric the user's **current period amount
  due**:
  - daily rules → amount still needed **today**
  - increasing daily rules → amount still needed **today**
  - weekly rules → amount still needed **this week**
  - monthly rules → amount still needed **this month**
- Preserve the current rule that widget data is **display-only** and is
  derived from numbers already available inside the app. The widget
  still must not talk to Supabase directly.
- Make the two widget sizes distinct:
  - `2x2` = fast glance + one action
  - `4x2` = save-today hero + overall progress + two actions
- Keep `＋ Add` as the mandatory small-widget action.
- Keep `✓ Check` only on the large widget.
- Keep body tap → Dashboard deep-link.
- Preserve the current fallback path when the user has no active room,
  no synced snapshot, or no actionable save-today amount.

## 2. Non-goals (do not touch)

- No new backend work: no migrations, no RPCs, no RLS, no Edge
  Functions, no Supabase schema changes.
- No change to Saving Plan / bucket-rule math. Reuse the existing
  `calcDailySummary(...)` semantics as-is.
- No change to deep-link route semantics beyond the actions that already
  exist (`deposit`, `check-balance`, dashboard body tap).
- No new widget action buttons beyond:
  - `2x2`: `＋ Add`
  - `4x2`: `＋ Add`, `✓ Check`
- No remote image loading, member avatars, charts, or multi-room picker
  inside the widget.
- No attempt to show every focus bucket individually in the widget. The
  widget remains a summary surface, not a mini dashboard.
- No change to the Dashboard hero / Vault card hierarchy in this task.
  This task only updates widget surfaces and the snapshot they read.

## 3. Hard facts from the current repo

### 3.1 Widget snapshot today

Current `WidgetSnapshot` in `src/lib/widgetSnapshot.ts` stores:

- `roomName`
- `saved`
- `goal`
- `progressPct`
- `streak`
- `streakUnit`
- `hasLoggedToday`
- `updatedAt`

It does **not** currently include any save-today amount.

### 3.2 The app already computes the right save-today source

`Dashboard.tsx` already derives:

```ts
const todayKey = todayBangkokKey();
const bucketSummaryItems = useMemo(
  () => calcDailySummary(buckets, logs, todayKey, bucketTransfers),
  [buckets, logs, todayKey, bucketTransfers],
);
```

`calcDailySummary(...)` in `src/lib/bucketDailySummary.ts` already:

- filters to the user's **focus buckets**
- computes `amountDue`
- tags each item with `ruleType`
- distinguishes `today`, `this week`, `this month`, and `flexible`

This is the canonical source for the widget's new headline amount.

### 3.3 Current widget sizes already have different action capacity

- `widget_savings_4x2.xml` already exposes:
  - card body tap
  - `w_add`
  - `w_check`
- `widget_savings_2x2.xml` already exposes:
  - card body tap
  - `w_add`

So the requested "2x2 should have at least 1 button" is already aligned
with the current native affordance. The work here is **content
hierarchy**, not a new action model.

### 3.4 The widget is native-rendered but app-fed

`SavingsWidget.java` reads one cached JSON blob from Android
`SharedPreferences` (`CapacitorStorage`, key `widget_snapshot`).
`useWidgetSync.ts` is the correct place to extend that blob because it
already has access to:

- bucket data
- logs
- transfers
- reconcile balance
- personal goal
- streak inputs
- active room name

### 3.5 Current preview is incomplete for this task

`src/pages/WidgetPreview.tsx` currently renders only one large preview
surface through `src/components/SavingsWidget/SavingsWidget.tsx`.
This task should treat the preview route as part of the implementation
surface so both sizes can be visually QA'd before native rebuild.

## 4. Product decisions to lock in this task

### 4.1 Save-today source of truth

The widget hero amount must come from the **bucket-rule daily summary**,
not from Verified Balance and not from legacy global Saving Plan
revisions.

Derivation:

- Start from `calcDailySummary(buckets, logs, todayKey, bucketTransfers)`.
- Sum all `amountDue ?? 0` across the returned focus items.
- This sum becomes the widget's **headline due amount**.

This keeps the widget aligned with the app's current product direction:
the dashboard already treats bucket rules as the active plan model.

### 4.2 Headline period label

The widget should not hard-code "today" for every rule.

Headline label rules:

- If the first focus item is `fixed_daily`, `increasing_daily`, or
  `increasing_daily_capped` → show `Need today`.
- If it is `fixed_weekly` → show `Need this week`.
- If it is `fixed_monthly` → show `Need this month`.
- If there are no due amounts left but there are active focus items →
  show a completion state (`Done for today` / `Done this week` /
  `Done this month`) instead of `฿0`.
- If there are no focus items or only `flexible` items →
  fall back to the old saved/progress summary state.

### 4.3 `2x2` content contract

`2x2` is the quick-action widget.

It must show:

- room name
- one hero line for the current due amount or completion state
- one compact supporting line
- `＋ Add` button

Recommended hierarchy:

1. room name
2. hero amount (`฿160`)
3. small label (`Need today`)
4. support line:
   - due state: `of Flights` or `7-day streak`
   - done state: `Today's target cleared`
   - fallback state: `฿1,600 of ฿70,000`
5. `＋ Add`

It must **not** try to show:

- large progress bar + large percent + large streak all at once
- `Check` action
- duplicated percent in multiple places

### 4.4 `4x2` content contract

`4x2` is the richer progress widget.

It must show:

1. room name
2. hero amount for current due period
3. save-period label (`Need today` / `Need this week` / `Need this month`)
4. one supporting habit or context line:
   - streak, or
   - focus bucket name, or
   - done-state helper
5. secondary overall progress:
   - saved amount
   - goal target
   - progress bar
6. `＋ Add`
7. `✓ Check`

The large widget should still answer "where am I overall?", but only
after it answers "what do I need to save now?"

### 4.5 Fallback states

This task must explicitly handle four states:

1. **No snapshot yet**
   - Show the existing sync/open-app empty state.

2. **Due amount exists**
   - Hero = due amount
   - Label = current period

3. **Plan/rules exist, but current period is already satisfied**
   - Hero = completion message
   - Secondary = streak or saved/goal

4. **No actionable plan/rules**
   - Fallback to current saved/progress summary
   - Keep `＋ Add`

The widget should never display a dead-looking `฿0` hero unless that is
part of a deliberately worded completion state.

## 5. Data contract changes

Extend `WidgetSnapshot` so the native widget can render the new save-
today-first hierarchy without recalculating business logic in Java.

### 5.1 Snapshot fields to add

Add:

```ts
todayDue: number;
todayState: 'due' | 'done' | 'no_plan';
todayPeriod: 'day' | 'week' | 'month' | 'flex';
focusBucketName: string | null;
focusBucketCount: number;
```

Keep existing fields:

```ts
roomName: string;
saved: number;
goal: number;
progressPct: number;
streak: number;
streakUnit: 'day' | 'week' | 'month';
hasLoggedToday: boolean;
updatedAt: string;
```

Notes:

- `todayDue` is the summed due amount across focus items.
- `todayState` prevents native layouts from inferring completion from
  `0` alone.
- `todayPeriod` lets native copy switch between today / week / month
  without re-running bucket math.
- `focusBucketName` is only a support hint; do not overload it into a
  hard dependency.
- `focusBucketCount` allows a future `+2 more` copy line without more
  snapshot changes.

### 5.2 Derivation rules in `useWidgetSync`

`useWidgetSync.ts` should derive the new fields from the same inputs the
dashboard uses:

- `buckets.buckets`
- `logs.allLogs`
- `bucketTransfers.transfers`
- `reconcile.appBalance`
- `goal.personalGoalTarget`
- `activeRoom?.name`
- streak inputs

Preferred implementation shape:

1. Compute `todayKey = todayBangkokKey()`.
2. Compute `summaryItems = calcDailySummary(...)`.
3. Compute `todayDue = sum(summaryItems.map(item => item.amountDue ?? 0))`.
4. Use the first summary item as the period/focus label source.
5. Determine `todayState`:
   - `due` when `todayDue > 0`
   - `done` when `summaryItems.length > 0` and `todayDue === 0`
   - `no_plan` when `summaryItems.length === 0`

To avoid duplicating summation logic already embedded inside
`SavingPlanCard.tsx`, extract a small shared helper from
`SavingPlanCard`/`MigrationSummary` into `src/lib/bucketDailySummary.ts`
or a nearby pure helper file.

## 6. Implementation slices

Each slice ends green with scoped verification. Follow the existing
project rule: keep edits focused, avoid backend changes, and verify with
build/targeted checks before moving on.

### Slice 1 — Expand the widget snapshot contract

**Files to touch**

- `src/lib/widgetSnapshot.ts`
- `src/hooks/useWidgetSync.ts`
- `src/lib/bucketDailySummary.ts` or a nearby pure helper file

**What**

- Extend the snapshot shape with the new save-today fields.
- Derive those fields from `calcDailySummary(...)`.
- Preserve existing saved/goal/progress/streak values.

**Implementation notes**

- Do not move business logic into Java.
- Do not fetch anything new from Supabase.
- Keep the snapshot write guard (`Capacitor.isNativePlatform()`).
- Keep widget refresh bridge behavior unchanged.

**Acceptance criteria**

- [ ] Snapshot JSON includes save-today fields.
- [ ] `todayDue` matches the dashboard's bucket-rule due total.
- [ ] Weekly/monthly rules map to the correct widget period label.
- [ ] `done` vs `no_plan` is distinguishable from the snapshot alone.

### Slice 2 — Update the React widget preview surface

**Files to touch**

- `src/components/SavingsWidget/SavingsWidget.tsx`
- `src/pages/WidgetPreview.tsx`

**What**

- Make the preview component represent the new hierarchy:
  - small widget variant
  - large widget variant
- Preview both states from one route so visual review is easy before
  native rebuild.

**Implementation notes**

- `2x2` and `4x2` should not be the same card at different widths.
- Keep the preview props close to the native snapshot contract so the
  preview remains a useful source of truth.
- The preview can stay display-only; no need for live app data on the
  route.

**Acceptance criteria**

- [ ] `/widget` previews both sizes.
- [ ] `2x2` clearly centers the due amount + `＋ Add`.
- [ ] `4x2` clearly centers the due amount and still shows overall
      progress context.
- [ ] No duplicate emphasis of the same `%` in multiple places.

### Slice 3 — Redesign native `4x2`

**Files to touch**

- `android/app/src/main/java/com/goout/app/SavingsWidget.java`
- `android/app/src/main/res/layout/widget_savings_4x2.xml`
- `android/app/src/main/res/values/strings.xml`
- `android/app/src/main/res/values-th/strings.xml`

**What**

- Render the large widget as a save-today-first card.
- Keep `＋ Add`, `✓ Check`, and body tap behavior.
- Preserve the current no-snapshot empty state.

**Implementation notes**

- Java should only map snapshot fields to views.
- Avoid reintroducing the old ring + bar duplication.
- Prefer one clear hero amount, one small label, and one overall
  progress bar.
- Reuse existing widget colors/tokens unless a tiny string/layout change
  requires a new semantic color.

**Acceptance criteria**

- [ ] `4x2` hero displays the due amount when `todayState = due`.
- [ ] `4x2` displays a completion message when `todayState = done`.
- [ ] `4x2` falls back gracefully to saved/progress when
      `todayState = no_plan`.
- [ ] `w_add`, `w_check`, and card-body tap still deep-link correctly.

### Slice 4 — Redesign native `2x2`

**Files to touch**

- `android/app/src/main/java/com/goout/app/SavingsWidget.java`
- `android/app/src/main/res/layout/widget_savings_2x2.xml`
- `android/app/src/main/res/values/strings.xml`
- `android/app/src/main/res/values-th/strings.xml`

**What**

- Make `2x2` the sharp, single-purpose quick widget.
- Keep exactly one visible action: `＋ Add`.

**Implementation notes**

- The compact widget should use the due amount as its hero whenever a
  due state exists.
- If the due state is complete, the hero should become a short success
  state rather than a zero amount.
- Fallback to saved/progress only when there is no actionable save-
  today signal.

**Acceptance criteria**

- [ ] `2x2` keeps at least one button (`＋ Add`).
- [ ] `2x2` reads as a quick action surface, not a squeezed version of
      `4x2`.
- [ ] `2x2` remains legible at the actual small widget size.
- [ ] Body tap still opens the dashboard.

### Slice 5 — Strings, fallback copy, and manual QA

**Files to touch**

- `android/app/src/main/res/values/strings.xml`
- `android/app/src/main/res/values-th/strings.xml`
- any touched preview copy in the React preview component

**What**

- Add the minimum new strings needed for:
  - `Need today`
  - `Need this week`
  - `Need this month`
  - completion-state copy
  - fallback helper lines

**Implementation notes**

- Keep copy short; widget width is limited.
- Thai copy should be naturally short, not literal English-shaped copy.
- Avoid adding copy for speculative future states that this task does
  not render.

**Acceptance criteria**

- [ ] EN + TH copy fit both layouts without obvious truncation.
- [ ] No empty or contradictory text combinations appear across due /
      done / no-plan states.
- [ ] Widget preview and native widget communicate the same hierarchy.

## 7. Verification checklist

- [ ] `npm run build` passes.
- [ ] Widget preview route renders both sizes after the redesign.
- [ ] Install/update APK and add both widgets from the launcher picker.
- [ ] `2x2` shows one clear action button.
- [ ] `4x2` shows both `Add` and `Check`.
- [ ] Add a deposit that reduces today's due amount → widget refreshes.
- [ ] Satisfy today's period target completely → widget switches from
      due-state to done-state.
- [ ] Room with no bucket rules / no focus items → widget falls back to
      saved/progress summary instead of showing a misleading zero due.
- [ ] Weekly rule room and monthly rule room both show the correct
      period label.
- [ ] Deep-link actions still land in:
  - deposit sheet
  - check-balance sheet
  - dashboard

## 8. Explicitly not doing

- No backend changes of any kind.
- No new widget families or resize classes beyond the existing `2x2`
  and `4x2`.
- No extra widget button for Team, Saving Plan, or notifications.
- No attempt to show multiple bucket rows or a checklist inside the
  widget.
- No move away from the current snapshot-driven native architecture.

## 9. Suggested commit message

```text
plan: define save-today-first widget refresh
```
