# Task 22.3d — Saving Plan Page Typography + Spacing Pass

## Purpose

Apply the same visual treatment to the Saving Plan / Change Plan page that was
done to the Check Balance page in the previous pass:

- Bigger eyebrow / section labels (currently very small uppercase).
- Bigger helper text under inputs.
- Slightly lowered content, with the back button left in place at the very top.
- Bigger "Saving Plan" page header.

This is a typography + spacing pass only. No calculation changes, no schema
changes, no new fields, no new component refactors beyond what is needed to
override label sizes on this page.

## Scope

Touches one file: `src/pages/SavingPlan.tsx`.

Do not touch:

- Migrations, schema, RLS, `savings_logs`, RPCs.
- `src/lib/savingPlan.ts` calculation helpers.
- `useSavingPlan` hook.
- `SavingPlanCard` Dashboard component (already done in 22.3c).
- Shared components: `PageHeader`, `FormField`, `SectionLabel`, `TextInput`.
  These are used by many other pages and must not change. Where Saving Plan
  needs bigger labels, replace usage of `PageHeader` / `FormField` on this
  page only with inline markup (same pattern used in `CheckBalance.tsx`).

## Current state (anchors in src/pages/SavingPlan.tsx)

- `PageHeader` with `eyebrow="Saving Plan"` and conditional title
  `"Set up plan" / "Change plan"`. Eyebrow renders at `text-[11px]` through
  `SectionLabel`.
- "Plan type" section eyebrow uses inline span at
  `font-mono text-[11px] font-bold uppercase tracking-wider text-brand-800`.
- "Stop when" section eyebrow uses inline span at
  `font-mono text-[11px] font-bold uppercase tracking-wider text-ink-muted`.
- All form fields (`Start amount`, `Increase by`, `Maximum daily amount`,
  `Run this plan for`, `End date`, `Amount`, `Plan target`) use `FormField`
  whose label is `text-[11px]` uppercase muted and whose helper is `text-xs`.
- Preview card eyebrow uses inline span at
  `font-mono text-[11px] font-bold uppercase tracking-wider text-brand-800`.
- All sections are stacked under `<div className="flex flex-col gap-5">` and
  start directly under the back button of `PageHeader` — no extra top space.

## Target visual baseline

Match the size tokens used on Check Balance after the 22.3c pass:

- **Page eyebrow** (`Saving Plan`):
  `font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800`
- **Page title** (`Set up plan` / `Change plan`): keep `text-3xl font-bold`.
- **Section eyebrows** (`Plan type`, `Stop when`, `Preview`,
  per-field labels like `Start amount`):
  `font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800`
- **Helper text** under inputs (`Per day.`, future per-field helpers):
  `font-mono text-sm text-ink-muted` (was `text-xs`).
- **Stop-condition pill button labels**: unchanged. They are CTA labels, not
  section labels. They stay `text-xs font-bold`.
- **Preset cards** (`Daily / Weekly / Monthly / Increasing`): unchanged.
  Their `text-sm font-bold` body is already comfortable.
- **Preview rows** (`Estimated finish` / `Saving days` / `Daily cap` /
  `Expected total`): keep current sizes. The user asked for the eyebrow to
  be bigger, not the data inside.

## Layout / spacing

Mirror Check Balance:

```text
<div className="flex flex-col gap-5">
  <div>                                       ← back button alone, top
    <IconButton ariaLabel="Go back" …>
      <IconArrowLeft size={20} />
    </IconButton>
  </div>

  <div className="mt-10 flex flex-col gap-5"> ← lowered content
    <header>
      <p [bigger eyebrow]>Saving Plan</p>
      <h1>{Set up plan | Change plan}</h1>
    </header>

    {goal summary card}            ← (already exists, keep)
    {current revision summary}     ← (only when isChange)
    {Plan type card}
    {Plan fields card}
    {Preview card}
    {validation / error}
    {primary CTA + cancel}
    {revision footnote}            ← (only when isChange)
  </div>
</div>
```

Notes:

- The wrapper `mt-10` is what lowers the content. The back button stays at the
  natural top — this matches what was shipped on Check Balance.
- The skeleton return (`if (loading)`) does not need the new structure since
  the skeleton already renders independent placeholder blocks. Leave it alone.

## Required edits in `SavingPlan.tsx`

