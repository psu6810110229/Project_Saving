# Task 37 - Individual Sub-Goals Review

Commit reviewed: `6bc8534`  
Result: **Fail**

Review priority: database/RPC/triggers/backfill correctness over UI polish.

## Blocking Issues

1. **`_smart_check_goal_reached` regresses N-member fan-out and crossing behavior.**

   File/function: `supabase/migrations/0057_individual_sub_goals.sql`, `public._smart_check_goal_reached`.

   The migration correctly changes the target source to `rooms.target_amount`, but it also reverts behavior introduced by migration `0055_partner_notification_fanout.sql`. The new body uses `public._other_room_member(...)`, so in rooms with up to 7 members only the depositor plus one other member receive `goal_reached`.

   It also drops the timestamp-based strict crossing calculation from `0055` and instead compares against the full current room total. That can change behavior when evaluating logs around out-of-order timestamps or retries.

   Exact fix:

   - Restore the `0055` loop over every current `room_members` recipient.
   - Restore `v_log_created_at`, `v_prev_total`, and `v_new_total` strict-crossing logic.
   - Keep only the intended Task 37 target-source change:

   ```sql
   select r.target_amount
     into v_target
     from public.rooms r
    where r.id = v_room_id;
   ```

2. **Room-goal max-personal checks include stale leaver goals.**

   File/functions: `supabase/migrations/0057_individual_sub_goals.sql`, `public.enforce_room_target_amount_invariant`, `public.update_room_goal`.

   Both checks compute `max(g.target_amount)` across all `goals` rows in the room. The Task 37 backfill and acceptance criteria are based on current members. A member who left the room can leave behind a high historical personal goal row, causing valid creator room-goal edits to be rejected forever.

   Exact fix:

   - Compute max personal sub-goal through current `room_members` in both functions.
   - Apply the same current-member filter to verification SQL and the `bootstrap_joiner_goal` fallback.

   Suggested pattern:

   ```sql
   select coalesce(max(g.target_amount), 0)
     into v_max_personal
     from public.goals g
     join public.room_members rm
       on rm.room_id = g.room_id
      and rm.user_id = g.user_id
    where g.room_id = p_room_id
      and g.target_amount > 0;
   ```

## Non-Blocking Issues

- `src/pages/Dashboard.tsx` still falls back another member's missing row target to the current user's personal target via `entry.target ?? target`. That is not a true "member rows use personal sub-goal" behavior. Allow row targets to be unset, or only apply the fallback to the synthesized current-user row.
- `src/pages/SavingPlan.tsx` keeps seeding new-plan end date from legacy `goal.end_date`. Saving Plan target independence is preserved, but the canonical room end date now comes from `roomGoalEndDate`.

## Checklist

- `rooms.target_amount` migration/backfill correctness: **Mostly pass**, with current-member consistency issue in verification/fallback checks.
- `update_room_goal` signature/return/grants preserved: **Pass**.
- `update_room_goal` creator-only and no longer overwrites member goals: **Pass**, but stale leaver goal max check blocks valid edits.
- `update_member_goal` self-only and validates bounds: **Pass**.
- Room/personal goal invariant triggers do not break create/join flows: **Pass for normal create/join**, with stale leaver max-check caveat.
- `bootstrap_joiner_goal` seeds from room goal: **Pass**, but fallback should use current members only.
- `_smart_check_goal_reached` uses `rooms.target_amount`: **Target source pass, behavior fail**.
- Grants/revokes preserved: **Pass**.
- Rollback/rerun/idempotence risks: **Mostly pass**; no rollback migration, and rerun keeps existing `rooms.target_amount` values because backfill only fills nulls.
- `roomGoalTarget` vs `personalGoalTarget` separation: **Pass**.
- Dashboard Vault denominator uses room goal: **Pass**.
- Member rows use personal sub-goal: **Mostly pass**, but missing-goal fallback is incorrect.
- Manage Project edit flows: **Pass**.
- Bucket capacity uses personal sub-goal: **Pass**.
- Saving Plan target remains independent: **Pass**.
- Existing rooms visually compatible after backfill: **Pass by intended sum-of-personal backfill**.

## Files And Functions Reviewed

Database:

- `supabase/migrations/0057_individual_sub_goals.sql`
- `public.enforce_room_target_amount_invariant`
- `public.enforce_personal_goal_target_invariant`
- `public.update_room_goal`
- `public.update_member_goal`
- `public.bootstrap_joiner_goal`
- `public._smart_check_goal_reached`
- Compared behavior against `0017_bootstrap_joiner_goal.sql`, `0025_room_goal_sync_rpc.sql`, `0029_harden_room_goal_bucket_floor.sql`, `0043_smart_event_crossing_hardening.sql`, `0055_partner_notification_fanout.sql`, and `0056_raise_room_capacity_to_7.sql`.

Client:

- `src/hooks/useGoal.ts`
- `src/hooks/useRooms.ts`
- `src/hooks/useLeaderboard.ts`
- `src/hooks/useBuckets.ts`
- `src/pages/AppLayout.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/ManageProject.tsx`
- `src/pages/SavingPlan.tsx`
- `src/types/index.ts`
- `src/components/RoomLeaderboardList/RoomLeaderboardList.tsx`
- `src/components/PlayerProgressRow/PlayerProgressRow.tsx`

## Verification

No tests or migrations were run during the review. This was a static audit of commit `6bc8534`.
