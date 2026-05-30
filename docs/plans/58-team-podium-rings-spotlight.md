# 58 — Team Podium: "Rings + Spotlight"

Status: **PROPOSED — awaiting approval. No code yet.**
Scope: **Visual + layout reskin only** of the Team leaderboard section. No data,
routing, RLS, money-state, or hook changes (one tiny additive field-map in
`Team.tsx` is the only non-visual edit).

---

## 1. Goal

Replace the flat 3-up grid in `TeamSection.tsx` with a premium **2‑vs‑1‑vs‑3
podium of circular progress rings**, with a soft "spotlight" behind the
champion. Fix the three things that make today's version feel cheap:

1. No hierarchy — equal flat `bg-well` tiles for a "Top 3". → Stepped, scaled podium.
2. The ghost `IconUser` at the bottom of each tile (TeamSection.tsx:139–141) reads
   as a broken avatar. → Removed entirely.
3. Surfaces almost no useful signal. → Ring encodes progress at a glance; **positive-only**
   reinforcement (crown, streak flame, today-dot) adds meaning without shaming low savers.

Design principles honored (from project memory):
- **Never make users feel bad** — no per-member "฿0 / 🔥0 / last place" shaming.
  Every member gets the same dignified ring; only *positive* badges ever appear.
- **Minimal reading / consistent numbers** — the ring is the primary signal; the
  `%` is confirmation, rendered `tabular-nums` and `Math.round`ed everywhere.
- **Low learning curve** — it reads as a podium instantly; tap targets unchanged.

---

## 2. Files

| File | Change |
|---|---|
| `src/components/ProgressRing/ProgressRing.tsx` | **NEW** — reusable SVG ring atom (mirrors `ProgressBar` API). |
| `src/components/TeamSection/TeamSection.tsx` | **REWRITE internals**, keep exported `TeamSection` + `TeamSectionMember` contract. Extend `TeamSectionMember` with 2 optional fields. |
| `src/pages/Team.tsx` | **+2 lines** inside the existing `leaderboardEntries` map (pass `streak`, `hasLoggedToday`). No other change. |

No changes to `Team.tsx` routing, `useLeaderboard`, `Avatar`, `ProgressBar`, or
tokens. `TeamSection` is consumed **only** by `Team.tsx` (verified via grep), so
there is no preview/reference screen to keep in sync.

> Note: `Avatar`'s `ring`/`themeColor` props are currently inert (Avatar.tsx
> drops them in the render). We deliberately do **not** rely on them — the ring is
> a wrapper around `<Avatar>`. Avatar is left untouched.

---

## 3. New atom — `ProgressRing`

A crisp SVG donut, antialiased, with rounded cap. Chosen over `conic-gradient`
because SVG `stroke-dashoffset` animates smoothly, matches the existing
`line-draw` SVG pattern in `global.css`, and renders sharp at any DPR.

API (mirrors `ProgressBar` deliberately):

```ts
type RingSize = 'md' | 'lg' | 'xl';
interface ProgressRingProps {
  value: number;            // 0–100, clamped
  size?: RingSize;          // default 'md'
  themeHex?: string;        // progress stroke color; falls back to brand-500
  animate?: boolean;        // fill 0→value on mount
  children?: ReactNode;     // avatar sits in the hole
  className?: string;
}
```

Size table (outer px / stroke px / inner hole ø → Avatar that fits):

| size | outer | stroke | hole ø | Avatar inside |
|---|---|---|---|---|
| `md` | 76 | 6 | ~60 | `md` (48px) |
| `lg` | 104 | 7 | ~86 | `lg` (64px) |
| `xl` | 132 | 8 | ~112 | `xl` (96px) |

Rendering details (production):
- `<svg width=outer height=outer viewBox="0 0 outer outer">`, `aria-hidden` (the
  parent cell carries the accessible label).
- Track circle: `stroke` = `palette.well` (`#F1E7DC`), full circle.
- Progress circle: `stroke` = `themeHex ?? palette.brand500`, `stroke-linecap="round"`,
  `r` = `(outer-stroke)/2`, `strokeDasharray = C`, `strokeDashoffset = C*(1 - clamped/100)`.