1. **Imports**
   - Remove `PageHeader` import.
   - Remove `SectionLabel` import if it becomes unused.
   - Add `IconArrowLeft` from `Icon`.
   - Add `IconButton` from `IconButton`.
   - Keep `FormField` import — most uses can be replaced inline, see below.
     If every usage is replaced, drop the `FormField` import too.

2. **Header replacement**
   Replace `<PageHeader eyebrow="Saving Plan" title={…} showBack />` with
   the back-button row + lowered `<header>` shown in the layout sketch above.

3. **Per-section eyebrows**
   Bump every eyebrow listed below from `text-[11px]` → `text-lg` while
   keeping `font-mono font-bold uppercase tracking-[0.18em]`:
   - "Plan type" (inside the plan-type peach card)
   - "Stop when" (inside the increasing-daily field group)
   - "Preview" (top of the preview peach card)

4. **Form field labels and helpers**
   For every `FormField` on this page, replace with the inline pattern used
   on Check Balance so the label can be bigger and the helper can be larger:

   ```tsx
   <label className="block">
     <span className="block font-mono text-lg font-bold uppercase tracking-[0.18em] text-brand-800">
       {fieldLabel}
     </span>
     <div className="mt-3">{input}</div>
     {helper && (
       <span className="mt-3 block font-mono text-sm text-ink-muted">{helper}</span>
     )}
   </label>
   ```

   Apply to:
   - `Start amount`
   - `Increase by`
   - `Maximum daily amount`
   - `Run this plan for` (conditional)
   - `End date` (conditional, both inside Stop When and inside the fixed
     plans' bottom row)
   - `Amount` (fixed plans path; keep the `Per day.` / `Per week.` /
     `Per month.` helper, bumped to `text-sm`)
   - `Plan target` (no helper currently — leave helper off)

5. **Preview eyebrow**
   The peach preview card's "Preview" label uses an inline span at
   `text-[11px] font-bold uppercase tracking-wider text-brand-800`. Bump to
   the same `text-lg … tracking-[0.18em] text-brand-800` rule used for the
   other section eyebrows.

6. **Preview body rows**
   Do **not** change row label/value sizes inside the preview. Those are data
   rows, not labels. The pass is about elevating labels, not numbers.

7. **Goal summary + current-revision summary cards**
   These two cards above the form (`Project goal`, `Current plan · until
   today`) currently use `SectionLabel tone="muted"` for their eyebrow at
   `text-[11px]`. Bump those same eyebrows to `text-lg` so they are
   consistent with the rest of the page. The mono value and helper rows
   underneath stay the same.

8. **Field-group container heights and gaps**
   No change. Existing `flex flex-col gap-3` and `gap-4` inside the plan
   fields card remain. Larger labels naturally take a little more vertical
   space; do not pre-emptively tighten gaps until the change is visually
   reviewed.

## Validation expectations

- No new validation logic.
- The page's existing client-side validation messages (`Enter a plan target.`,
  `Enter a start amount.`, `Maximum daily amount must be at least the start
  amount.`, etc.) stay verbatim.
- The submit handler is untouched.
- The preview's live `projectedCompletionDate` / `plannedCumulativeThroughDate`
  calls remain unchanged. The same `useMemo` inputs continue to drive it.

## Cross-checks before merging

- `npm run build` passes.
- `npm run lint` passes with no new warnings.
- Saving Plan page renders for:
  - New plan (no existing revision) — preset selection, form fields, preview.
  - Change Plan (existing revision) — current revision summary visible,
    fields seeded.
- Mobile width (≤ 375px) still wraps cleanly:
  - The `Start amount / Increase by` two-column row keeps both inputs
    readable; if `text-lg` uppercase labels start to wrap awkwardly here,
    fall back to `text-base` for that pair only (record the deviation in
    the PR description).
  - Stop-condition pills do not push out of the card.
  - Preview rows do not overflow.
- Check Balance page still looks identical — no shared component should
  have been altered.

## Out of scope (for this pass)

- Pause / resume.
- Charts (Task 22.5).
- Transfers / withdrawals / partner approval.
- Reconcile allocation.
- New copy. Keep all text the same except where structural simplification
  is already in the previous tasks.
- Touching `PageHeader`, `FormField`, or `SectionLabel` shared components.

## Acceptance

The Saving Plan page should read with the same calm, readable hierarchy as
the post-22.3c Check Balance page: a generous breath of space at the top
under the back button, a confident larger "Saving Plan" eyebrow above the
title, larger uppercase section labels for every form field and card
header, and helper text that is comfortable to read on a phone. No
calculation or behavior change.
