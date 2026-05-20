# Feature 2 Multi-User Rooms Audit

Read-only audit for Feature 2: Multi-user rooms, 2 to 7 members.

No code was changed during this audit. No migrations were created.

## 1. Executive Verdict

Not ready to raise the room cap yet.

The database cap change itself is small, but several blocking single-partner paths would silently notify, display, or compare only the first other member in 3 to 7 member rooms. Implement the fan-out and client state slices before changing the cap in production.

## 2. Files Inspected

Primary docs and rules:

- `docs/multi-user-room-feature-plan.md` - Feature 2 only
- `CLAUDE.md`

Supabase migrations searched:

- All files under `supabase/migrations`

Supabase migrations read in detail:

- `supabase/migrations/0002_rooms.sql`
- `supabase/migrations/0012_fix_room_members_visibility.sql`
- `supabase/migrations/0016_rpc_room_members_for_room.sql`
- `supabase/migrations/0017_bootstrap_joiner_goal.sql`
- `supabase/migrations/0019_partner_buckets_visibility.sql`
- `supabase/migrations/0020_room_admin_rpcs.sql`
- `supabase/migrations/0023_two_player_cap.sql`
- `supabase/migrations/0024_fix_join_room_ambiguity.sql`
- `supabase/migrations/0025_room_goal_sync_rpc.sql`
- `supabase/migrations/0027_reconcile_checkpoints.sql`
- `supabase/migrations/0029_harden_room_goal_bucket_floor.sql`
- `supabase/migrations/0030_saving_plans.sql`
- `supabase/migrations/0037_notifications.sql`
- `supabase/migrations/0040_partner_activity_notifications.sql`
- `supabase/migrations/0041_partner_activity_prefs_and_buckets.sql`
- `supabase/migrations/0042_smart_event_notifications.sql`
- `supabase/migrations/0043_smart_event_crossing_hardening.sql`
- `supabase/migrations/0047_partner_saving_plan_visibility.sql`
- `supabase/migrations/0049_goal_change_request_notification.sql`
- `supabase/migrations/0050_milestone_acknowledgements.sql`
- `supabase/migrations/0051_streak_freeze.sql`
- `supabase/migrations/0053_rename_room.sql`
- `supabase/migrations/0054_plan_start_notifications.sql`

Edge functions inspected:

- `supabase/functions/notify-partner-deposit/index.ts`
- `supabase/functions/send-nudge/index.ts`
- `supabase/functions/scheduled-saving-reminders/index.ts`

Client hooks, components, pages, and libs inspected:

