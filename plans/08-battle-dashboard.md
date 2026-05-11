# Task 8 — Battle Dashboard (Fan vs Art)

## Goal
A head-to-head visual that makes the competition obvious at a glance: each user's saved amount, target, percentage, and the gap between them.

## Files Created / Edited
- `src/components/BattleDashboard/BattleDashboard.tsx` — outer card with two columns.
- `src/components/PlayerProgress/PlayerProgress.tsx` — single user's bar + numbers.
- `src/components/GapBadge/GapBadge.tsx` — "Fan leads by ฿2,500" pill.
- `src/hooks/useBattleStats.ts` — aggregates both users' totals + goals from realtime data.
- `src/pages/Dashboard.tsx` — host BattleDashboard above the log feed.

## Layout (mobile-first)
```
┌────────────────────────────┐
│ ← Fan                      │
│ ▓▓▓▓▓▓░░░░░░░░░  62%       │
│ ฿15,500 / ฿25,000          │
├────────────────────────────┤
│   Fan leads by ฿2,500      │  ← gap badge
├────────────────────────────┤
│ ← Art                      │
│ ▓▓▓▓▓░░░░░░░░░░  52%       │
│ ฿13,000 / ฿25,000          │
└────────────────────────────┘
```
On `md:` and up, two columns side-by-side with the gap badge centered between.

## Data
```ts
interface PlayerStat {
  userId: string;
  displayName: string;
  saved: number;
  target: number;
  percent: number;       // 0..100, clamped
  isLeader: boolean;
}
interface BattleStats {
  players: [PlayerStat, PlayerStat];
  gapAmount: number;     // |saved_a - saved_b|
  leaderName: string | null; // null if tied
}
```

## useBattleStats
- Inputs: realtime logs + both users' goals.
- Computes per-user `saved` (sum), `percent`, who leads, gap.
- Memoized so it only recomputes when logs/goals change.

## Visual Rules
- Bar fill: `bg-terracotta`. Track: `bg-surface`. Border: `border` token.
- Width: inline `style={{ width: `${percent}%` }}` — this is the documented allowed inline-style exception.
- Numbers via `formatCurrency`.
- Loading state: skeleton bars (animate-pulse).

## Edge Cases / Risks
- Only one user has signed up → second column shows "Waiting for partner…".
- Either user has no goal set → that side's percent shows "—" and bar is empty; gap badge still works on raw `saved`.
- Tied → badge reads "Tied — keep going!".
- `percent > 100` (overshot) → clamp bar to 100%, but show real percent in text.
- Currency symbol: pick THB (฿) and centralize in `formatCurrency`.

## Acceptance Criteria
- [ ] Both players' bars visible with correct % from real data.
- [ ] Gap badge updates in real time when either user logs.
- [ ] Leader switches when totals cross.
- [ ] Mobile layout stacks; tablet+ shows side-by-side.
- [ ] Handles missing goal / missing partner gracefully.
- [ ] Only allowed inline style is the bar `width`.
