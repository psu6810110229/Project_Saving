# 53 — Create-Room Wizard bug fixes & polish

## Goal
Fix the reported bugs across the 5-step Create-Room wizard (steps 3–5), make the
expense step safe and clear, make step-4 suggestions smarter and user-overridable,
replace emoji with `.svg` icons, add a realistic "creating project" loading
animation, and give the dashboard a first-time immersive entrance with
non-overlapping section timing.

Presentational + client-validation only. **No DB schema, RLS, money-state model,
routing, or stack changes.** No new npm packages.

## Current baseline (pre-existing uncommitted WIP in the tree)
The working tree already contains in-progress "wizard polish" that this plan
builds on (it will be committed as the branch baseline before slice work):
- `CreateRoomWizard.tsx`: shared header **Next/Back** pills gated by `canAdvance`;
  per-step Back/Next buttons removed from each step component.
- `StepExpenses.tsx`: suggested buckets already get an `IconTrash` remove button;
  running total moved above the list; custom remove still uses a `✕` glyph.
- `travelExpenseRules.ts`: `TRAVEL_EXPENSE_RULES` reduced to 4 categories;
  `flight` relabeled **"ค่าเดินทาง" / "Travel"**; budget percentages rebalanced.
- `AppLayout.tsx`: setup-screen entrance motion (from plan 52).

## Confirmed decisions
1. **Editable names:** every bucket name (suggested + custom) is inline-editable,
   each with a small **pencil icon** affordance.
