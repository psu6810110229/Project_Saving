# Task 43 — Momentum Bucket Drilldown

Extend the purpose picker from Task 42 with a bucket-level drill-in layer.
Category chips remain the default; selecting a category reveals the actual
buckets inside it so the user can scope momentum to a single bucket they
created (e.g. "JR Pass" under Transport, "โรงแรม" under Stay).

## Why

Category-level filtering answers "how's my transport spending?" but users
emotionally track individual buckets they named. When multiple buckets
share a category (Hotel + Airbnb → Stay), the user has no way to isolate
one. This task closes that granularity gap.

## Design

### Interaction flow

1. **Default** — category row looks the same as today: `All | ✈ Flight | 🏠 Stay | …`
2. **Tap a category** — momentum scopes to that category (unchanged).
   A second row of **bucket sub-pills** appears directly below, showing
   the user's buckets in that category (e.g. `โรงแรม` `Airbnb` `ที่พักคืนแรก`).
3. **Tap a bucket pill** — momentum scopes to that single bucket.
   The category chip stays visually highlighted as the parent context.
4. **Tap the category chip again** (while a bucket is selected) — resets
   to category-level scope (deselects the bucket).
5. **Tap "All"** — collapses bucket row, resets to all-category view.

### Animation — Apple liquid grass motion

Bucket sub-pills use spring physics inspired by Apple's liquid grass
effect (the organic motion, not the frosted-glass visual):

- **Entrance**: pills scale from 0 → 1 with spring overshoot, staggered
  by ~40 ms per pill, creating a ripple/cascade from left to right.
- **Exit**: reverse stagger, pills scale down and fade out.
- **Spring config**: reuse `SPRING.content` from `src/lib/motion.ts`
  (`damping: 26, stiffness: 260`) — organic feel without excessive bounce.
- **`prefers-reduced-motion`**: skip spring, use instant opacity crossfade.

Implementation notes:
- Use `framer-motion` `AnimatePresence` + `motion.button` with
  `variants` for stagger.
- Each bucket pill gets `custom={index}` for stagger delay calc.
- Container height animates smoothly (no layout jump) via
  `motion.div` with `layout` or explicit height transition.

### Empty / edge cases

- Category with 0 buckets: can't happen — `availablePurposeCategories`
  only returns categories that have at least one active bucket.
- Category with 1 bucket: still show the sub-pill row (one pill).
  Scoping to that bucket is semantically different from the category
  total if partner also has buckets in the same category.
- Bucket with 0 deposits in momentum window: show pill but dimmed
  (`opacity-50`, not hidden). User should see it exists even if inactive.
- Archived buckets: excluded (same as current behavior).

### Member comparison at bucket level

- When scoped to a specific bucket, member comparison becomes
  asymmetric — the partner likely does not have the same bucket.
- **Approach**: at bucket scope, show only the current user's data
  (solo view). The member trend mode control stays visible but the
  compare/room modes fall back to category-level data, with a subtle
  indicator that bucket-level comparison isn't available.
- Simpler alternative (recommended for v1): when bucket scope is
  active and trend mode is "Room" or "Compare", auto-switch to "Me"
  and disable the other modes until the user goes back to category
  or all scope.

---

## Implementation

### Slice 1 — Data layer: add bucket scope

**Files:**

- `src/lib/momentumPurpose.ts`
- `src/types/index.ts` (no change needed — `Bucket` already has `id`)

**Changes to `momentumPurpose.ts`:**

1. Extend `MomentumPurposeScope` union:

```ts
export type MomentumPurposeScope =
  | { kind: 'all' }
  | { kind: 'category'; category: BucketCategory }
  | { kind: 'bucket'; bucketId: string; parentCategory: BucketCategory };
```

`parentCategory` is stored so the picker knows which category row to
keep highlighted without a reverse lookup.

2. Update `filterLogsByPurpose` to handle the new `bucket` kind:

```ts
if (scope.kind === 'bucket') {
  return logs.filter(log => log.bucket_id === scope.bucketId);
}
```

3. Add helper to get buckets for a category:

```ts
export function bucketsForCategory(
  visibleBuckets: Bucket[],
  category: BucketCategory,
): Bucket[] {
  return visibleBuckets
    .filter(b => !b.archived_at && normalizeBucketCategory(b.category) === category)
    .sort((a, b) => a.position - b.position);
}
```

4. Update the scope-validity guard in Dashboard `useEffect` to also
   handle stale bucket scopes (bucket archived/deleted mid-session).

**Build check:** `npm run build` must pass. No UI changes yet.

---

### Slice 2 — Picker UI: bucket sub-pill row with liquid animation

**Files:**

- `src/components/MomentumPurposePicker/MomentumPurposePicker.tsx`

**Changes:**

1. Add `buckets` prop (visible, non-archived buckets for the room):

