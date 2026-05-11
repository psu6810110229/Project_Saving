# Task 16 — Log Popup with Filters & Sorting

## Goal
The Battle page should show only a **short preview** of recent logs (e.g. 5). A "See all" CTA opens a **popup** containing the full log history with:
- Grouping by date (Today / Yesterday / Mar 14 …) — already done by `localDateLabel`.
- Sort toggle: **Latest** ⇄ **Oldest**.
- Filter dropdown: **All** / individual player names.

This keeps the Battle page tight while making historical data accessible without a separate route.

## Files Created
- `src/components/LogPopup/LogPopup.tsx` — full-screen overlay (mobile) / modal (md+). Wraps the existing `LogList` and adds the sort + filter controls.
- `src/components/Modal/Modal.tsx` — generic reusable modal: backdrop, close on backdrop click + ESC, focus trap, scroll lock. Used here and reused in Task 17 (Compare Popup).
- `src/hooks/useAllLogs.ts` — separate from `useLogs(limit)` to avoid blowing up the realtime subscription on the battle page. Fetches a higher cap (e.g. 500), still subscribes to realtime.

## Files Edited
- `src/components/LogList/LogList.tsx` — accept new prop `footer?: ReactNode`; render at the bottom under the last group (so the popup can place the "See all" CTA there). Also accept `filterUserId?: string` and `order: 'desc' | 'asc'` to drive the in-popup behavior — when used inline on the battle page, both props are omitted (defaults: no filter, `desc`).
- `src/pages/BattlePage.tsx` — pass `limit={5}` (was 30) for the inline preview; render a "See all logs" button under the list that opens `<LogPopup>`.

## Visual Spec — Inline preview on Battle page

```
┌────────────────────────────────┐
│  RECENT ACTIVITY               │
├────────────────────────────────┤
│  Today                         │
│   F  ฿500   2 min ago          │
│   A  ฿1000  5 min ago          │
│  Yesterday                     │
│   F  ฿100   ...                │
│   F  ฿500   ...                │
│   A  ฿500   ...                │
│  ─────────────────────         │
│       [ See all logs ]         │
└────────────────────────────────┘
```

## Visual Spec — LogPopup

```
┌──────────────────────────────────────┐
│  All activity                  ✕      │
├──────────────────────────────────────┤
│  Sort:  [ Latest ▼ ]                  │
│  Show:  [ Everyone ▼ ]                │
├──────────────────────────────────────┤
│  Today                                │
│   F  ฿500   2 min ago    🔥          │
│   A  ฿1000  5 min ago                 │
│  Yesterday                            │
│   ...                                 │
│  Mar 14                               │
│   ...                                 │
└──────────────────────────────────────┘
```

- Sort dropdown values: `Latest` (default) / `Oldest`.
- Filter dropdown values: `Everyone` (default) + one entry per profile (uses display names from `useBattleStats`/`useLeaderboard`).
- Both controls use native `<select>` styled with Tailwind — no custom dropdown component needed.
- Popup itself: full-screen on mobile (`fixed inset-0 bg-canvas`), centered modal (`max-w-md`) on `md:`+.
- Header row: title + close ✕ button. Close button uses the same Modal close handler.

## Sort + filter behavior
- Filtering happens client-side over the array returned by `useAllLogs`.
- Sorting also client-side: copy + `sort((a,b) => order === 'desc' ? bTime - aTime : aTime - bTime)`.
- Date-grouping in `LogList` already uses `localDateLabel` — but the labels assume newest-first. When `order === 'asc'`, group order should also flip (oldest day first). Adjust the `Object.entries(groups)` iteration accordingly: convert to array, sort by the first log's timestamp in each group, respecting `order`.

## Modal component spec
```ts
interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}
```
- Renders nothing if `!open`.
- Backdrop: `fixed inset-0 bg-black/40 z-50` + click-to-close.
- Panel: `relative bg-canvas` — full-screen on mobile (`inset-0`), centered card on `md:` (`max-w-md mx-auto my-8 rounded-2xl shadow-lg`).
- ESC key closes. Body `overflow-hidden` while open (scroll lock).
- Focus trap: optional for v1 — track open state in a `useEffect`, focus the first focusable element on mount, restore previous focus on unmount.

## Acceptance Criteria
- [ ] Battle page shows only the latest 5 logs by default.
- [ ] "See all logs" button opens the popup.
- [ ] Popup renders date-grouped logs from `useAllLogs`.
- [ ] Sort toggle correctly flips both within-group order AND group order.
- [ ] Filter dropdown limits visible logs to the chosen player.
- [ ] Reactions still work inside the popup (LogItem props unchanged).
- [ ] ESC and backdrop click close the popup.
- [ ] Popup is full-screen on mobile, centered on tablet+.
- [ ] No memory leak: realtime subscription in `useAllLogs` cleans up on unmount.
- [ ] `npx tsc --noEmit` and `npm run build` clean.

## Edge Cases / Risks
- **Two log subscriptions**: `useLogs(5)` on the BattlePage AND `useAllLogs()` mounted by the popup means two realtime channels. Acceptable — Supabase Realtime supports multiple. Just make sure `useAllLogs` is only mounted *while the popup is open*, not eagerly.
- **Popup state lost on close**: that's intended — sort/filter reset when reopened. If users hate that, add localStorage persistence later.
- **Empty after filter**: show "No logs from {name} yet" empty state rather than blank space.
- **Date grouping with `order: 'asc'`**: groups themselves must reorder, not just rows within groups. Caught in tests / manual QA.
- **Long history performance**: 500-cap means popup is fine for our scale; revisit if a user has > 500 logs.

## Out of Scope
- Search by note text.
- Date range pickers.
- Edit / delete logs (separate UX altogether).
- Pagination — 500-row cap is fine for now.
