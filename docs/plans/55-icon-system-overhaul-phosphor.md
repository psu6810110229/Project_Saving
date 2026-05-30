# 55 — App-wide Icon Overhaul → Phosphor (duotone) + per-category color system

## Context

The app currently uses ~50 hand-drawn **single-color stroke** SVGs in
`src/components/Icon/Icon.tsx`, recolored via `currentColor`. We want a more
professional, systematic icon language matching the user's references:
**filled / two-tone (duotone) icons** (fork+knife in blue, bus in orange).

Decisions confirmed with the user:

- **Scope:** whole app. Very small / utility icons may stay **outline (line)** —
  they don't have to be filled.
- **Method:** adopt **Phosphor Icons** (`@phosphor-icons/react`), which ships
  `regular` (line) and `duotone` weights out of the box.
- **Category icons:** each bucket category gets its **own hue** (flight=sky,
  transport=orange, food=blue, …) instead of today's single brand-orange tone.

**Key architectural lever:** every icon is consumed through the central wrapper
`Icon.tsx` (exports `IconFork`, `IconPlane`, … with a `{ size, className }` +
`currentColor` signature). All ~80 files / 844 call sites import from there. So
we **reimplement the bodies of those wrappers as Phosphor icons and keep their
names + signature unchanged** — call sites stay untouched. This is the
low-risk, systematic path.

Outcome: one consistent Phosphor-based icon set, duotone for feature/category/
status/nav icons, line weight for tiny utility icons, and a token-driven
per-category color palette.

---

## Repo orientation (for an agent starting cold)

- **Project:** GO-OUT — mobile-first shared savings tracker. Stack: React 19 +
  TypeScript + Vite + React Router + Tailwind CSS 3 + Supabase + PWA
  (vite-plugin-pwa) + Vercel. Windows dev box, **PowerShell** shell.
- **Layout:** `src/components/ComponentName/ComponentName.tsx` (reusable UI),
  `src/pages/` (route screens), `src/hooks/`, `src/lib/` (helpers + Supabase
  client), `src/types/index.ts` (shared types incl. `BucketCategory`),
  `tailwind.config.js` (design tokens), `docs/plans/` (this file).
- **Scripts:** `npm run dev`, `npm run build` (= `tsc -b && vite build`),
  `npm run lint` (= `eslint .`).
- **Build/lint caveat:** a clean checkout's `npm run build`/`npm run lint` are
  already red (PWA precache config + a stray non-shipping `temp.tsx` at repo
  root, plus `fix_all.cjs` / `fix_safe.cjs` / `clean.cjs` helper scripts). Do
  **not** chase those. Verify your work with `npx tsc -b` and **scoped**
  `npx eslint <changed files>` instead. Treat `temp.tsx` and the `*.cjs`
  scripts as out of scope — do not edit them even though they import from
  `Icon.tsx`.

## Project conventions to respect (from CLAUDE.md)

- Do only what's in this plan; no unrelated refactors, no new top-level folders.
- Functional components only; explicit prop interfaces; **no `any`** (use exact
  types/unions). Tailwind utilities first — no CSS Modules, avoid inline
  `style={}` except for genuinely dynamic values. Respect `prefers-reduced-motion`.
- Only the icon **visual style** changes — do not touch money-state logic,
  Supabase, RLS, or component behavior. This is a presentation-layer task.
- Commit between slices (e.g. `feat: adopt Phosphor icon set`,
  `feat: per-category icon colors`). Ask before `git push`. Current working
  branch: `fix/create-room-wizard-bugfixes` (confirm before branching).

## Current state of `src/components/Icon/Icon.tsx` (what you're replacing)

- One file exporting ~50 functional components, each an inline `<svg>` with:
  `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`,
  `strokeWidth={1.75}`, `strokeLinecap/Linejoin="round"`, plus a shared
  `className="icon-stroke-crisp"` (defined in `src/styles/global.css`).
- Shared signature: `interface IconProps extends SVGProps<SVGSVGElement> { size?: number }`,
  default `size = 20`. A `svgProps()` helper spreads width/height/viewBox/etc.
- Call sites almost always use only `size` and/or `className`
  (e.g. `<IconGrid size={22} />`, `<IconBell className="text-ink-muted" />`).
  No call site passes `strokeWidth`/`stroke`/`fill` to an `Icon*` component, so
  dropping those props is safe.
- **Full export inventory (all must be preserved by name):**
  `IconPlane, IconBed, IconFork, IconTicket, IconHome, IconBriefcase,
  IconSmartphone, IconHeart, IconPiggyBank, IconRocket, IconPalette, IconBell,
  IconGear, IconChevronDown, IconChevronLeft, IconChevronRight, IconArrowLeft,
  IconArrowRight, IconSwap, IconPlus, IconCheck, IconX, IconCalendar, IconFlag,
  IconUserPlus, IconTrash, IconEdit, IconQrCode, IconTrendingUp,
  IconMoreVertical, IconGrid, IconLayers, IconVault, IconActivity, IconUser,
  IconUsers, IconSlip, IconClock, IconClockAlert, IconWarning, IconCheckCircle,
  IconFire, IconCrown, IconCalendarClock, IconArrowUpRight, IconShield,
  IconImage, IconCamera, IconZoomIn, IconZoomOut`.