```ts
interface MomentumPurposePickerProps {
  categories: BucketCategory[];
  buckets: Bucket[];           // new
  value: MomentumPurposeScope;
  onChange: (next: MomentumPurposeScope) => void;
}
```

2. Compute `activeBuckets` inside the component:

```ts
const activeBuckets = value.kind !== 'all'
  ? bucketsForCategory(buckets, value.kind === 'category' ? value.category : value.parentCategory)
  : [];
```

3. Render bucket sub-pill row below the category row:

```tsx
<AnimatePresence mode="popLayout">
  {activeBuckets.length > 0 && (
    <motion.div
      key="bucket-row"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={SPRING.content}
      className="overflow-hidden"
    >
      <ScrollFadeContainer ...>
        <div className="flex gap-1.5">
          {activeBuckets.map((bucket, i) => (
            <BucketSubPill
              key={bucket.id}
              bucket={bucket}
              active={value.kind === 'bucket' && value.bucketId === bucket.id}
              index={i}
              hasDeposits={/* check if bucket has deposits in window */}
              onClick={() => onChange({
                kind: 'bucket',
                bucketId: bucket.id,
                parentCategory: normalizeBucketCategory(bucket.category),
              })}
            />
          ))}
        </div>
      </ScrollFadeContainer>
    </motion.div>
  )}
</AnimatePresence>
```

4. `BucketSubPill` component (inline in same file):

- `motion.button` with staggered spring entrance:
  - `initial={{ scale: 0, opacity: 0 }}`
  - `animate={{ scale: 1, opacity: hasDeposits ? 1 : 0.5 }}`
  - `transition={{ ...SPRING.content, delay: index * 0.04 }}`
- Visual style: slightly smaller than category chips, rounded-pill,
  shows bucket name (truncated). Active state uses `bg-brand-400`
  (lighter than category's `bg-brand-500`) to show hierarchy.
- Dimmed when `hasDeposits` is false.

5. Update category chip tap behavior:
   - If tapping the already-selected category while a bucket is active →
     reset to category scope (deselect bucket).
   - If tapping a different category → switch to that category scope,
     bucket row updates.

6. `prefers-reduced-motion`: wrap spring transitions with a check.
   If reduced motion, use `duration: 0.15` opacity-only crossfade.

**Build check:** `npm run build` must pass.

---

### Slice 3 — Dashboard wiring + member mode guard

**Files:**

- `src/pages/Dashboard.tsx`

**Changes:**

1. Pass `buckets` to `MomentumPurposePicker`:

```tsx
<MomentumPurposePicker
  categories={purposeCategories}
  buckets={[...buckets, ...data.roomMembersBuckets.allBuckets]}
  value={purposeScope}
  onChange={setPurposeScope}
/>
```

2. Update the scope-validity `useEffect`:

```ts
useEffect(() => {
  if (purposeScope.kind === 'category') {
    if (!purposeCategories.includes(purposeScope.category)) {
      setPurposeScope({ kind: 'all' });
    }
  } else if (purposeScope.kind === 'bucket') {
    if (!visibleBucketsById.has(purposeScope.bucketId)) {
      setPurposeScope({ kind: 'all' });
    }
  }
}, [purposeScope, purposeCategories, visibleBucketsById]);
```

3. Member mode guard — when `purposeScope.kind === 'bucket'`:
   - If `trendMode` is `'room'` or `'compare'`, auto-switch to `'me'`.
   - Disable Room/Compare mode buttons (visually dimmed + non-interactive).
   - When the user switches back to category or all scope, re-enable
     all trend modes.

**Build check:** `npm run build` must pass.

---

### Slice 4 — Polish and visual QA

1. Test with 1, 3, 5+ buckets in a category — verify scroll, truncation,
   stagger timing.
2. Verify `prefers-reduced-motion` degrades gracefully.
3. Verify Thai bucket names display correctly (no clipping).
4. Verify the bucket sub-pill row doesn't cause layout shift in the
   chart card.
5. Test on narrow viewport (320px width).
6. Verify haptic feedback fires on bucket pill tap (reuse `haptic('success')`).

---

## Files touched

| File | Change |
|------|--------|
| `src/lib/momentumPurpose.ts` | Add `bucket` scope kind, `bucketsForCategory` helper |
| `src/components/MomentumPurposePicker/MomentumPurposePicker.tsx` | Add bucket sub-pill row with spring animation |
| `src/pages/Dashboard.tsx` | Pass buckets, scope-validity guard, member mode guard |
| `src/lib/motion.ts` | (optional) add `SPRING.pill` if content spring doesn't feel right |

## Out of scope

- Partner bucket comparison (asymmetric bucket names across users).
- Bucket-level expected/planned line in the chart.
- Bucket grouping or reordering within the sub-pill row.
- Any Supabase schema or migration changes.
