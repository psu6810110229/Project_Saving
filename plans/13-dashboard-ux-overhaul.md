# Task 13 — Dashboard UX Overhaul + Battle Nudge

## Goal
Make the dashboard tell the whole story in **15 seconds** of cold open, and turn every log entry into a "move in the game" by surfacing real-time competitive context as the user types or taps an amount.

Two distinct outcomes:
1. **Hero-first dashboard.** Open the app → see both players' progress + the gap, beautifully, immediately. No scrolling.
2. **Battle Nudge.** While composing a save, show live text like *"฿500 puts you ฿105 ahead of Art 🔥"* or *"฿200 more to overtake Art"*.

## Files Created / Edited
- `src/pages/Dashboard.tsx` — reorder layout: hero (battle) first, then log composer, then countdown/forecast, then activity feed.
- `src/components/BattleDashboard/BattleDashboard.tsx` — visual upgrade: bigger numbers, dual progress bars/arcs, gap badge, streak flame inline, leader crown indicator.
- `src/components/PlayerProgress/PlayerProgress.tsx` — refresh card style: large saved amount, % under target, streak flame, subtle leader highlight.
- `src/components/GapBadge/GapBadge.tsx` — restyle as the focal element (terracotta pill, animated when leader changes).
- `src/components/BattleNudge/BattleNudge.tsx` — **new**: pure presentational component, takes `pendingAmount` + battle stats, returns a one-line motivational string.
- `src/components/QuickLogBar/QuickLogBar.tsx` — accept `onAmountHover` (or pending-amount preview prop) so the nudge updates as user hovers/focuses a button.
- `src/components/ManualLogForm/ManualLogForm.tsx` — emit pending amount upward as user types so nudge updates live.
- `src/hooks/useBattleStats.ts` — already exposes both players' totals; add a derived `partnerStat` selector helper for the current user's perspective so consumers don't have to hunt through the array.
- `src/lib/battleNudge.ts` — **new**: pure function `computeNudge({ myTotal, partnerTotal, partnerName, pendingAmount }) → string` so it's unit-testable and free of JSX.

## Layout (mobile-first, top-to-bottom)
```
┌──────────────────────────────────────┐
│  Hey, Fan 👋          ⚙ Settings  ⏻  │
├──────────────────────────────────────┤
│            🔥 5-day streak           │
│                                      │
│   YOU                ART             │
│  ฿15,500            ฿13,000          │
│  ▓▓▓▓▓▓▓░░ 62%      ▓▓▓▓▓░░░ 52%    │
│                                      │
│       ╔═════════════════════╗        │
│       ║ You lead by ฿2,500  ║        │
│       ╚═════════════════════╝        │
├──────────────────────────────────────┤
│  Quick log: [+100] [+500] [+1000]    │
│  ─ or ─                              │
│  ฿ [_______]  Note (optional)        │
│  💪 ฿500 puts you ฿3,000 ahead of Art│ ← Battle Nudge
│              [ Save ]                 │
├──────────────────────────────────────┤
│  Trip in 540 days · ฿18 / day needed │
│  Forecast: on track to finish Oct 27 │
├──────────────────────────────────────┤
│  Recent activity                     │
│   ...                                │
└──────────────────────────────────────┘
```

Key reorder vs current:
- **Battle hero** moves to top (was below countdown).
- **Log composer** moves directly under hero (was below forecast).
- **Countdown + forecast** become secondary context.
- **Activity feed** stays last.

## Battle Nudge — copy logic

Pure function `computeNudge` takes:
```ts
interface NudgeInput {
  myTotal: number;
  partnerTotal: number;
  partnerName: string;
  pendingAmount: number; // 0 if user hasn't picked / typed yet
}
```