- Consumed across ~80 files / 844 occurrences. Notable consumers:
  `BottomNav` (nav icons `IconGrid/IconUsers/IconUser` at size 22),
  `IconButton` (circular control button — children are icons),
  `BellIconButton`, `PageHeader`, `Modal`, every bucket/saving-plan component,
  and the `*Preview` pages (`AtomsPreview`, `MoleculesPreview`,
  `OrganismsPreview`) which render the icon set for visual QA.

## Phosphor React API notes (`@phosphor-icons/react`)

- Each icon is a component: `<ForkKnife size={20} weight="duotone" color="currentColor" className="..." />`.
- `color` defaults to `currentColor`, so existing `text-*` Tailwind utilities
  keep working for recoloring — keep relying on that, don't pass `color`.
- `weight`: `'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'`. We use
  `duotone` (two-tone: a solid primary path + a secondary path at ~0.2 opacity,
  both in `currentColor`) and `regular` (line). Duotone two-tone effect comes
  for free from one `currentColor` — **no second color prop needed**.
- `size` accepts number (px) or string. Forwards `className`/`style` to the
  `<svg>`. Supports `mirrored` and `alt` (a11y label) if needed.
- Import **named** icons only (`import { ForkKnife, Bus } from '@phosphor-icons/react'`)
  for tree-shaking; never `import * as`.
- The library exports a `type Icon` (alias of the icon component type) usable to
  type the factory's parameter.

## Reference target (user-supplied)

The user attached two reference icons defining the desired look: a **fork+knife
in two shades of blue** (food category) and a **bus in two shades of orange**
(transport category) — i.e. Phosphor `duotone` weight, one hue per category.

---

## Slice 0 — Install Phosphor + reimplement `Icon.tsx` (foundation)

1. `npm install @phosphor-icons/react` (user-approved). Pin to current major.
2. Rewrite the **internals** of `src/components/Icon/Icon.tsx`, preserving:
   - every existing export name (`IconPlane`, `IconBed`, `IconFork`, … all ~50),
   - the `IconProps { size?: number } & SVGProps` shape (so existing
     `size`/`className` call sites compile),
   - `currentColor` recoloring (Phosphor inherits `currentColor` by default).

   Implement via a small factory:
   ```ts
   import { type Icon as PhosphorIcon, ForkKnife, /* … */ } from '@phosphor-icons/react';
   type Weight = 'regular' | 'duotone' | 'fill';
   interface IconProps { size?: number; weight?: Weight; className?: string; style?: CSSProperties; }
   const make = (P: PhosphorIcon, dflt: Weight) =>
     ({ size = 20, weight, className, ...rest }: IconProps) =>
       <P size={size} weight={weight ?? dflt} className={className} {...rest} aria-hidden />;
   export const IconFork = make(ForkKnife, 'duotone');
   ```
   - Drop the old `strokeWidth`/`icon-stroke-crisp` plumbing (no Icon call site
     passes `strokeWidth`; the `strokeWidth=`/`stroke=` hits found are in
     chart/spinner components — `SavingsHeatmap`, `MomentumChart`,
     `ComparisonTrendChart`, `SavingRaceChart`, `PullToRefresh`, etc. — which
     draw their own SVGs and are **out of scope**).

3. **Weight policy** (per-icon default in the factory):
   - **duotone** — feature / status / nav / category-ish icons:
     `IconPlane, IconBed, IconFork, IconTicket, IconHome, IconBriefcase,
     IconSmartphone, IconHeart, IconPiggyBank, IconRocket, IconPalette,
     IconBell, IconGear, IconCalendar, IconCalendarClock, IconFlag, IconQrCode,
     IconTrendingUp, IconGrid, IconLayers, IconVault, IconActivity, IconUser,
     IconUsers, IconUserPlus, IconSlip, IconClock, IconClockAlert, IconWarning,
     IconCheckCircle, IconFire, IconCrown, IconShield, IconImage, IconCamera`.
   - **regular (outline)** — tiny / inline / control icons (user-approved
     "small may stay line"): `IconChevronDown/Left/Right, IconArrowLeft/Right,
     IconArrowUpRight, IconSwap, IconPlus, IconCheck, IconX, IconTrash,
     IconEdit, IconMoreVertical, IconZoomIn, IconZoomOut`.
   - Any icon can be overridden at a call site via the new optional `weight`
     prop without code churn.

4. **Phosphor name mapping** (finalize during impl; representative):
   `IconPlane→AirplaneTilt, IconBed→Bed, IconFork→ForkKnife, IconTicket→Ticket,
   IconHome→House, IconBriefcase→Briefcase, IconSmartphone→DeviceMobile,
   IconPiggyBank→PiggyBank, IconRocket→RocketLaunch, IconGear→Gear,
   IconChevron*→Caret*, IconSwap→ArrowsLeftRight, IconEdit→PencilSimple,
   IconMoreVertical→DotsThreeVertical, IconGrid→SquaresFour, IconLayers→Stack,
   IconActivity→Pulse, IconSlip→Receipt, IconTrendingUp→TrendUp,
   IconShield→ShieldCheck, IconZoomIn/Out→MagnifyingGlassPlus/Minus,
   IconClockAlert→ClockCountdown, IconCalendarClock→CalendarDots,
   IconFire→Fire, IconCrown→Crown, IconWarning→Warning, IconVault→Vault`.
   (`transport` bucket → **`Bus`** to match the reference screenshot; see Slice 1.)