2. **Icons:** real **`.svg` asset files** under `src/assets/icons/`, imported as
   URLs (no `svgr` in this project) and rendered via `<img>`. Colors are baked
   into each file to match its context (currentColor can't apply through `<img>`).
3. **Dashboard immersive entrance:** plays **once per browser session**
   (sessionStorage flag); quiet/subtle on later in-session visits.
4. **Step-4 saving-plan picker:** offers **Daily / Weekly / Monthly / Flexible**,
   reusing `bucketRuleSuggest` helpers.

## Branch
`fix/create-room-wizard-bugfixes` (off the current branch, carrying the WIP).
Commit per slice.

---

## Slice 0 — Branch + baseline + plan doc
- Create the feature branch.
- Commit the existing wizard-polish WIP as the baseline (so slice diffs stay clean).
- Commit this plan doc.
- `.claude/settings.local.json` stays untracked/uncommitted.

## Slice 1 — Emoji → `.svg` icons (steps 4 & 5)
New assets in `src/assets/icons/`: `lightbulb.svg` (tip), `calendar.svg`,
`coins.svg` (money), `celebrate.svg` (success). Each authored in the brand/ink
tone of its usage spot.
- `StepTimeline.tsx`: replace `📅` → calendar, `💰` → coins, `💡` → lightbulb.
- `StepSummary.tsx`: replace `🎉` → celebrate, `💡` → lightbulb.
- Render: `<img src={icon} alt="" aria-hidden className="h-4 w-4" />` (size per spot).
- Verify `import x from '...svg'` returns a URL string (Vite default).

## Slice 2 — Step 3 layout, editable names, caret fix
`StepExpenses.tsx` (+ i18n):
- **Unify every expense row** so suggested and custom rows look identical:
  checkbox · category icon · editable name + pencil · amount · `IconTrash`.
  - Custom `✕` text button removed → uses the same `IconTrash` control (req. A).
  - `updateName` applies to **all** rows (not just custom); show a small
    `IconEdit` (pencil) next to the name as the edit hint (req. C, decision 1).
- **Compact the total-budget section** (req. D): tighten the budget input card
  and fold the running total into a single compact card / inline row instead of
  two tall stacked blocks.
- **Caret/format fix** (req. E): the amount inputs reformat with `toLocaleString`
  on every keystroke, which resets the caret to the end (so mid-string deletes
  fail). Fix by keeping the raw digit string in local edit state and only
  formatting with commas on blur (apply to the budget input + each row amount).

## Slice 3 — Step 3 validation, no pre-fill, min budget 500, popups
`CreateRoomWizard.tsx` + `StepExpenses.tsx` (+ i18n):
- **No auto pre-fill** (req. H): `buildInitialExpenses` stops defaulting budget to
  `50_000` and stops pre-filling per-bucket amounts — budget starts empty, row
  amounts start at 0. Entering a total budget still splits it across categories
  (keep `handleBudgetChange`).
- **Next disable** (req. I): step-3 `canAdvance` = `totalBudget > 0`.
- **Minimum budget 500** (req. J) + **validation popups** (req. K, B): on Next,
  validate and show a reusable **`Modal`** alert when something is wrong:
  - budget `< 500`
  - no bucket selected (none checked)
  - a checked bucket has a blank name
  - total budget `<` sum of checked bucket amounts
  Only advance when all pass. Keep the inline "select at least one" hint too.

## Slice 4 — Step 3 remove confirmation + "Gone" effect
`StepExpenses.tsx` (+ i18n):
- **Confirm every trash tap** (req. G): reuse **`ConfirmModal`** ("Remove this
  bucket?") before deleting; cancel keeps it.
- **"Gone" animation** (req. F): on confirm, apply the existing `bucket-gone`
  CSS class to the row, then remove from state after the ~420ms animation
  (respects `prefers-reduced-motion`, which the keyframe already handles).

## Slice 5 — Step 4 smarter, name-aware suggestions (Thai context)
New `src/lib/expenseNameClassifier.ts` + tip copy (+ i18n):
- Keyword classifier maps a bucket **name** (Thai + English) to a refined
  sub-type and a short, natural, Thai-context suggestion sentence. Examples:
  - `เครื่องบิน / ตั๋วเครื่อง / เที่ยวบิน / flight` → airplane-ticket advice.
  - `ค่าเดินทาง / เดินทาง / transport` → **does not** assume a flight; suggests
    comparing options (รถไฟ / รถทัวร์ / เรือ / น้ำมัน / เช่ารถ) by budget.
  - dedicated lines for รถไฟ(train), รถทัวร์·รถบัส·รถตู้(bus/van), เรือ(ferry),
    น้ำมัน(fuel), เช่ารถ(car rental), ที่พัก(stay), อาหาร(food),
    ช็อปปิ้ง·ของฝาก(shopping), กิจกรรม·ทัวร์(activities), เงินสำรอง(buffer).
- Every category/sub-type gets its own sentence; sentences stay short and
  realistic. Wire `StepTimeline` (and custom rows, currently `other` → no tip)
  to classify by name and render the tailored sentence.

## Slice 6 — Step 4 per-bucket saving-plan picker
`wizardTypes.ts`, `StepTimeline.tsx`, `StepSummary.tsx`, `useRooms.ts` (+ i18n):
- Add `savingRuleType?: SavingRuleType | null` + `savingRuleAmount?: number | null`
  to `ExpenseDraftItem`, defaulting to the computed suggestion.
- In `StepTimeline`, add a compact picker (Daily / Weekly / Monthly / Flexible)
  per bucket, reusing `bucketRuleSuggest` (`calcRuleAmount`, `recommendedRule`,
  `initialRuleChoice`); recompute the shown amount on change.
- Thread the chosen rule through `StepSummary` → `createRoomWithTemplates`
  (extend `CreateRoomWithTemplatesValues` expense payload); in `useRooms`, prefer
  the user's chosen rule over the auto `calcSuggestedRule` when present.

## Slice 7 — Step 5 "creating project" loading animation
- Extract the pure fake-progress helpers (`buildProgressKeyframes`,
  `interpolateKeyframes`) from `AppUpdateAvailableModal` into
  `src/lib/fakeProgress.ts`; import them back there (no behavior change) and in a
  new `CreateProjectLoader` modal that mirrors the update-modal progress bar +
  percentage (req. O), running ~3.5–4.5s.
- `StepSummary.handleCreate`: show the loader, run create in parallel, and reveal
  the success (invite code) / error / conflict states only after **both** the
  create resolves **and** the loader animation completes (so the bar never
  snaps). Reuse `appUpdate.progressMessages` or add wizard-specific lines.

## Slice 8 — Dashboard first-load immersive + sequential timing
`Dashboard.tsx`:
- **Once-per-session immersive** (req. P, decision 3): a sessionStorage flag picks
  the richer entrance on the first dashboard view of the session; later visits use
  a quiet/near-instant variant.
- **Non-overlapping timing** (req. Q): the immersive container uses
  `staggerChildren`/`delayChildren` ≥ the per-section duration so each section's
  entrance finishes before the next begins (sequence, not overlap). Full
  `prefers-reduced-motion` fallback (reuse existing reduced variants).

---

## Out of scope
- No DB/RLS/edge-function/money-state changes; `savings_logs` untouched.
- No new libraries; no design-token additions; no changes to join flow,
  create/conflict logic, or routing.

## Verification (each slice)
- `npm run build`; `npm run lint` when practical.
- Manual: walk steps 3→4→5 in TH and EN, reduced-motion on/off, then create a
  project and land on the dashboard.
