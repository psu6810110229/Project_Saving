# Task 31 Review - Multi-user Notification Fan-out

Date: 2026-05-20
Commit reviewed: `6ff467a79049adbb6b9505f3041b45dc4d476fb8`

## Verdict

Pass.

No blocking issues were found in the Task 31 changes. The only failing verification is an unrelated, pre-existing lint error in `supabase/functions/send-nudge/index.ts`.

## Blocking Issues

None.

## Non-Blocking Issues

None for Task 31.

The existing lint issue is unrelated to this commit:

- `supabase/functions/send-nudge/index.ts:180`
- Error: `'_error' is defined but never used`
- `6ff467a` did not touch `supabase/functions/send-nudge/index.ts`.

## Requested Checks

1. Room cap was not raised: Pass.
   - Commit only changed the Task 31 plan, `notify-partner-deposit` edge function, and migration `0055_partner_notification_fanout.sql`.
   - No capacity trigger or room-members cap migration was changed.

2. `join_room_by_code` was not changed: Pass.
   - Latest implementation remains in `supabase/migrations/0024_fix_join_room_ambiguity.sql`.
   - Commit `6ff467a` does not modify it.

3. `enforce_two_player_cap` was not changed: Pass.
   - Latest implementation remains in `supabase/migrations/0023_two_player_cap.sql`.
   - Commit `6ff467a` does not modify it.

4. `_smart_check_overtaking` body was not changed: Pass.
   - `0055_partner_notification_fanout.sql` adds only comments documenting that `_smart_check_overtaking` is intentionally untouched.
   - The body remains from `0043_smart_event_crossing_hardening.sql`.

5. `notify_partner_deposit` deploy compatibility is real: Pass.
   - Edge function accepts legacy bare UUID string responses in `normaliseRpcReturn`.
   - Edge function accepts defensive legacy object responses like `{ notification_id }`.
   - Edge function accepts new JSON array responses with `{ notification_id, recipient_user_id }`.
   - The only production caller, `src/lib/notifyEvents.ts`, invokes the edge function and checks only `error`.
   - The direct RPC fallback in `src/lib/notifyEvents.ts` discards the RPC return value.
   - Other `notification_id` references are for `send-nudge` or push payload handling, not the `notify-partner-deposit` HTTP response body.

6. Migration `0055` correctly drops and recreates `notify_partner_deposit`: Pass.
   - `DROP FUNCTION IF EXISTS public.notify_partner_deposit(uuid)` is present before recreation.
   - The recreated function returns `jsonb`.
   - This is required because PostgreSQL cannot change a function return type with `CREATE OR REPLACE`.

7. Grants were restored after `DROP FUNCTION`: Pass.
   - `revoke all on function public.notify_partner_deposit(uuid) from public;`
   - `grant execute on function public.notify_partner_deposit(uuid) to authenticated;`

8. All other notify RPCs preserve 2-user behavior: Pass.
   - In a two-user room, the new loops over `room_members where user_id <> actor` target the same single other recipient as the old `_other_room_member` path.
   - Return types remain `uuid` for the non-deposit RPCs, and callers discard the return values.
   - `_smart_check_goal_reached` preserves the previous two-user behavior by notifying the depositor and the other room member; under fan-out it loops all current members.

9. Dedupe keys remain safe per recipient: Pass.
   - Existing unique constraint is `(recipient_user_id, dedupe_key)`.
   - The changed dedupe keys include the recipient id, or remain safe through the recipient-scoped unique constraint.
   - Deposit fan-out uses `deposit:<log_id>:<recipient_user_id>`.

10. Preference gating is per recipient: Pass.
    - SQL in-app notification gating still goes through `_insert_partner_notification`, which checks each recipient's `notification_preferences`.
    - Push gating in the edge function loads preferences for all recipients and evaluates `master_enabled`, `partner_activity_enabled`, and `push_enabled` per recipient.

11. Task 30 scheduled-saving-reminders was not touched: Pass.
    - `supabase/functions/scheduled-saving-reminders/index.ts` was not changed.
    - `supabase/migrations/0054_plan_start_notifications.sql` was not changed.

12. Build/lint status and send-nudge lint relation: Pass with unrelated lint failure.
    - `npm run build`: passed.
    - `npm run lint`: failed only on `supabase/functions/send-nudge/index.ts:180`, unrelated to this commit.

## Verification Commands

Commands run during review:

```powershell
git show --stat --oneline --decorate --no-renames 6ff467a
git show --name-only --format=fuller --no-renames 6ff467a
rg -n "notify_partner_deposit|notification_id|notify-partner-deposit" src supabase/functions supabase/migrations docs package.json
rg -n "create (or replace )?function public\.(join_room_by_code|enforce_two_player_cap|_smart_check_overtaking|notify_partner_deposit|_insert_partner_notification|_other_room_member)" supabase/migrations
git diff --no-ext-diff --check 6ff467a^ 6ff467a
npm run build
npm run lint
```

## Files Reviewed

- `docs/plans/31-multi-user-notification-fanout.md`
- `supabase/functions/notify-partner-deposit/index.ts`
- `supabase/migrations/0055_partner_notification_fanout.sql`
- `src/lib/notifyEvents.ts`
- `src/components/NudgeButton/NudgeButton.tsx`
- `src/sw.ts`
- `supabase/migrations/0023_two_player_cap.sql`
- `supabase/migrations/0024_fix_join_room_ambiguity.sql`
- `supabase/migrations/0040_partner_activity_notifications.sql`
- `supabase/migrations/0041_partner_activity_prefs_and_buckets.sql`
- `supabase/migrations/0043_smart_event_crossing_hardening.sql`
- `supabase/migrations/0049_goal_change_request_notification.sql`
- `supabase/migrations/0053_rename_room.sql`
- `supabase/migrations/0054_plan_start_notifications.sql`

## Recommended Fixes

No Task 31 fixes are required.

Optional unrelated lint fix:

```ts
// supabase/functions/send-nudge/index.ts
} catch {
  // Best-effort - fall back to static-only pool.
}
```