Decision tree:
| Condition (after pendingAmount applied) | Output (example) |
| :--- | :--- |
| pendingAmount === 0 && I lead | `You lead {partner} by ฿X — keep the heat 🔥` |
| pendingAmount === 0 && I trail | `Save ฿X to overtake {partner}` |
| pendingAmount === 0 && tied | `Dead heat — any save puts you in the lead` |
| pendingAmount > 0 && new total > partner | `฿{amt} puts you ฿X ahead of {partner} 🔥` |
| pendingAmount > 0 && new total < partner | `฿{amt} closes the gap — ฿X more to overtake` |
| pendingAmount > 0 && new total == partner | `฿{amt} ties the score — one more pushes you ahead` |

Edge cases:
- Partner has no goal / no profile yet → return `Save ฿{amt} — Art hasn't joined yet`.
- pendingAmount < 0 / NaN → treat as 0.

## State plumbing (pendingAmount)

- `Dashboard` owns `pendingAmount: number` state.
- `QuickLogBar` calls `onPreview(amount)` on `onMouseEnter` / `onTouchStart` of each button, and `onPreview(0)` on leave. On click it submits as before.
- `ManualLogForm` calls `onPreview(parsedAmount)` whenever the input changes.
- `BattleNudge` reads from this single state via prop.

This avoids global state and stays within the "no global state library" rule.

## Visual Rules
- Hero card: `bg-surface` with `rounded-2xl` and a soft `shadow-sm`. Subtle gradient is allowed via Tailwind utility classes only — no inline `style` except progress bar widths.
- Leader name + amount: `text-terracotta font-semibold text-2xl` for the leader; non-leader stays `text-ink`. Optional small crown emoji 👑 next to leader name.
- Streak flame: `🔥` + `text-terracotta` count, only shown when `streak >= 1`.
- Battle Nudge text: one line, `text-sm text-terracotta` when ahead, `text-sm text-ink-muted` when behind, with emoji at start or end. Animate opacity transition on text change (`transition-opacity`, no library).
- Mobile: stacked. `md:` and up: two columns side-by-side with gap badge centered between (existing layout).

## Acceptance Criteria
- [ ] On cold open, both players' saved + percent + leader gap are visible above the fold on a 375×667 viewport.
- [ ] Streak flame + count appear in hero when current user has a streak.
- [ ] Hovering / focusing a quick-log button updates the nudge live; mouse leave returns to the resting message.
- [ ] Typing into the manual amount field updates the nudge on every keystroke (debounced or raw — both fine since it's pure).
- [ ] Nudge text correctly reflects all 7 cases in the decision tree.
- [ ] After submitting a log, pending amount resets to 0 and the nudge shows the resting "lead by" / "trail by" message reflecting the new totals.
- [ ] No new libraries installed.
- [ ] No `any` types. All new component props typed via `interface`.
- [ ] `computeNudge` is pure (lib only), no React imports.
- [ ] Layout still responsive at `md:` and `lg:`.

## Edge Cases / Risks
- **Race between optimistic insert and nudge math.** Nudge reads from the same `logs` array that drives `useBattleStats`, so optimistic insert flows in automatically. Just make sure `pendingAmount` resets to 0 *after* the insert call resolves (or immediately on submit — pick the simpler path, which is "reset on submit click").
- **Hover doesn't exist on touch.** QuickLogBar must use `onTouchStart` / `onPointerDown` for mobile preview. If the touch event also fires click immediately, the nudge will flash — acceptable; clearer would be to only preview on long-press, but that's complexity we don't need yet.
- **Partner unjoined.** Existing `useBattleStats` already returns a placeholder; the nudge handles this branch explicitly.
- **Goal unset.** Percent shows `—`; bar empty; nudge still works on raw saved amounts.
- **Overshoot (>100%).** Bar clamps to 100%; numeric % keeps real value; nudge math is unaffected (it only compares totals).

## Out of Scope
- Animations beyond Tailwind `transition-*` utilities.
- Charts / sparklines of progress over time.
- Reordering settings or auth flows.
- Reaction system changes (already shipped in Task 10).
