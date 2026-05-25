# Task 44 — Momentum Purpose Picker Enhancements

Status: Planning.
Date drafted: 2026-05-25.
Branch: `feature/task-42-momentum-purpose-mode` (continue existing branch).

## Goal

Enhance the Momentum Purpose Picker with multi-select support, mode-aware category/bucket filtering, improved bar-chart icon styling, and scroll arrow hints.

## Slices

### Slice 1 — Multi-select purpose picker with Clear button

**Current**: Single-select — tapping a category replaces the active scope. `MomentumPurposeScope` is `{ kind: 'all' } | { kind: 'category'; category } | { kind: 'bucket'; bucketId; parentCategory }`.

**Target**: Multi-select categories. Tapping a category toggles it on/off. When multiple are selected the chart aggregates deposits from all selected categories. A "Clear" button appears when any categories are selected, resetting to All.

**Changes**:

1. **`src/lib/momentumPurpose.ts`** — Add a new scope kind:
   - `{ kind: 'categories'; categories: BucketCategory[] }` for multi-select.
   - Update `filterLogsByPurpose` to handle `categories` kind (filter logs where bucket category is in the set).
   - Keep `kind: 'all'`, `kind: 'category'`, `kind: 'bucket'` for backward compat.

2. **`src/components/MomentumPurposePicker/MomentumPurposePicker.tsx`**:
   - Change `value` type from `MomentumPurposeScope` to accept the new `categories` kind.
   - Category chip: tap toggles the category in/out of a Set. If only one category remains and it's untoggled, revert to `all`.
   - "All" chip: active when `kind === 'all'`; tapping it clears selection.
   - Add a small "Clear" / `IconX` pill that appears when any categories are selected, clears to `all`.
   - Remove `onClear` from individual category chips (the global Clear replaces it).

3. **`src/pages/Dashboard.tsx`**:
   - Update `purposeScope` state type to accept `categories` kind.
   - Update `effectiveTrendMode` logic: bucket-level scope still forces `me`; `categories` kind does not force any mode.
   - Update `selectedPurposeEmptyMessage` to handle `categories` kind.

4. **`src/pages/SavingPlan.tsx`** — Not affected (no purpose picker there).

### Slice 2 — Mode-aware category and bucket filtering

**Current**: `purposeCategories` is derived from `allVisibleBuckets` (user's + all room members' buckets, non-archived). Same set shown regardless of `Total` / `Me` / `Compare` mode.

**Target**:
- **Total mode**: Show all categories that have any bucket in the room (current behavior — all visible buckets).
- **Me mode**: Show categories that the user's own buckets belong to. Show the user's actual buckets in the sub-pill row below the matching category.
- **Compare mode**: Show only categories that have at least one deposit in the 7-day window (from either the user or the compared partner).

**Changes**:

1. **`src/lib/momentumPurpose.ts`**:
   - Add `availablePurposeCategoriesForMode(mode, userBuckets, allVisibleBuckets, logs, visibleBucketsById, compareMemberId?, userId?, today?)`.
     - `room` → `availablePurposeCategories(allVisibleBuckets)` (existing).
     - `me` → derive from user's own buckets only.
     - `compare` → derive from categories that have deposits in the 7-day window from user or compare member.
   - Add `bucketsForCategoryByOwner(buckets, category, userId)` — filter buckets for "Me" mode sub-pills.

2. **`src/pages/Dashboard.tsx`**:
   - Replace `purposeCategories` computation with mode-aware version.
   - Pass user's own buckets (not `allVisibleBuckets`) to `MomentumPurposePicker.buckets` when mode is `me`.
   - When mode changes, if a selected category is no longer available, auto-reset to `all`.
   - Bucket sub-pill row: already `hideBucketRow={effectiveTrendMode !== 'me'}` — keep this.

3. **`src/components/MomentumPurposePicker/MomentumPurposePicker.tsx`** — No changes needed; it just renders whatever `categories` and `buckets` props it receives.

### Slice 3 — White SVG icons on bar chart (no background)

**Current**: `BarIconCluster` in `MomentumChart.tsx` renders icons inside a `<span>` with `bg-white/95 shadow rounded-full` — a white circle chip behind each icon. Icons inherit `color` from the bar colour prop.

**Target**: Icons render as white strokes with no background circle. Vertically stacked (column layout) instead of horizontal row. No shadow chip.

**Changes**:

1. **`src/components/MomentumChart/MomentumChart.tsx`** — `BarIconCluster`:
   - Remove the `bg-white/95 shadow rounded-full` wrapper on each icon chip.
   - Set icon colour to white (`#FFFFFF`) instead of inheriting bar colour.
   - Change the flex container from `flex-row` (`items-center gap-0.5`) to `flex-col` (vertical stack).
   - Adjust `clusterW` / `clusterH` calculations for vertical layout.
   - Keep the "+N" extra count badge but style it as white text, no background.

### Slice 4 — Scroll arrow hints on purpose picker fade edges

**Current**: `ScrollFadeContainer` renders gradient fades on left/right edges when content overflows. No arrow indicators.

**Target**: Add small chevron arrow icons (`<` / `>`) overlaid on the fade gradient edges when scrollable, to hint that more categories exist in that direction.

**Changes**:

1. **`src/components/Icon/Icon.tsx`** — Add `IconChevronLeft` and `IconChevronRight`:
   - `IconChevronLeft`: `<path d="M15 18l-6-6 6-6" />`
   - `IconChevronRight`: `<path d="M9 6l6 6-6 6" />`

2. **`src/components/ScrollFadeContainer/ScrollFadeContainer.tsx`**:
   - Add optional `showArrows?: boolean` prop (default `false`).
   - When `showArrows` is true and `canScrollLeft` / `canScrollRight`:
     - Overlay a small chevron icon on each fade edge, centred vertically.
     - Arrow uses `text-ink-muted` colour, `pointer-events-none`.
     - Fades in/out with the same opacity transition as the gradient.

3. **`src/components/MomentumPurposePicker/MomentumPurposePicker.tsx`**:
   - Pass `showArrows` to `ScrollFadeContainer` for the category row.

## Execution Rules

- Implement each slice as a separate commit.
- After each slice: `npm run build` + `npm run lint`.
- Pre-approved plan: start each slice directly without per-slice confirmation.
- Pixel-perfect UI attention for all visual changes.
- Do not change unrelated code.
