# Task 15 — Bottom Tab Navigation + Profile Page

## Goal
Restructure the app from a single Dashboard into **three pages** with a fixed bottom tab bar (mobile-game pattern). The Profile page absorbs the existing Settings page.

| Tab | Route | Page name | Purpose |
| :-- | :-- | :-- | :-- |
| 1 | `/battle` | **Battle** | Leaderboard, log composer, battle nudge, recent activity, compare CTA |
| 2 | `/profile` | **Profile** | All of the current user's data + goal config + sign out |
| 3 | `/goal` | **Goal** | Rooms management (stub in this task; built in Task 18) |

`/battle` becomes the post-login default. The bottom bar is hidden on auth pages.

## Files Created
- `src/components/TabBar/TabBar.tsx` — fixed-bottom 3-button nav. Uses `NavLink` so the active tab gets terracotta tint.
- `src/pages/BattlePage.tsx` — rename of `Dashboard.tsx` (move file, update import path in `App.tsx`).
- `src/pages/ProfilePage.tsx` — replaces `Settings.tsx`. Holds: display name, goal config (target / start / end), personal stats, sign out.
- `src/pages/GoalPage.tsx` — minimal stub for this task: heading + "Rooms coming soon" placeholder card. Real content lands in Task 18.

## Files Edited
- `src/App.tsx` — routes: `/battle`, `/profile`, `/goal`. Auth route (`/login`, `/auth/callback`) renders without TabBar; protected routes render *with* TabBar. Default redirect when authed → `/battle`. Old `/dashboard` and `/settings` redirect to `/battle` and `/profile` respectively.
- `src/components/AuthProvider/AuthProvider.tsx` (or wherever the protected layout lives) — wrap protected pages with a layout component that mounts `<TabBar>` and adds `pb-20` to leave room for the bar.

## Files Deleted
- `src/pages/Dashboard.tsx` — content moves to `BattlePage.tsx` (rename).
- `src/pages/Settings.tsx` — content moves into `ProfilePage.tsx`.

## Visual Spec — TabBar

```
┌───────────────────────────────────────┐
│                                       │
│                                       │
│            (page content)             │
│                                       │
│                                       │
├───────────────────────────────────────┤
│   ⚔            👤            🎯       │
│  Battle       Profile        Goal     │
└───────────────────────────────────────┘
```

- Fixed: `fixed bottom-0 left-0 right-0 bg-canvas border-t border-border z-40`.
- Inner: `max-w-sm mx-auto flex justify-around py-2`.
- Each tab: vertical stack — emoji icon (`text-2xl`) + label (`text-xs font-medium`).
- Active tab: `text-terracotta`. Inactive: `text-ink-muted`. Use `NavLink` className callback so styling responds to route.
- Safe-area inset on iOS: `pb-[env(safe-area-inset-bottom)]` via Tailwind arbitrary value.
- Page content gets `pb-24` to clear the bar on every protected page.

## ProfilePage layout (mobile)

```
┌──────────────────────────────────────┐
│  Hey, Fan 👋                          │
├──────────────────────────────────────┤
│  Display name                         │
│  [ Fan                ]   [ Save ]    │
├──────────────────────────────────────┤
│  YOUR GOAL                            │
│  Target  ฿50,000                     │
│  Start   2025-01-01                  │
│  End     2027-11-01                  │
│  [ Edit goal ]                        │
├──────────────────────────────────────┤
│  YOUR STATS                           │
│  Total saved        ฿20,500           │
│  Current streak     🔥 5 days         │
│  Longest streak     🔥 12 days        │
│  Biggest single     ฿2,000            │
│  Total logs         27                │
├──────────────────────────────────────┤
│  [ Sign out ]                         │
└──────────────────────────────────────┘
```

- Stats are pure derived from `logs` (use existing `useLogs` + new helpers in `src/lib/userStats.ts`).
- Goal editor: reuse existing form logic from old Settings; collapsed by default behind an "Edit goal" button to keep the page clean.
- Display name editor is in-place: input + Save button. On Save, `update profiles set display_name = …`.

## userStats.ts helpers (pure)
```ts
export function totalSaved(logs: SavingsLog[]): number;
export function biggestSave(logs: SavingsLog[]): number;
export function totalLogCount(logs: SavingsLog[]): number;
export function longestStreak(logs: SavingsLog[]): number; // uses date keys + walks
export function currentStreak(logs: SavingsLog[], todayKey: string): number; // already exists in lib/streak — reuse
```

## Routing rules
- Unauth + any route → `/login`.
- Authed + `/login` → redirect to `/battle`.
- Authed + `/dashboard` → 301 to `/battle` (back-compat for browser bookmarks).
- Authed + `/settings` → 301 to `/profile`.
- Unknown route → `/battle`.

## Acceptance Criteria
- [ ] Tab bar visible on `/battle`, `/profile`, `/goal`. Hidden on `/login` and `/auth/callback`.
- [ ] Tapping a tab swaps content without remounting the bar (route-based, single layout).
- [ ] Active tab visually distinct (terracotta).
- [ ] Bottom safe-area inset respected on iOS notch devices.
- [ ] `BattlePage` renders the same content as the old Dashboard (no functional regression — leaderboard, log composer, nudge, activity all work).
- [ ] `ProfilePage` shows the user's display-name editor, goal editor (collapsible), 5 stats, sign-out button.
- [ ] `GoalPage` shows a placeholder card; no broken state.
- [ ] No console errors. `npx tsc --noEmit` clean. `npm run build` clean.

## Edge Cases / Risks
- **Layout shift when bar appears**: every protected page must include `pb-24` so the last content isn't hidden behind the bar.
- **Active state on nested route**: `NavLink` with `end` prop on each tab to prevent matching unintended sub-routes.
- **Settings consumers**: any link to `/settings` must update; sweep with grep before deleting the page.
- **Stats performance**: `longestStreak` walks all logs — fine at <500 logs; document the limit.
- **Display name save failure**: show inline error, don't optimistic-update profile until response succeeds.

## Out of Scope
- Real Goal/Rooms content (Task 18).
- Charts on Profile (could add later).
- Editing email or auth details.
- Reordering tabs.
