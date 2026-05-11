# Task 14 — Leaderboard Redesign (Game-Feel, N-Player Ready)

## Goal
Replace the 2-player VS hero with a **vertical ranked leaderboard** that looks great with 2 players today and scales naturally to 5. Game-app feel: bold typography, chunky panels, prominent numbers, animated bars, rank badges. Ranks computed by **% of personal goal**, so unequal targets stay fair.

This task supersedes the visual decisions in Task 13 — the layout reorder and Battle Nudge stay; the BattleDashboard / PlayerProgress / GapBadge components are retired and replaced.

## Files Created
- `src/components/Leaderboard/Leaderboard.tsx` — vertical ranked list (replaces BattleDashboard).
- `src/components/PlayerRow/PlayerRow.tsx` — single ranked card with avatar, name, amount, bar, streak, rank badge.
- `src/components/RankBadge/RankBadge.tsx` — circular rank pill (`#1`, `#2`, …) with crown 👑 for #1.
- `src/components/Avatar/Avatar.tsx` — colored circle with the player's initial. Color seeded from userId so each player gets a stable color.
- `src/hooks/useLeaderboard.ts` — replaces `useBattleStats`. Returns ranked array of players, sorted by `percent` desc.

## Files Edited
- `src/lib/battleNudge.ts` — rewrite for N players. New input takes the full leaderboard + my userId; output picks the right person to compare against.
- `src/components/BattleNudge/BattleNudge.tsx` — accepts `leaderboard` + `myUserId` + `pendingAmount`; renders the nudge.
- `src/components/QuickLogBar/QuickLogBar.tsx` — restyle for game-feel: bolder buttons with shadow, terracotta hover state, larger tap target.
- `src/components/ManualLogForm/ManualLogForm.tsx` — restyle: bolder input border, larger submit button, more breathing room.
- `src/pages/Dashboard.tsx` — swap `<BattleDashboard>` for `<Leaderboard>`; pass leaderboard data into the BattleNudge.

## Files Deleted
- `src/components/BattleDashboard/` — replaced by Leaderboard.
- `src/components/PlayerProgress/` — replaced by PlayerRow.
- `src/components/GapBadge/` — gap shown inline on the leaderboard row instead.
- `src/hooks/useBattleStats.ts` — replaced by `useLeaderboard`.

## Data Shapes

```ts
// useLeaderboard.ts
export interface LeaderboardEntry {
  rank: number;              // 1-based, 1 = leader
  userId: string;
  displayName: string;
  saved: number;
  target: number | null;
  percent: number;           // 0..100, clamped for display; raw value used for sort
  streak: number;
  hasLoggedToday: boolean;
  isYou: boolean;            // userId === current auth user
}

export interface LeaderboardState {
  entries: LeaderboardEntry[];
  loading: boolean;
}
```

Sort rule: `percent` descending. Players without a goal sort to the bottom. Ties (same percent) break by `saved` descending, then by `displayName` asc to stay deterministic.

## Visual Spec

### One PlayerRow (mobile, ~375px)
```
┌──────────────────────────────────────┐
│  ⓵  ╭─╮                          🔥5 │
│     │F│  Fan                  👑     │
│     ╰─╯                              │
│         ฿20,500                       │
│         ████████████░░░░  41%        │
└──────────────────────────────────────┘
```

- **Card**: `rounded-2xl`, `bg-surface`, soft `shadow-sm`. Your row gets `bg-terracotta/10` + `border-2 border-terracotta`. Other rows get `border border-border`.
- **Rank badge** (top-left of card): 32px circle. `#1` → terracotta bg + white text. `#2+` → `bg-ink/10` + `text-ink`. Crown 👑 inline next to rank for #1.
- **Avatar**: 40px circle, color seeded from userId hash, initial in white `font-bold`.
- **Name**: `text-base font-semibold`. Leader name `text-terracotta`.
- **Saved amount**: `text-3xl font-bold tracking-tight`. Leader → `text-terracotta`. Others → `text-ink`.
- **Progress bar**: `h-3 rounded-full bg-border`. Fill `bg-terracotta` (your row) / `bg-ink/40` (others). `transition-all duration-700`.
- **Percent text**: `text-xs text-ink-muted`. If no goal: `—`.
- **Streak chip** (top-right): existing `<StreakFlame>`. Visible only when `streak >= 1`.

Spacing: `gap-3` between rows. Padding inside row: `p-4`.

### Leaderboard container
- `flex flex-col gap-3`.
- Header: small label `LEADERBOARD` (`text-xs uppercase tracking-widest text-ink-muted`) + count `(2 players)` on the right.
- Skeleton state: 2 ghost rows with `animate-pulse`.
- Empty state (only 1 profile): one row + a dashed "Waiting for partner…" placeholder card below.

## Battle Nudge — N-player rewrite

```ts
interface NudgeInput {
  leaderboard: LeaderboardEntry[];
  myUserId: string;
  pendingAmount: number;
}

export function computeNudge(input: NudgeInput): string;
```

Logic:

