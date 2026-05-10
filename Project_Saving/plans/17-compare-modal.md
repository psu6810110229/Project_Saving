# Task 17 — Compare Modal (Player vs Player)

## Goal
On the Battle page, a **Compare** CTA opens a modal where the user picks another player and sees a side-by-side comparison: cumulative-savings line chart, start/current/predicted-end progress, both players' streaks, biggest single saves, log counts. Defaults to the leader if anyone is ahead of you, or the first other player otherwise.

## Files Created
- `src/components/CompareButton/CompareButton.tsx` — small CTA button that opens the popup. Lives near the leaderboard.
- `src/components/ComparePopup/ComparePopup.tsx` — modal body. Header lets user switch the comparison target via `<select>` (only "you vs them", not arbitrary pairs).
- `src/components/SavingsChart/SavingsChart.tsx` — pure SVG line chart, no library. Two lines (you + them), shared X axis (date), Y axis (cumulative ฿). No tooltip in v1; show min/max labels at endpoints.
- `src/lib/comparisonStats.ts` — pure helpers operating on `SavingsLog[]`:
  - `cumulativeSeries(logs, fromDate, toDate): { date: string; total: number }[]` — daily cumulative totals, filling in flat days.
  - `compareSummary(myLogs, theirLogs, today): ComparisonSummary` — bundle of: started_at (earliest log), saved, currentStreak, longestStreak, biggestSave, logCount, predictedEnd (reuses lib/forecast logic).

## Files Edited
- `src/pages/BattlePage.tsx` — render `<CompareButton>` near the top of the leaderboard section (small, inline; not a giant CTA).
- `src/components/Modal/Modal.tsx` (from Task 16) — reused; nothing new.

## Visual Spec — CompareButton

A pill button: `🔀 Compare with…` — `text-xs bg-surface border border-border px-3 py-1.5 rounded-full text-ink-muted hover:text-terracotta hover:border-terracotta`. Sits right-aligned above or below the leaderboard.

## Visual Spec — ComparePopup

```
┌───────────────────────────────────────┐
│ You  vs  [ Art ▼ ]               ✕    │
├───────────────────────────────────────┤
│            [ line chart ]             │
│                                        │
│   ─── You      ─── Art                 │
├───────────────────────────────────────┤
│           You         Art              │
│ Saved   ฿20,500    ฿19,800             │
│ Started Jan 12     Jan 03              │
│ Streak  🔥 5        🔥 3               │
│ Longest 🔥 12       🔥 8               │
│ Biggest ฿2,000     ฿1,500              │
│ Logs    27          27                 │
│ Predict Oct '27    Dec '27             │
└───────────────────────────────────────┘
```

- Compare target dropdown: every other player on the leaderboard.
- Stats table: 2-column grid (`grid-cols-2 gap-x-6 gap-y-2`), header row has small "You / {them}" labels in `text-ink-muted`. Numbers in `font-semibold`. Winner of each row gets `text-terracotta`.
- Chart sized: `w-full h-48`. SVG `viewBox`'d so it scales with container.

## SavingsChart spec (no library)

Inputs:
```ts
interface SavingsChartProps {
  myName: string;
  theirName: string;
  mySeries: { date: string; total: number }[];
  theirSeries: { date: string; total: number }[];
}
```

Implementation:
- Combine both series' date ranges → unified X axis. Both arrays must be aligned to the same dates (`comparisonStats.cumulativeSeries` ensures this by filling forward).
- Compute `xMax = series.length - 1` (index-based) and `yMax = max of all totals across both series`. Pad `yMax * 1.1` so the line doesn't touch the top.
- Render two `<polyline>`s in an `<svg>` with `viewBox="0 0 100 100"` and `preserveAspectRatio="none"`. Map (i, total) → (i / xMax * 100, 100 - total / yMax * 100).
- My line: `stroke="#D4651A"` (terracotta). Their line: `stroke="#7A6E66"` (ink-muted). `stroke-width="2"`, `fill="none"`.
- Axis: minimal — no gridlines. Just first/last date labels under the chart in `text-xs text-ink-muted`. Y label: highest value in `formatCurrency` near the top-left corner.
- Empty / single-point series: render text "Not enough data yet — start logging!" centered.

## comparisonStats.ts logic

```ts
export interface DailyTotal { date: string; total: number; } // date is YYYY-MM-DD in APP_TZ

export function cumulativeSeries(
  logs: SavingsLog[],
  fromDate: string, // YYYY-MM-DD inclusive
  toDate: string,   // YYYY-MM-DD inclusive
): DailyTotal[];
```
- Build a map `dateKey -> sum of amounts that day`.
- Walk dates from `fromDate` to `toDate` inclusive (one entry per day), accumulating running total. If a day has no logs, repeat previous total.
- Returns deterministic length (`toDate - fromDate + 1` days).

```ts
export interface ComparisonSummary {
  saved: number;
  startedAt: string | null;     // earliest log date or null
  currentStreak: number;
  longestStreak: number;
  biggestSave: number;
  logCount: number;
  predictedEnd: string | null;  // ISO date or null when target unset
}

export function compareSummary(
  logs: SavingsLog[],
  todayKey: string,
  target: number | null,
): ComparisonSummary;
```
- `startedAt` from `min(created_at)` formatted as `YYYY-MM-DD`.
- `currentStreak` reuses `calcStreak` from `lib/streak`.
- `longestStreak`: walk sorted unique date keys, track longest run of consecutive days.
- `biggestSave` from `max(amount)`.
- `predictedEnd`: reuse `predictedCompletion` from `lib/forecast` given saved + target + velocity.

## Acceptance Criteria
- [ ] CompareButton renders on Battle page; tapping it opens the popup.
- [ ] Popup defaults the comparison target to the leader (if not me) or the first other player.
- [ ] User can switch target via the dropdown; chart + stats refresh instantly.
- [ ] Line chart renders with two lines using consistent colors (terracotta = me).
- [ ] Stats table highlights the row winner in terracotta; ties show neither in terracotta.
- [ ] All math (cumulative, longest streak, biggest, predicted end) computed in `lib/comparisonStats.ts` — no JSX.
- [ ] Modal closes via ✕, ESC, and backdrop click.
- [ ] Empty data states render friendly messages, not blank charts.
- [ ] No new dependencies installed.
- [ ] `npx tsc --noEmit` + `npm run build` clean.

## Edge Cases / Risks
- **Mismatched series dates**: comparing players who started at different times → chart should show the union of the two date ranges; both series must be padded to the same range. `cumulativeSeries(fromDate, toDate)` handles this — pick `min(myStart, theirStart)` and `max(myLast, theirLast)`.
- **Series too long for SVG**: with daily resolution and 2-year ranges, ~700 points. Polyline handles that fine; if perf becomes an issue, downsample to weekly.
- **Predicted end NaN/Infinity**: when velocity is 0, `predictedCompletion` returns null — display "—".
- **Chart on small screens**: `viewBox` makes it scale; `h-48` (192px) is enough at 375px width to read the trend.
- **Switching targets while chart animates**: SVG re-renders cleanly — no animation framework, no race conditions.

## Out of Scope
- Hover tooltips on the chart (deferred — could add later).
- Multi-player overlay (3+ lines).
- Exporting the comparison as image.
- Daily-savings bar chart (only cumulative line for v1).
