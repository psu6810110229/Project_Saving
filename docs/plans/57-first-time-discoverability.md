# Plan 57 — First-Time Discoverability (High + Medium risk)

## Goal
New users land on the Dashboard with no guidance for several non-obvious
features. Add lightweight, just-in-time hints that **reuse the existing
`BucketDragHint` visual language** so every hint reads as one product voice —
never a forced onboarding tour. Respect the app's psychology-first rules:
low learning curve, minimal reading, never make the user feel bad.

## Locked decisions
- New hints persist "seen" via **localStorage** (lighter; no migration). The
  existing drag-transfer hint keeps its DB column `bucket_drag_hint_seen_at`.
- **No permanent grip dots** on bucket cards — the hint banner is the only
  teaching surface (avoids grid visual noise).
- Out of scope: Saving Plan (already has `noPlanYet` + "Set up plan" CTA),
  and all 🟡 low-risk items (heatmap flag-tappable, surplus, completed buckets).
- No money-state / RPC / migration changes. UI + copy only.

## Slices (one commit each, stop + verify between)

### Slice 1 — Revive drag-to-transfer hint 🔴
`BucketDragHint` is built and its persistence plumbing exists in `Dashboard.tsx`,
but the `<BucketDragHint/>` render was dropped (only lives in `temp.tsx`).
- Re-import the component; add missing state/handlers (`markedThisSession`,
  `handleBucketDragHintShown` → `markBucketDragHintSeen()`, `…Dismiss`).
- Pull `profile`/`loading` from `data.profile`.
- Gate: `bucketDragMode === 'transfer' && activeBucketItems.length >= 2 &&
  !profileLoading && !bucketDragHintDismissed &&
  (!profile?.bucket_drag_hint_seen_at || markedThisSession)`.
- Render inside `BucketGrid` `belowHeader`, beneath `BalanceCheckStatus`.
- Reuse copy `bucketDragHint.message` + DB column. No migration.

### Slice 2 — Edit-mode reorder hint 🔴
- New helper `src/lib/hintSeen.ts`: `hasSeenHint(key)` / `markHintSeen(key)`
  (localStorage, try/catch guarded). Reusable for future hints.
- On first entry to edit mode (`isEditing`, key `bucket-edit-hint`), show the
  same `BucketDragHint` component with new copy.
- New copy `bucketEditHint.message` (th/en): "ลากเพื่อจัดลำดับ · แตะ ✕ เพื่อลบ ·
  แตะการ์ดเพื่อแก้ไข".

### Slice 3 — Check Balance concept + shortfall tone 🟠
- `BalanceCheckStatus.tsx` never-checked state: add a permanent one-line
  explainer under `cardNeverChecked` (new copy `cardCheckIntro`).
- Review shortfall copy (`sync.title/body`, `cardShortfallNudge`) so wording
  reframes as "match real money", never "money lost / you failed".

### Slice 4 — Hero pencil clarity 🟠
- Replace hardcoded `editAriaLabel="แก้ไขเป้าหมาย"` on `HeroCard` with an
  i18n key (`dashboard.editGoalAriaLabel`). No coach hint — pencil is a
  guessable convention. a11y + bilingual correctness only.

## Verification
`tsc -b` + scoped eslint on touched files (project build/lint are red on a
clean checkout for unrelated reasons). Files: `Dashboard.tsx`,
`BalanceCheckStatus.tsx`, `HeroCard*`, `th.ts`, `en.ts`, new `lib/hintSeen.ts`.