5. Build + open the preview pages (`AtomsPreview`, `MoleculesPreview`,
   `OrganismsPreview`) to eyeball the new set. **Commit.**

## Slice 1 — Per-category color system + category icons

1. Add a token-driven palette. In `tailwind.config.js` add a `cat` color group
   with a main + soft pair per category (literal class names → JIT-safe):
   ```
   cat: {
     flight:'#2D9CDB', 'flight-soft':'#E6F2FB',
     stay:'#8B5CF6',   'stay-soft':'#EEE8FD',
     transport:'#F26B1A','transport-soft':'#FDF0E6',   // orange (ref)
     food:'#2F6BF2',   'food-soft':'#E8EEFD',          // blue (ref)
     activities:'#EC4899','activities-soft':'#FCE7F1',
     shopping:'#DB2777','shopping-soft':'#FBE4F0',
     buffer:'#0EA5A0',  'buffer-soft':'#E0F5F4',
     home:'#C99B3E',    'home-soft':'#F7EFDD',
     other:'#5C6B7A',   'other-soft':'#EAEDF0',
   }
   ```
   (Hues tunable; chosen to match the references and stay readable on the warm
   cream canvas.)

2. New helper `src/lib/categoryVisuals.ts`: map each `BucketCategory` →
   `{ iconClass: 'text-cat-flight', bubbleClass: 'bg-cat-flight-soft' }`,
   reusing `BUCKET_CATEGORY_ORDER`/`normalizeBucketCategory` from
   `src/lib/bucketCategories.ts`. Keep visual concerns out of the existing meta.

3. Update `src/components/BucketCategoryIcon/BucketCategoryIcon.tsx`:
   - point `transport → Bus`-backed icon, `food → ForkKnife`, etc. (via the
     `Icon.tsx` exports, duotone),
   - apply the per-category `iconClass` so each renders in its own hue,
   - keep the `category`/`size` props API unchanged.

4. Update `src/components/IconBubble/IconBubble.tsx`: add an optional
   `category?: BucketCategory` (or a `colorClass` prop) that, when present,
   drives `bubbleClass` from `categoryVisuals` while leaving the existing
   `peach`/`solid`/`muted` tones intact for non-category uses. Audit the 45
   `IconBubble`/`BucketCategoryIcon` call sites and switch the bucket-category
   ones to the new colored tone; leave generic header bubbles on `peach`/`solid`.

5. Build + verify category icons render in distinct hues on Dashboard bucket
   grid, BucketRow, Bucket detail header, MomentumPurposePicker. **Commit.**

## Slice 2 — Sweep, asset cleanup, polish

1. Decide the 4 static SVG assets in `CreateRoomWizard` (`celebrate, lightbulb,
   calendar, coins`): replace `<img src=…>` usages in `StepSummary.tsx` /
   `StepTimeline.tsx` with matching Phosphor icons (`Confetti, Lightbulb,
   CalendarBlank, Coins`) for one consistent language, or keep if they read as
   illustrations. Default: **replace** for consistency.
2. Remove now-dead `icon-stroke-crisp` CSS in `src/styles/global.css` if no
   longer referenced after Slice 0.
3. Grep for any remaining raw `<svg>` that is semantically an icon (not a
   chart) and migrate; leave charts/spinners alone.
4. Final `npm run build`; run scoped `eslint` on changed files. Verify the three
   preview pages + a quick pass of Dashboard / Add Money / Manage Project /
   Profile / Saving Plan. **Commit.**

---

## Risk notes
- Lowest-risk lever is keeping `Icon.tsx` export names/signature — no call-site
  churn. The main work is the name mapping + weight policy.
- `npm run build`/`lint` are known-red on a clean checkout (PWA precache, stray
  `temp.tsx`); verify with `tsc -b` + scoped eslint instead (per project notes).
  `temp.tsx`, `fix_all.cjs`, etc. are stray/non-shipping and out of scope.
- Bundle size: Phosphor is tree-shakeable when importing named icons (as above);
  avoid `import * as`.

## Verification
- `npx tsc -b` clean (type-level proof the wrapper signature still satisfies all
  844 call sites).
- `npx eslint <changed files>` clean.
- `npm run dev` → visually confirm on `/preview` atoms/molecules/organisms +
  Dashboard bucket grid that: duotone feature icons render two-tone, tiny
  utility icons stay line, and each category shows its own hue.

## Slice tracking
- [x] Slice 0 — Phosphor install + `Icon.tsx` reimplementation
- [ ] Slice 1 — per-category color palette + category icons/bubble
- [ ] Slice 2 — asset cleanup + sweep + final build/lint