- Rotated `-90deg` (transform on the `<svg>` or the progress circle) so fill starts at 12 o'clock.
- `children` centered via an absolutely-positioned `inset-0 grid place-items-center` layer.
- **Animation**: a `mounted` state (`useState(false)` → `true` in `useEffect`) flips
  `strokeDashoffset` from `C` (empty) to target, with
  `className="transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"`.
  When `animate` is false, render at target immediately. The global
  `prefers-reduced-motion` guard (`global.css:592`) already nukes the transition,
  so reduced-motion users get the final ring with zero extra code. We also guard
  with `useReducedMotion()` to skip the empty initial state (no flash).
- Pull hexes from `lib/theme` `palette` (no hard-coded strings), per the file's own rule.

This atom is generic enough to reuse later (e.g. bucket/vault rings) — hence its
own folder rather than burying it in `TeamSection`.

---

## 4. `TeamSectionMember` — additive fields

```ts
export interface TeamSectionMember {
  // ...existing fields unchanged...
  streak?: number;          // NEW, optional — flame shown only when >= 1
  hasLoggedToday?: boolean;  // NEW, optional — today-dot shown only when true
}
```

Both optional → backward compatible; the solo-fallback object in `Team.tsx` can
omit them. In `Team.tsx` `leaderboardEntries` map, add:

```ts
streak: entry.streak,
hasLoggedToday: entry.hasLoggedToday,
```

(`useLeaderboard` already returns both — no hook change.)

---

## 5. Layout — the podium

Keep the existing outer shell so the section still sits correctly on the page:
`<section className="rounded-xl bg-surface p-4 shadow-soft">`.

### 5.1 Header (kept, lightly polished)
- `Team` — `font-mono text-lg font-bold text-ink` (unchanged).
- Room progress: keep the `Room: NN%` label + `ProgressBar value={roomPct} size="md" animate`.
  Keep the existing two-column header layout (TeamSection.tsx:49–59) verbatim — not in scope to redesign.

### 5.2 Sort + rank
Reuse the existing comparator (TeamSection.tsx:37–42) → `% desc, saved desc, name`.
`visible = sorted.slice(0,3)`; `moreCount = sorted.length - visible.length`.
Rank = index in `sorted` (0→gold, 1→silver, 2→bronze).

### 5.3 Visual column order — 2 · 1 · 3
Render a **positions array** so silver is left, gold center, bronze right:

```
N>=3 → [silver, gold, bronze]
N==2 → [silver, gold]            (gold still raised; centered pair, no empty slot)
N==1 → [gold]  → SOLO HERO (see §7)
```

Container: `flex items-end justify-center gap-3 sm:gap-4 mt-5`.
- `items-end` so the smaller side rings bottom-align under the raised center.
- Gold cell lifted with `-translate-y-3` + larger ring → reads as the podium peak.
- DOM order = visual order [silver, gold, bronze]; each cell's `aria-label` states
  its rank explicitly, so screen-reader order is unambiguous despite visual reorder.

### 5.4 The "Spotlight" (immersive, cheap, static)
Behind the **gold** cell only, an absolutely-positioned soft glow — a mini static
aurora, no `framer-motion`, no perf cost:

```
<div aria-hidden className="pointer-events-none absolute left-1/2 top-2 -z-0
     h-28 w-28 -translate-x-1/2 rounded-full bg-brand-200/35 blur-2xl" />
```

Plus `shadow-haloOrange` on the gold ring wrapper. Together = "spotlight on the
champion" without the heavier `AuroraBackdrop` animation. The podium row is
`relative` so the glow positions against it; cells are `z-10`.

---

## 6. Per-member cell anatomy

Each cell is the same `<button>` contract as today (calls `onMemberClick(member)`),
so routing to `/members/:id` or `/profile` is unchanged.

```
<button> (cell)
  ├─ Crown        — gold cell only, IconCrown, floats above ring (-top-3)
  ├─ ProgressRing (size by rank)
  │    ├─ Avatar  (md gold→lg, sides→md)
  │    ├─ Streak chip  — top-right, only if streak >= 1  (IconFire + n)
  │    └─ Today dot    — bottom-right, only if hasLoggedToday  (accent-teal)
  ├─ Name   "You - NAME" / "NAME", truncate
  └─ Percent  big, tabular-nums, theme-tinted
```