1. Find `me = leaderboard.find(e => e.userId === myUserId)`.
2. Compute `myProjectedSaved = me.saved + max(0, pendingAmount)` and `myProjectedPercent = me.target ? myProjectedSaved / me.target : 0`.
3. Build a *projected* sorted list (replace me's percent with projected, re-sort).
4. Find new rank.

Output cases:

| Situation | Copy (example) |
| :--- | :--- |
| Only 1 player total | `Invite a friend to start the battle` |
| me has no goal | `Set a goal in Settings to join the leaderboard` |
| pendingAmount = 0 && I'm rank 1 | `You lead {next} by {Δ%} — keep the heat 🔥` |
| pendingAmount = 0 && I'm rank > 1 | `Save {ΔBaht} to overtake {above}` |
| pendingAmount > 0 && new rank improved | `฿{amt} jumps you to #{newRank} 🔥` |
| pendingAmount > 0 && new rank same & I'm #1 | `฿{amt} extends your lead — keep stacking 🔥` |
| pendingAmount > 0 && new rank same & not #1 | `฿{amt} closes the gap — {ΔBaht} more to overtake {above}` |
| pendingAmount > 0 && would tie someone | `฿{amt} ties #{tiedRank} — one more pushes you above` |

`{ΔBaht}` = `Math.ceil((above.percent / 100 * me.target) - me.saved)` rounded up to the nearest 1 baht. Computed against percent (since we rank by %), so the math respects unequal targets.

`{Δ%}` shown to 1 decimal: `formatPercent(diff)`.

## Avatar color logic
Pure function `colorForUserId(userId: string): string` returning a Tailwind class from a fixed palette:
```ts
const PALETTE = ['bg-terracotta', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500'];
// hash userId → index into PALETTE
```
Stays inside Tailwind utilities — no inline styles. Palette stays small so colors are recognizable.

## QuickLogBar restyle (game-feel)
- Each button: `py-4 text-base font-bold`, `shadow-sm hover:shadow-md`, `bg-surface → bg-terracotta` on hover with white text. Border becomes terracotta on hover. Active state: `scale-95 transition-transform`.
- Container gap: `gap-3` (was `gap-2`).
- Label: keep "Quick log" but bolder.

## ManualLogForm restyle
- Input: `text-base py-4` (was `text-sm py-3`), border weight `border-2 focus:border-terracotta`.
- Submit button: `text-base font-bold py-4 px-6`, `shadow-sm` for lift.
- Keep label + note + char counter unchanged.

## Acceptance Criteria
- [ ] Leaderboard renders ranked rows for all profiles (currently 2; tested up to 5 visually with mock data).
- [ ] Each row shows rank, avatar, name, saved amount, progress bar, % of goal, streak.
- [ ] Leader row visibly highlighted (crown + terracotta accents on numbers).
- [ ] Your row visibly highlighted (terracotta tint + thicker border) regardless of rank.
- [ ] Sort is by percent desc; ties broken by saved desc then name.
- [ ] Players with no goal land at the bottom and show `—` for percent.
- [ ] BattleNudge live-updates on hover/keystroke and covers all 8 decision cases.
- [ ] Quick log buttons feel "game-y": bigger, bolder, hover/active states animate.
- [ ] Mobile layout (375px) shows the leaderboard above the fold with no horizontal scroll.
- [ ] No `any` types; all components have typed `interface` props.
- [ ] Old files (`BattleDashboard/`, `PlayerProgress/`, `GapBadge/`, `useBattleStats.ts`) deleted, no broken imports.

## Edge Cases / Risks
- **Single profile** (you only): leaderboard renders 1 row + dashed placeholder; nudge says "invite a friend".
- **Profile with no goal**: ranks last; nudge prompts user to set a goal if it's *me*.
- **Tied percent**: deterministic break (saved desc → name asc) so position doesn't flicker on rerender.
- **Leader changes**: rerender reorders rows; CSS `transition-all` makes it smooth without external libs.
- **Avatar palette collision**: with 5 colors and ~5 players, collisions possible but tolerable; no need for true uniqueness.
- **Rank badge wrapping at 10+ players**: out of scope. Plan caps at 5.
- **`useLeaderboard` rename**: any place still importing `useBattleStats` will TS-error — search-and-replace at the end of implementation, then run `npx tsc --noEmit` before committing.

## Out of Scope
- Groups / savings circles model (Path B from the discussion). Single global leaderboard for now.
- Animations beyond Tailwind `transition-*` utilities.
- Dark mode.
- Reaction or feed redesign.

## Implementation Order
1. `useLeaderboard` hook (replaces useBattleStats).
2. `Avatar` component (small, isolated).
3. `RankBadge` component.
4. `PlayerRow` component (depends on Avatar + RankBadge).
5. `Leaderboard` container.
6. Rewrite `battleNudge.ts` for N-player.
7. Update `BattleNudge.tsx` to consume new input.
8. Restyle `QuickLogBar` + `ManualLogForm`.
9. Wire it all into `Dashboard.tsx`; remove dead imports.
10. Delete retired files.
11. `npx tsc --noEmit` + `npm run build` clean.
12. Commit & push.
