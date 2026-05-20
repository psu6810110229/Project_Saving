# Task 36 — Member Detail View Review

Commit reviewed: `f3bb988`  
Result: **Fail**

## Blocking Issues

1. **Member Detail still triggers sensitive queries through `DataProvider`.**
   The `/members/:userId` route renders under the shared `DataProvider`, which eagerly runs `useLogs(100, roomId)` and `useReconcile(roomId)` for every room-bound route. As a result, Member Detail triggers reads for savings log `note` / `slip_url`, balance checkpoints, balance adjustments, `current_reconciled_balance`, and `balance_activity_for_room`.

   The page does not display these fields, but the privacy requirement says it must not query them.

2. **Leaderboard row still nests interactive controls when `NudgeButton` is present.**
   `RoomLeaderboardList` wraps each clickable row in `div role="button"`, and the trailing slot can contain `NudgeButton`, which renders a native `<button>`. This avoids native button-in-button markup, but still creates an interactive button inside an interactive row.

## Non-Blocking Issues

- Full `npm run lint` fails on an unrelated existing issue: `supabase/functions/send-nudge/index.ts:180` unused `_error`.
- Changed-file lint passes.
- `npm run build` passes, with Vite chunk-size/deprecation warnings.

## Checklist

- No SQL/migration/RLS/room-cap logic changed: **Pass**
- MemberDetail does not show verified balance/reconcile/checkpoints/adjustments/private notes/preferences/push/raw email: **Display pass, query fail**
- `/members/:userId` protected: **Pass**
- Non-member URL guessing shows forbidden state: **Pass**
- Self row routes to `/profile`: **Pass**
- Other member rows route to `/members/:userId`: **Pass**
- Manage Project rows remain non-interactive: **Pass**
- `SavingPlanCard` optional `onConfigure` preserves editable uses: **Pass**
- No nested/invalid interactive nesting with leaderboard/nudge: **Fail**
- Build/lint: **Build pass, full lint fail, changed-file lint pass**

## Files Reviewed

- `src/App.tsx`
- `src/pages/MemberDetail.tsx`
- `src/hooks/useRoomMembers.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/ManageProject.tsx`
- `src/components/RoomLeaderboardList/RoomLeaderboardList.tsx`
- `src/components/PlayerProgressRow/PlayerProgressRow.tsx`
- `src/components/NudgeButton/NudgeButton.tsx`
- `src/components/SavingPlanCard/SavingPlanCard.tsx`
- `src/components/RoomMemberRow/RoomMemberRow.tsx`
- `src/components/DataContext/DataContext.tsx`
- `src/hooks/useLogs.ts`
- `src/hooks/useReconcile.ts`
- `src/hooks/useLeaderboard.ts`
- `src/hooks/useRoomMembersBuckets.ts`
- `src/hooks/useRoomMembersSavingPlans.ts`
- `src/hooks/useRoomOtherMemberIds.ts`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`