Exact styling:

- **Cell button**:
  `group relative z-10 flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1.5 py-2
   transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2
   focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface`
  - Self cell adds a soft, non-harsh highlight: `bg-brand-50/70` (replaces today's
    heavy `border-2 border-brand-300` — softer, more premium).
  - `whileTap` via `motion.button` + `SPRING.press` (reuse `lib/motion`), with the
    reduced-motion `{ opacity: 0.85 }` fallback exactly like `PlayerProgressRow`.

- **Crown** (gold only): `IconCrown` (duotone, already imported set), `size={18}`,
  `text-accent-gold`, wrapped in `absolute -top-3 left-1/2 -translate-x-1/2 z-20`,
  with `animate-corner-pop` (existing keyframe) on mount. No crown in solo state.

- **ProgressRing**: `size` = `gold ? 'lg' : 'md'`; `themeHex = themeSwatches[member.themeColor]`
  (undefined → brand-500 fallback inside atom); `animate`. Avatar inside:
  `size = gold ? 'lg' : 'md'`, `imageUrl`, `fallback`.

- **Streak chip** (only `streak >= 1`): `absolute -top-1 -right-1 z-20` pill,
  `inline-flex items-center gap-0.5 rounded-pill bg-surface px-1.5 py-0.5 shadow-soft
   font-mono text-[10px] font-bold text-brand-800`, content `<IconFire size={11}/> {streak}`.
  Never renders for 0 — protects the feel-bad rule.

- **Today dot** (only `hasLoggedToday`): `absolute bottom-0.5 right-1 z-20 h-3 w-3
   rounded-full bg-accent-teal ring-2 ring-surface`. Positive-only; absence shows nothing.

- **Name**: `mt-1 block max-w-[5.5rem] truncate font-mono text-xs font-bold text-ink`,
  `title={displayName}`. `displayName = isYou ? "You - " + name : name` (matches current line 106).

- **Percent**: `font-mono font-bold tabular-nums`, size `gold ? 'text-base' : 'text-sm'`,
  color = member theme hex via `style={{ color: themeHex }}` (falls back to `brand-800`).
  Binds the number to its ring color. `Math.round(memberPct(member))`.

- **`sr-only`** span with `formatCurrency(member.saved)` saved (keeps the ฿ value
  accessible without cluttering the visual, same intent as current line 129).

- **Removed**: the trailing `IconUser` block (TeamSection.tsx:139–141) — the "weird
  element" — is gone.

### Decision to confirm (default chosen):
- **No silver/bronze numerals.** Rank is conveyed by position + size + crown only,
  to avoid rubbing in "2nd/3rd". *Default: off.* If you want explicit medal numbers,
  say so and I'll add subtle `①②③` chips (gold=`accent-gold`, silver=`ink-dim`,
  bronze=`brand-300`).

---

## 7. Solo state (N = 1) — "ME" hero

When `sorted.length === 1`, no podium — one centered hero so it never looks like
an empty 3-slot podium with ghosts:

```
<div className="mt-5 flex flex-col items-center gap-3">
  <ProgressRing size="xl" themeHex={hex} animate> <Avatar size="xl" .../> </ProgressRing>
  <p> You - NAME </p>                        (font-mono text-sm font-bold)
  <p> {pct}% </p>                            (text-2xl, theme-tinted, tabular-nums)
  {emptyBody && <p className="...text-ink-muted text-center">{emptyBody}</p>}
</div>
```

- Same soft spotlight glow behind the hero ring + `shadow-haloOrange`.
- **No crown** (solo = no competition; crown would feel hollow).
- Streak chip / today-dot still allowed (positive reinforcement for a solo saver).

---

## 8. "and N more" + View all (kept)

- `moreCount > 0` → keep the `and {moreCount} more` line (TeamSection.tsx:73–77),
  restyled to sit centered under the podium: `mt-4 text-center font-mono text-xs text-ink-muted`.
