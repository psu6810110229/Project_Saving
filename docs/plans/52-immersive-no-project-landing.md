# 52 — Immersive no-project landing screen

## Goal
Make the post-login "no active room" screen production-ready and immersive for
brand-new users. Most newcomers arrive **invited by a friend**, so **Join leads**.

Scope: the `ProjectSetup` view in `src/pages/AppLayout.tsx` (shown when a
logged-in user has no `activeRoom` and is not on a roomless route).

Presentational only — **no DB, RLS, routing, money-state, or stack changes.**

## Decisions (confirmed with user)
- Dominant first-time user: **invited** → Join card is the primary action.
- Richness: **Rich / Immersive**.
- "Explore demo" card: there is **no live demo room** (Japan 2027 is SQL seed
  content only). Replaced with a **static, non-interactive example visual**
  (mock vault + 2 sample members), clearly badged `ตัวอย่าง / Example`. Zero
  data/RLS work.

## Changes

### 1. Hide bottom nav on the setup screen
- `src/components/AppShell/AppShell.tsx`: add optional `showNav?: boolean`
  (default `true`); render `<BottomNav>` only when true.
- `src/pages/AppLayout.tsx`: compute
  `showNav = !( !loading && !error && !activeRoom && !roomlessAllowed )`
  — i.e. nav hidden only on the dedicated full-screen setup view; visible
  during loading/error, on roomless routes, and whenever a room exists.

### 2. Rebuild `ProjectSetup` default (create) view (top → bottom)
1. **Animated hero** — brand gradient banner (`from-brand-500`→`to-brand-800`)
   with a decorative `IconPlane`, avatar + greeting + GO-OUT label. Entrance
   via framer-motion; `useReducedMotion` → fade-only fallback.
2. **Greeting** — `สวัสดี {displayName} 👋` from `useProfile`; name-less
   fallback when profile/name absent.
3. **Tagline** — one immersive value line.
4. **Join card (primary)** — emphasised, switches to existing `JoinProjectFlow`.
5. **Create card (secondary)** — routes to `/create-room` (unchanged).
6. **How-it-works strip** — 3 steps: Join → Set goal → Save
   (`IconUserPlus` / `IconFlag` / `IconPiggyBank`).
7. **Static example visual** — new `ProjectSetupShowcase` component: mock vault
   card + 2 sample member rows, hardcoded numbers, badged `ตัวอย่าง`,
   `role="img"` + aria-label, non-interactive.
8. **Trust line** — `IconShield` + "no bank connection, you record it yourself".

Join mode (`mode === 'join'`) keeps its current back button + `JoinProjectFlow`.

### 3. New component
- `src/components/ProjectSetupShowcase/ProjectSetupShowcase.tsx` — self-contained,
  reuses `Avatar` + `ProgressBar` visual language with static sample data.

### 4. i18n
- New keys under `projectSetup` in **both** `th.ts` and `en.ts` (greeting,
  tagline, how-it-works labels, example badge/aria, trust line). Existing keys
  kept.

## Out of scope
- No demo-room / RLS / data work; no changes to `JoinProjectFlow`, create/join
  logic, routing, or money-state. No new libraries or design tokens.

## Verification
- `npm run build` + `npm run lint`.
- Manual: setup screen (nav hidden, Join primary, reduced-motion fallback);
  existing user with a room still sees nav + dashboard normally.