- `src/hooks/useRooms.ts`
- `src/hooks/useRoom.ts`
- `src/hooks/useLeaderboard.ts`
- `src/hooks/useSavingsTotal.ts`
- `src/hooks/usePartnerBuckets.ts`
- `src/hooks/usePartnerSavingPlan.ts`
- `src/hooks/useGoal.ts`
- `src/hooks/useBuckets.ts`
- `src/hooks/useLogs.ts`
- `src/hooks/useReconcile.ts`
- `src/hooks/useReactions.ts`
- `src/hooks/useReactionBroadcast.ts`
- `src/components/DataContext/DataContext.tsx`
- `src/components/DataContext/DataContextValue.ts`
- `src/components/HeadToHeadCard/HeadToHeadCard.tsx`
- `src/components/PlayerProgressRow/PlayerProgressRow.tsx`
- `src/components/TotalVaultCard/TotalVaultCard.tsx`
- `src/components/BucketGrid/BucketGrid.tsx`
- `src/components/DashboardHero/DashboardHero.tsx`
- `src/components/SavingRaceChart/SavingRaceChart.tsx`
- `src/components/MomentumChart/MomentumChart.tsx`
- `src/components/NudgeButton/NudgeButton.tsx`
- `src/components/JoinProjectFlow/JoinProjectFlow.tsx`
- `src/components/ProjectPreviewCard/ProjectPreviewCard.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/SavingPlan.tsx`
- `src/pages/AddMoney.tsx`
- `src/pages/ManageProject.tsx`
- `src/pages/Profile.tsx`
- `src/pages/AppLayout.tsx`
- `src/lib/notifyEvents.ts`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`

## 3. Findings Table

| area | file | symbol/function/component | current assumption | required change | risk level | suggested slice |
| --- | --- | --- | --- | --- | --- | --- |
| DB cap | `supabase/migrations/0024_fix_join_room_ambiguity.sql` | `join_room_by_code` | Returns `full` at `member_count >= 2`. | Return `full` at `member_count >= 7`, or use shared cap source. | Blocking | S1 |
| DB cap | `supabase/migrations/0023_two_player_cap.sql` | `enforce_two_player_cap`, `trg_two_player_cap` | Direct `room_members` inserts fail at 2 members. | Replace with capacity trigger at 7; consider rename to `enforce_room_capacity`. | Blocking | S1 |
| Client join copy | `src/hooks/useRooms.ts` | `joinRoomByCode` | Full room copy says "two players". | Change full-room error to 7-member wording. | Blocking | S1 |
| Client join preview | `src/pages/AppLayout.tsx`, `src/pages/Profile.tsx` | `joinPreview` | Hard-coded `memberCount: 2`. | Show actual member count/cap if available, or remove fake count from preview. | Medium | S1/S6 |
| Notification recipient lookup | `supabase/migrations/0040_partner_activity_notifications.sql` | `_other_room_member` | Returns one other user via `limit 1`. | Do not use for multi-recipient events; loop all `room_members where user_id <> actor`. | Blocking | S2 |
| Deposit notification | `supabase/migrations/0040_partner_activity_notifications.sql` | `notify_partner_deposit` | Inserts one in-app notification for one partner. | Insert one per other room member. | Blocking | S2 |
| Deposit push | `supabase/functions/notify-partner-deposit/index.ts` | Edge function flow | Expects one notification id and one recipient. | Handle an array of inserted notification ids/recipient contexts and push per recipient/device. | Blocking | S2 |
| Balance notifications | `supabase/migrations/0040_partner_activity_notifications.sql` | `notify_balance_checked` | Notifies one partner. | Fan out to all other current members. | Blocking | S2 |
| Plan activity notifications | `supabase/migrations/0040_partner_activity_notifications.sql` | `notify_plan_created`, `notify_plan_changed`, `notify_plan_paused`, `notify_plan_resumed` | Notifies one partner. | Fan out to all other current members. | Blocking | S2 |
| Goal changed notification | `supabase/migrations/0040_partner_activity_notifications.sql` | `notify_goal_changed` | Notifies one partner. | Fan out to all other current members. | Blocking | S2 |
| Room lifecycle notifications | `supabase/migrations/0040_partner_activity_notifications.sql` | `notify_room_joined`, `notify_room_left` | Notifies one partner. | Fan out to all other current members. | Blocking | S2 |
| Bucket notifications | `supabase/migrations/0041_partner_activity_prefs_and_buckets.sql` | `notify_bucket_added`, `notify_bucket_updated` | Notifies one partner. | Fan out to all other current members. | Blocking | S2 |
| Smart events | `supabase/migrations/0043_smart_event_crossing_hardening.sql` | `_smart_check_overtaking` | Compares actor with one partner. | Define N-player overtaking semantics; likely notify each member the actor passes. | Medium | S2/S6 |
| Smart events | `supabase/migrations/0043_smart_event_crossing_hardening.sql` | `_smart_check_goal_reached` | Notifies depositor plus one partner. | Notify every current room member once. | Blocking | S2 |
| Goal request | `supabase/migrations/0049_goal_change_request_notification.sql` | `notify_goal_change_request` | Sends to creator only. | Can remain creator-targeted; copy should stop saying "partner" later. | Safe to defer | S6 |
| Rename room | `supabase/migrations/0053_rename_room.sql` | `rename_room` | Already loops all `room_members` except actor. | No DB change required. Verify dedupe per recipient works through unique `(recipient_user_id, dedupe_key)`. | Safe to defer | S2 QA |
| RLS buckets | `supabase/migrations/0019_partner_buckets_visibility.sql` | `buckets_select_co_member` | Co-member read policy, not exact-two. | No change required. | Safe to defer | None |
| RLS saving plans | `supabase/migrations/0047_partner_saving_plan_visibility.sql` | `saving_*_select_co_member` | Co-member read policy, not exact-two. | No change required. | Safe to defer | None |
| Room member listing | `supabase/migrations/0016_rpc_room_members_for_room.sql` | `room_members_for_room` | Returns all members. | No change required. | Safe to defer | None |
| Goal sync | `supabase/migrations/0029_harden_room_goal_bucket_floor.sql` | `update_room_goal` | Loops all members and uses max bucket total. | No DB math change required for Feature 2. | Safe to defer | None |
| Data state | `src/components/DataContext/DataContext.tsx` | `partnerEntry = find(!isYou)` | Collapses all other members to first other member. | Expose all other members; use grouped bucket/plan state. | Blocking | S3 |
| Data state types | `src/components/DataContext/DataContextValue.ts` | `partnerBuckets`, `partnerSavingPlan` | Single-partner return types. | Add N-member data shapes; keep wrappers if useful for 2-user compatibility. | Blocking | S3 |
| Buckets hook | `src/hooks/usePartnerBuckets.ts` | `usePartnerBuckets` | Fetches one partner's buckets by one `user_id`. | Fetch/group buckets for all other member ids. | Blocking | S3 |
| Saving plan hook | `src/hooks/usePartnerSavingPlan.ts` | `usePartnerSavingPlan` | Fetches one partner's active plan. | Fetch plans for all other member ids, keyed by user. | Blocking | S3 |
| Leaderboard hook | `src/hooks/useLeaderboard.ts` | `useLeaderboard` | Already reads all members and sorts N entries. | Keep; add QA for 3/7 users and tie handling. | Safe to defer | S4 QA |
| Room totals | `src/hooks/useSavingsTotal.ts` | `useSavingsTotal` | Current user total only; room total uses leaderboard elsewhere. | No direct Feature 2 change, but beware capped `useLogs` totals. | Medium | S6 |
| Dashboard progress UI | `src/pages/Dashboard.tsx`, `src/components/HeadToHeadCard/HeadToHeadCard.tsx` | `HeadToHeadCard`, `leftPlayer`, `rightPlayer` | Exactly 2 rows. | Replace dashboard usage with N-aware leaderboard card/list. | Blocking | S4 |
| Player row | `src/components/PlayerProgressRow/PlayerProgressRow.tsx` | `PlayerProgressRow` | Row itself can render one player. | Reuse in N-list if props still fit. | Safe to defer | S4 |
| Dashboard buckets UI | `src/pages/Dashboard.tsx` | `bucketView: mine/partner`, `partnerBucketItems` | One partner tab and one partner bucket grid. | Group other-member buckets by member. | Blocking | S4 |
| Goal edit UI | `src/pages/Dashboard.tsx` | `partnerBucketTotal`, `GoalTargetSummary` | Checks only one partner's bucket total. | Use max bucket target total across all members. | Blocking | S4 |
| Dashboard charts | `src/pages/Dashboard.tsx`, `src/components/MomentumChart/MomentumChart.tsx`, `src/components/SavingRaceChart/SavingRaceChart.tsx` | `partnerSeries`, `partnerName` | One partner series. | Pick aggregate, selected-member, or defer chart redesign. | Medium | S4/S6 |
| Add money chart | `src/pages/AddMoney.tsx` | `partner = find(!isYou)` | One partner comparison. | Use aggregate/selected other member or omit other-member series for v1. | Medium | S6 |
| Bucket sheet trend | `src/pages/Dashboard.tsx` | `trendPreview.theirSeries` | One partner series. | Same chart decision as dashboard. | Medium | S6 |
| Saving plan UI | `src/pages/SavingPlan.tsx` | Mine/Partner segmented control | One partner plan tab. | Add all-other-member selector/list. | Medium | S5 |
| Nudge UI | `src/components/NudgeButton/NudgeButton.tsx`, `src/pages/Dashboard.tsx` | One `partnerUserId`. | Render per-member nudge action where appropriate. | Medium | S5 |
| Manage Project | `src/pages/ManageProject.tsx` | invite row always available | No member list/full state. | Add member list; hide/disable invite at 7. | Medium | S6 |
| Copy | `src/i18n/locales/en.ts`, `src/i18n/locales/th.ts` | Many "partner" labels | 1:1 language. | Convert group-facing copy to "members"/"other members"; keep 2-user-friendly where harmless. | Safe to defer | S6 |

## 4. DB/RPC/RLS Findings

The hard-coded two-player cap is active in two places:

- `join_room_by_code` in `0024_fix_join_room_ambiguity.sql`
- `enforce_two_player_cap` / `trg_two_player_cap` in `0023_two_player_cap.sql`

Both must change together. If only the RPC changes, direct `room_members` insert paths still fail at 2. If only the trigger changes, invite-code joins still return `full` at 2.

RLS is mostly already N-safe:

- `room_members_select` uses `public.is_room_member(room_id)`.
- `room_members_for_room` returns every member in a room.
- `goals_member_select`, `logs_member_select`, `buckets_select_co_member`, and `saving_plan_*_select_co_member` are co-member policies, not exact-two policies.
- `notifications_select_own` remains correct because notifications are recipient-owned.

RPCs that appear N-safe:

- `update_room_goal` loops all `room_members`.
- The bucket-floor check in `0029` uses `max(member_bucket_total)` across all members.
- `bootstrap_joiner_goal` is comment-labeled as a second-user helper but functionally works for every joiner.
- `archive_room` and `restore_room` are creator-only and do not depend on member count.
- `rename_room` already fans out to all other room members.

RPCs affected by single-recipient assumptions:

- `_other_room_member`
- `notify_partner_deposit`
- `notify_balance_checked`
- `notify_plan_created`
- `notify_plan_changed`
- `notify_plan_paused`
- `notify_plan_resumed`
- `notify_goal_changed`
- `notify_room_joined`
- `notify_room_left`
- `notify_bucket_added`
- `notify_bucket_updated`
- `_smart_check_overtaking`
- `_smart_check_goal_reached`

`notify_goal_change_request` intentionally sends to the room creator only. That is not a fan-out bug, but the surrounding product copy should be reviewed later because the requester is not necessarily "the partner" in a group room.

## 5. Edge-Function Notification Fan-Out Findings

`notify-partner-deposit` is blocking.

Current flow:

1. Calls `notify_partner_deposit(p_log_id)` as the caller.
2. Receives one notification id.
3. Loads one notification row and one `recipient_user_id`.
4. Checks one recipient's push preferences.
5. Sends push to that one recipient's subscriptions.

Required flow:

1. SQL inserts one notification per other current room member.
2. Edge function receives all inserted notification ids, or can query the inserted rows by log/dedupe.
3. Edge function groups by recipient and sends push per recipient/device.
4. Delivery attempts remain per notification/subscription.

`send-nudge` is already recipient-targeted and validates both sender and recipient are room members. The server side can survive N members. The Dashboard currently exposes only one partner nudge target.

`scheduled-saving-reminders` and plan-start notifications are owner-only and do not need Feature 2 fan-out changes.

## 6. Hooks/State Findings

Blocking state assumptions:

- `DataContext` finds only `leaderboard.entries.find(entry => !entry.isYou)`.
- `usePartnerBuckets` accepts one `partnerUserId`.
- `usePartnerSavingPlan` accepts one `partnerUserId`.
- `DataContextValue` exposes singular `partnerBuckets` and `partnerSavingPlan`.

Safe or mostly safe:

- `useLeaderboard` already reads all room members, falls back to `room_members_for_room`, and sorts N entries.
- `useReconcile` reads sanitized room activity via `balance_activity_for_room`; the RPC is room-wide and N-safe.
- `useReactions` is room/log scoped enough for v1, but realtime broadcast channel `reactions:room` is not room-id-specific. That is not a Feature 2 blocker unless reaction UX is expanded.

Medium-risk existing issue:

- `useLogs(100)` feeds leaderboard and room totals. With up to 7 members, capped logs can produce wrong totals sooner. This is not caused by Feature 2 but becomes more visible.

## 7. UI Findings

Blocking UI assumptions:

- `Dashboard` renders `HeadToHeadCard` with exactly `leftPlayer` and `rightPlayer`.
- `HeadToHeadCard` props require exactly two players.
- Dashboard buckets use `bucketView: 'mine' | 'partner'`.
- Goal edit warning compares only current user's bucket total and one partner bucket total.
- `SavingPlan` has a Mine/Partner segmented control and one read-only partner view.

Medium-risk UI assumptions:

- `MomentumChart`, `SavingRaceChart`, `AddMoney`, and `BucketSheet` support only one partner comparison series.
- `NudgeButton` is fine as a per-recipient action, but Dashboard renders it only for the first other member.
- `ManageProject` has no member list and does not disable invite once the room is full.
- Join previews in `AppLayout` and `Profile` hard-code `memberCount: 2`.

Copy cleanup:

- English and Thai locale files use "partner" heavily. Treat copy as a later slice after behavior works, except for the full-room join error which must change with S1.

## 8. QA Matrix

| case | QA checks |
| --- | --- |
| 2-user room | Existing create/join still works. Dashboard remains visually equivalent. One notification per other user. Partner buckets and partner saving plan still visible. Nudge works. Goal edit validation still checks both users' bucket totals. |
| 3-user room | Third member can join. Dashboard shows 3 progress rows. Each member sees two other-member bucket/plan surfaces. Deposit, balance, plan, bucket, room, and goal-change notifications fan to 2 recipients. No duplicate notification conflicts. |
| 7-user room | Joins succeed through the 7th member. Dashboard remains usable. Invite/share UI indicates room is full. Deposit fan-out can send up to 6 recipient notifications and push attempts. Goal reached notifies all 7 members once. |
| 8th join fails | `join_room_by_code` returns `full`. Direct insert into `room_members` trigger rejects. UI shows full-room copy. No `bootstrap_joiner_goal` runs. No room-joined notification fires. |

## 9. Recommended Implementation Order

1. S1 - Capacity only: update `join_room_by_code`, replace the trigger, update full-room copy, preserve 2-user join behavior.
2. S2 - Notification fan-out: replace single-recipient SQL paths and update `notify-partner-deposit` edge function.
3. S3 - Data hooks: introduce all-other-member bucket and saving-plan state while keeping thin 2-user-compatible wrappers if helpful.
4. S4 - Dashboard: N-aware progress list, grouped other-member buckets, all-member bucket-floor warning.
5. S5 - Saving plan and nudge UX: other-member selector/list and per-member nudge actions.
6. S6 - Polish and QA: Manage Project member list/full invite state, chart decision, copy cleanup, capped-log totals follow-up if needed.

## 10. Things Not To Touch

- Do not change `savings_logs.amount > 0`.
- Do not add withdrawals, negative deposits, bucket allocation hacks, or Reconcile allocation.
- Do not change the definitions of Recorded Deposits, Verified Balance, or Planned Balance.
- Do not bundle Feature 5 goal semantics into Feature 2.
- Do not broadly rewrite RLS; existing co-member policies are mostly correct.
- Do not remove existing 2-user behavior while generalizing UI and hooks.
- Do not edit old migrations in implementation; add a new migration for cap/fan-out changes.