- Keep the `View all members` link button verbatim (TeamSection.tsx:83–93), incl.
  `IconArrowRight` and `onViewAll`.

---

## 9. Motion summary (all reduced-motion safe)

| Element | Animation | Guard |
|---|---|---|
| Rings | `stroke-dashoffset` 0→value, 700ms, staggered gold→sides | `useReducedMotion` + global guard |
| Crown | `animate-corner-pop` (existing) | global guard disables |
| Cell tap | `whileTap` `SPRING.press` | `{opacity:0.85}` fallback |
| Room bar | existing `ProgressBar animate` | unchanged |
| Spotlight glow | none (static) | n/a |

Stagger: apply `transition-delay`/framer `delay` `index * 80ms`, center first.
Everything degrades to instant-final under `prefers-reduced-motion`.

---

## 10. Accessibility checklist

- Each cell `<button>` `aria-label`:
  `"{rank===0 ? 'Leader, ' : ''}{name}{isYou ? ' (you)' : ''}, {pct}% of goal saved"`.
  (Add i18n copy keys if the section is localized — see §11.)
- Ring SVG + crown + badges `aria-hidden`; meaning lives on the button label + `sr-only` ฿.
- Focus-visible ring with offset on each cell (brand-500).
- Tap target ≥ 44px: `md` ring 76px + padding clears it; gold larger.
- `tabular-nums` on every `%` for stable digit width (consistent-numbers principle).
- Contrast: theme stroke/number colors (terracotta #F26B1A, slate #5C6B7A,
  teal #2EA079) all pass on `surface`/`well`; `well` track vs `surface` bg is a
  visible but soft contrast.
- Thai names: `font-mono` stack includes IBM Plex Sans Thai; `truncate` + `title` for overflow.

---

## 11. i18n

Reuse existing `copy.dashboard` keys where present (`youLabel`, `viewYourProfile`,
`viewMemberAria`, `membersInRoom`). If new strings are introduced (e.g. "Leader",
"day streak" for aria), add matching keys to **both** `src/i18n/locales/en.ts` and
`th.ts`. No hard-coded user-facing English. (Current `TeamSection` hard-codes
"Team"/"Room:"/"and N more"/"View all members" — I'll leave those as-is to keep
scope tight unless you want them localized in this pass.)

---

## 12. Edge cases

- **Ties** (same %/saved): comparator already deterministic (name tiebreak). Gold
  is whoever sorts first; acceptable. No "tied" badge in podium form.
- **No personal goal** (`target = 0`): `memberPct → 0`; ring empty but avatar/name
  render normally — dignified, no error state.
- **Missing avatar**: `Avatar` fallback initial (existing behavior).
- **100%**: ring is a full circle with rounded cap meeting at top — visually clean.
- **Long names**: truncate at `max-w-[5.5rem]`, full name in `title`.
- **2 members**: balanced gold+silver pair, gold raised; no empty bronze ghost.

---

## 13. Verification

Per project build/lint gotchas (clean checkout is red), verify scoped:
1. `npx tsc -b` — type-check the new atom + edited files.
2. `npx eslint src/components/ProgressRing/ProgressRing.tsx
   src/components/TeamSection/TeamSection.tsx src/pages/Team.tsx`.
3. Manual visual pass on the Team page at 360px width for N = 1, 2, 3, and ≥4
   (the "and N more" case), plus a reduced-motion run.
4. Confirm tapping each ring still routes (self → `/profile`, others → `/members/:id`).

---

## 14. Out of scope (explicitly not touching)

- `useLeaderboard`, RLS, realtime, money-state, `savings_logs`.
- `Avatar`, `ProgressBar` internals.
- Header layout / Room progress bar redesign.
- Any other dashboard section.
- Numeric medals (off by default — see §6 decision).

---

## 15. Open questions for approval

1. **Medal numerals** on silver/bronze — keep off (recommended) or add subtle chips?
2. **฿ saved visible** under the % for everyone, or keep `sr-only` (recommended, cleaner)?
3. Localize the hard-coded header strings ("Team", "Room:", "View all members")
   in this pass, or leave for a separate i18n cleanup?
