# Task 23 System Plan - Notification System

This is the backend/system implementation plan for Task 23. It pairs with `docs/plans/23-notification-ux-ui-spec.md`, which defines the UI surfaces, component behavior, copy tone, and deep-link UX. Do not duplicate the full UX spec here; use that file as the source of truth for UI placement and visual behavior.

GO-OUT is a mobile-first 2-person shared savings tracker. The app does not connect to banks and does not hold real money. Notifications must be privacy-safe, opt-in for push, non-spammy, and deep-link aware.

## 1. Current Repo Observations

Existing notification/PWA infrastructure:

- `src/hooks/usePushSubscription.ts` manages browser Web Push subscription state and writes rows to `public.push_subscriptions`.
- `supabase/migrations/0022_push_subscriptions.sql` creates `push_subscriptions` and `nudges`.
- `supabase/functions/send-nudge/index.ts` sends Web Push with VAPID and throttles nudges by `(from_user, to_user)` for 5 minutes.
- `src/components/NudgeButton/NudgeButton.tsx` prompts for push permission on first nudge tap and invokes `send-nudge`.
- `src/sw.ts` handles push payloads and notification clicks, but currently only focuses an existing client or opens `payload.url || /dashboard`.
- `docs/vapid-runbook.md` documents VAPID setup and the current nudge smoke test.
- PWA registration/freshness lives in `src/lib/pwaUpdate.ts`; release notes use `ReleaseUpdateModal`, not push.

Important current gaps:

- There is no general `notifications` table or in-app notification center data model.
- `send-nudge` does not currently validate that sender and recipient are both members of `room_id`; it only validates auth and target user.
- `send-nudge` sends push directly and records only a nudge audit row, not an in-app notification row.
- Push payload target is currently hardcoded to `/dashboard`.
- Service worker click handling focuses the first open client without forcing route navigation when a client exists on a different route.
- `push_subscriptions` has insert/select/delete RLS for own rows, but no update policy; current upsert may need hardening for existing endpoint refresh.
- Existing `NudgeButton` hides entirely when push is unsupported, so there is no in-app-only nudge history yet.

Existing event sources:

- Deposits are direct client inserts into `savings_logs` through `useLogs.insert`; the deposit flow is intentionally fast and optimistic.
- Dashboard already merges deposit rows and sanitized balance-check rows into a small Activity section.
- Check Balance writes through `create_balance_checkpoint` RPC and exposes partner-visible sanitized rows through `balance_activity_for_room`; private notes and storage items are intentionally hidden from partners.
- Saving Plan writes through `create_saving_plan`, `change_saving_plan`, `pause_saving_plan`, and `resume_saving_plan` security-definer RPCs.
- Saving Plan pause/resume uses Bangkok dates. A pause interval is `[paused_from, resumed_from)`, and same-day resume is allowed by migration `0036`.
- Goal changes use `update_room_goal`.
- Bucket creates/updates/deletes currently happen through direct client writes in `useBuckets.saveBuckets`.
- Room join uses `join_room_by_code`; archive/restore use RPCs; leave deletes the caller's `room_members` row.

Guardrails from `CLAUDE.md`:

- Do not change `savings_logs` semantics or introduce negative logs.
- Do not expose private reconcile notes or storage details.
- Use security-definer RPCs with safe `search_path` for sensitive writes.
- Validate room membership and ownership.
- Keep deposit and check-balance flows fast.
- Do not install new libraries or replace the stack.

## 2. Product Decisions

### In-App Log First vs Push First

Decision: build an in-app notification log first, then route selected events to push.

Reasons:

- In-app notifications work without browser permission.
- They give the Dashboard bell and notification center a stable source of truth.
- They make nudge history and partner activity visible even when push is unavailable.
- They reduce the risk of lockscreen privacy leaks while event taxonomy settles.

### MVP

Recommended MVP slice:

- `notifications` table.
- `notification_preferences` table.
- Read/unread RPCs.
- Unread count query.
- Safe event creation RPC for known event types.
- In-app notification center data flow.
- Harden current nudge flow to create an in-app notification and keep push working.
- Improve service worker click routing so push targets are useful.
- Partner deposit in-app notification only or push-disabled by default until preferences are wired.

Do not start with every scheduled push event. Scheduled saving reminders are Phase 23.3 after the in-app foundation is stable.

### Deferred

- Advanced quiet hours.
- Full scheduled reminder engine in the first slice.
- Batching/digests.
- Smart milestones beyond very simple goal reached.
- Bulk delete/archive.
- Notification analytics dashboards.
- Full Thai copy.
- Task 24 bucket correction and reconcile resolution notifications.

### Push-Worthy vs In-App-Only

Push-worthy:

- Partner nudge.
- Saving reminder after opt-in.
- Partner deposit, only after preferences exist and throttle is tested.
- Bucket goal reached, later.
- Goal/plan changed, later and only for meaningful shared changes.

In-app-only for MVP:

- Partner deposit.
- Balance checked.
- Plan changed/paused/resumed.
- Goal changed.
- Bucket added/updated.
- Room joined/left.

Deferred:

- Bucket archive/remove tied to Task 24.
- Overtaking/progress race milestone.
- Streak milestone.
- Product/release notifications unless replacing current release modal.

## 3. Event Taxonomy

Each event type must define actor, recipient, room, copy source, route, privacy, dedupe, and throttle behavior.

Definitions:

- Actor: user who caused the event. Can be null for system reminders.
- Recipient: user who should see the notification.
- Room: project room that scopes visibility.
- Privacy level:
  - `public_room`: safe for both room members.
  - `owner_private`: only the owner/recipient should see it.
  - `push_safe`: safe to place in lockscreen push payload.
  - `push_minimal`: push should avoid amounts/details; in-app can show more.
- Dedupe key: stable key preventing duplicate notifications for the same source event and recipient.

| Event key | Actor | Recipient | Title/body source | Target | Channel | Privacy | Dedupe key | Throttle |
|---|---|---|---|---|---|---|---|---|
| `nudge_received` | Sender | Partner | Sender display name, optional short message | `/dashboard`, fallback `/dashboard` | in-app + push | `push_safe` | `nudge:{nudge_id}:{recipient}` | 5 min per sender/recipient |
| `saving_reminder_due` | System | Plan owner | Active plan cadence, no shame copy | `/saving-plan` or `/add`, fallback `/saving-plan` | in-app + push later | `push_safe` | `reminder:{plan_id}:{date_key}:{recipient}` | once per cadence window |
| `partner_deposited` | Depositor | Other room member | Amount, bucket name, actor display name | `/dashboard?section=activity`, fallback `/dashboard` | in-app MVP, push later | `push_safe` if amount allowed | `deposit:{log_id}:{recipient}` | no duplicate per log |
| `balance_checked` | Checker | Other room member | Sanitized check status only | `/dashboard?section=activity`, fallback `/dashboard` | in-app only | `push_minimal` | `balance_check:{checkpoint_id}:{recipient}` | no duplicate per checkpoint |
| `plan_created` | Plan owner | Other room member only if partner-visible policy approved | Generic plan activity | `/saving-plan`, fallback `/saving-plan` | in-app only | `public_room` but limited | `plan_created:{plan_id}:{recipient}` | no duplicate |
| `plan_changed` | Plan owner | Plan owner and optionally partner | Generic plan updated | `/saving-plan`, fallback `/saving-plan` | in-app only | `public_room` limited | `plan_revision:{revision_id}:{recipient}` | no duplicate |
| `plan_paused` | Plan owner | Plan owner and optionally partner | Pause state only | `/saving-plan`, fallback `/saving-plan` | in-app only | `public_room` limited | `plan_pause:{pause_id}:paused:{recipient}` | no duplicate |
| `plan_resumed` | Plan owner | Plan owner and optionally partner | Resume state only | `/saving-plan`, fallback `/saving-plan` | in-app only | `public_room` limited | `plan_pause:{pause_id}:resumed:{recipient}` | no duplicate |
| `bucket_added` | Bucket owner | Other room member | Bucket name only | `/dashboard?section=buckets`, fallback `/dashboard` | in-app only | `public_room` | `bucket_added:{bucket_id}:{recipient}` | no duplicate |
| `bucket_updated` | Bucket owner | Other room member | Bucket name only | `/dashboard?section=buckets`, fallback `/dashboard` | in-app only | `public_room` | `bucket_updated:{bucket_id}:{updated_at}:{recipient}` | collapse later |
| `bucket_goal_reached` | Depositor | Bucket owner and optionally partner | Bucket name reached target | `/dashboard?section=buckets`, fallback `/dashboard` | in-app + push later | `push_safe` | `bucket_goal:{bucket_id}:{recipient}` | once per bucket target crossing |
| `goal_changed` | Actor | Other room member | Shared goal changed | `/manage-project`, fallback `/manage-project` | in-app only | `public_room` | `goal_changed:{room_id}:{updated_at}:{recipient}` | collapse within 10 min later |
| `room_joined` | Joiner | Existing member | Display name joined | `/manage-project`, fallback `/manage-project` | in-app only | `push_safe` | `room_joined:{room_id}:{joiner}:{recipient}` | no duplicate |
| `room_left` | Leaver | Remaining member | Display name left | `/manage-project`, fallback `/manage-project` | in-app only | `push_safe` | `room_left:{room_id}:{leaver}:{recipient}` | no duplicate |
| `overtaking` | System | Affected users | Progress order changed | `/dashboard?section=progress`, fallback `/dashboard` | deferred | `push_minimal` | `overtaking:{room_id}:{leader}:{date_key}` | once per day |
| `streak_milestone` | System | Streak owner | Positive milestone count | `/dashboard` or `/saving-plan`, fallback `/dashboard` | deferred | `push_safe` | `streak:{user}:{room}:{count}` | only milestone counts |
| `product_update` | System | User | Release/version copy | `/dashboard`, fallback `/dashboard` | deferred | `push_safe` | `release:{version}:{user}` | once per version |

MVP event keys:

- `nudge_received`
- `partner_deposited`
- `saving_reminder_due` eligibility only; actual scheduled push can wait for 23.3

## 4. Data Model

Add one numbered migration after the current latest migration. Do not edit old migrations.

### `public.notifications`

Purpose: one recipient-specific in-app notification row. One source event may produce two rows, one for each recipient.

Suggested fields:

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  room_id uuid references public.rooms(id) on delete cascade,
  event_key text not null,
  category text not null check (category in (
    'nudge',
    'saving_reminder',
    'partner_activity',
    'product'
  )),
  channel_policy text not null default 'in_app' check (channel_policy in (
    'in_app',
    'push_candidate',
    'push_sent',
    'push_skipped'
  )),
  title text not null,
  body text not null,
  cta_label text,
  target_route text not null,
  target_section text,
  fallback_route text not null,
  push_safe boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  source_table text,
  source_id uuid,
  dedupe_key text not null,
  read_at timestamptz,
  clicked_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
```

Constraints:

- `target_route <> ''`
- `fallback_route <> ''`
- `event_key` should be constrained to a known list once stable.
- `unique (recipient_user_id, dedupe_key)`
- `payload` must not contain private reconcile note text, storage item labels, push endpoint keys, or arbitrary user-entered notes.

Indexes:

- `(recipient_user_id, created_at desc) where archived_at is null`
- `(recipient_user_id, read_at) where read_at is null and archived_at is null`
- `(room_id, created_at desc)`
- `(source_table, source_id)` for debugging
- `(recipient_user_id, dedupe_key)` unique

Retention/cleanup:

- Keep read notifications for 90 days by default.
- Keep unread notifications until read, but cap center fetch to recent rows.
- Future cleanup job can delete `read_at is not null and read_at < now() - interval '90 days'`.

Privacy notes:

- Rows are per recipient.
- Do not rely on hiding sensitive fields in the client; do not store sensitive content in notification copy/payload.
- `payload` should contain only UI-safe context, for example `{ "amount": 500, "bucket_name": "Flights" }` for deposit if product accepts amount on lockscreen. Use minimal payload for push.

### `public.notification_preferences`

Purpose: per-user notification category settings. Keep global in MVP; add room-level override later only if needed.

Suggested fields:

```sql
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  master_enabled boolean not null default true,
  push_enabled boolean not null default false,
  nudges_enabled boolean not null default true,
  saving_reminders_enabled boolean not null default false,
  partner_activity_enabled boolean not null default true,
  product_updates_enabled boolean not null default true,
  prompt_dismissed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

- Primary key on `user_id` is enough for MVP.

Constraints:

- `updated_at` maintained by RPC or trigger.
- `push_enabled` means user opted into push categories, not browser permission. Device subscription lives in `push_subscriptions`.

Defaults:

- `master_enabled = true`
- `push_enabled = false`
- `nudges_enabled = true`
- `saving_reminders_enabled = false` until user opts in
- `partner_activity_enabled = true` for in-app center
- `product_updates_enabled = true`

Privacy notes:

- User can read/update only own preferences.
- Preferences should not reveal room membership or partner state.

### `public.notification_delivery_attempts`

Purpose: optional but recommended for debugging push delivery without analytics dashboards.

Suggested fields:

```sql
create table public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  push_subscription_id uuid references public.push_subscriptions(id) on delete set null,
  channel text not null check (channel in ('push')),
  status text not null check (status in ('queued', 'sent', 'skipped', 'failed', 'expired')),
  error_code text,
  error_message text,
  attempted_at timestamptz not null default now()
);
```

Indexes:

- `(notification_id, attempted_at desc)`
- `(recipient_user_id, attempted_at desc)`
- `(status, attempted_at desc)` for cleanup/debugging

Retention/cleanup:

- Keep 30 days.
- Do not store push payload body if it might contain sensitive copy.

Privacy notes:

- Client should not need direct read access in MVP.
- Service role/edge function can write attempts.

### `public.push_subscriptions` Reuse And Hardening

Reuse the existing table.

Recommended migration hardening:

- Add `updated_at timestamptz not null default now()`.
- Add `last_seen_at timestamptz`.
- Add `revoked_at timestamptz` if soft delete is preferred later; MVP can keep hard delete.
- Add own-row update RLS policy:
  - `for update using (user_id = auth.uid()) with check (user_id = auth.uid())`
- Update `usePushSubscription` to expose `permission` and to refresh `updated_at/last_seen_at`.

Do not expose partner endpoints to clients.

## 5. RLS And Security

### Notifications

RLS:

- Enable RLS.
- `select`: `recipient_user_id = auth.uid()`.
- `update`: only own notification and only safe fields:
  - Direct RLS cannot restrict columns; prefer RPCs for marking read/clicked.
  - If direct update is allowed, use a policy for `recipient_user_id = auth.uid()` and keep client update code limited to `read_at`, `clicked_at`, `archived_at`.
- No direct client insert.
- No direct client delete in MVP.

RPCs:

- `list_notifications(p_limit int default 30, p_before timestamptz default null)`
- `unread_notification_count()`
- `mark_notification_read(p_notification_id uuid)`
- `mark_all_notifications_read()`
- `mark_notification_clicked(p_notification_id uuid)`
- `create_notification(...)` internal/security-definer helper, not broadly granted unless it validates the source.

All security-definer functions:

- `set search_path = public`
- Validate `auth.uid()` when called by client.
- Validate room membership with `public.is_room_member(p_room_id)`.
- Validate source row ownership/room for event-specific creation.
- Never accept raw title/body from arbitrary client for partner-facing events.
- Derive copy server-side from known event types and sanitized source rows.

### Preferences

RLS:

- `select`: `user_id = auth.uid()`
- `insert`: `user_id = auth.uid()`
- `update`: `user_id = auth.uid()`
- No delete needed.

Recommended RPC:

- `get_notification_preferences()`: returns row, creates default row if missing.
- `update_notification_preferences(...)`: updates own booleans only.

### Push Subscriptions

RLS:

- Keep own insert/select/delete.
- Add own update.
- Cross-user endpoint reads must remain service role only.

Security rules:

- Edge functions can read subscriptions with service role.
- Clients never select partner subscriptions.
- Invalid endpoint cleanup happens server-side after push failure status 404/410.

### Room Membership

Every room-scoped notification must validate:

- Actor is authenticated unless system event.
- Recipient is a current or intended room member.
- Actor is a member of `room_id` when actor exists.
- For nudge, sender and recipient must be distinct members of the same active room.
- For leave-room notification, create notification before deleting membership or use a security-definer leave RPC in the future.

### Reconcile Privacy

Never include:

- `balance_checkpoints.note`
- `checkpoint_storage_items.label`
- `checkpoint_storage_items.amount`
- Private storage split details

Allowed for partner-visible notification:

- Actor display name.
- That a balance check happened.
- Whether amounts matched or a signed difference exists only if this matches existing sanitized activity policy.
- Prefer generic copy for push: `{actorName} checked balance.`

### Push Payload Privacy

Push payload must contain:

- `notification_id`
- `event_key`
- `title`
- `body`
- `url`
- `fallback_url`

Push payload must not contain:

- Private notes.
- Storage item labels/details.
- Full arbitrary payload JSON.
- Push subscription endpoint/auth keys.

## 6. Notification Creation Strategy

Options:

### Option A: Client Creates Notification Rows Directly

Pros:

- Fast to implement.
- Easy to call after actions.

Cons:

- Hard to prevent spoofing/spam.
- Client can choose arbitrary recipient/title/body unless heavily constrained.
- Not acceptable for partner-facing MVP.

Do not use direct client inserts.

### Option B: Database Triggers On Source Tables

Pros:

- Hard to forget event creation.
- Runs in the same transaction as source write.

Cons:

- Trigger failure can block deposits/check balance.
- Harder to apply user preferences and push delivery cleanly.
- Direct bucket/deposit tables currently have multiple legacy policy concerns.

Defer broad triggers. Consider later for low-risk in-app rows after functions are proven.

### Option C: Event-Specific Security-Definer RPCs

Pros:

- Validates source row and room membership.
- Can derive safe copy server-side.
- Can be called after core action resolves so it does not block deposits.
- Matches existing RPC pattern for saving plan and reconcile.

Cons:

- Client must remember to call the RPC after direct insert flows.
- Failed notification creation may be silent unless logged.

Recommended MVP approach.

### Option D: Edge Function Event Router

Pros:

- Can combine in-app creation, preference evaluation, and push delivery.
- Good for scheduled reminders and nudge push.

Cons:

- Requires service role and careful validation.
- More deployment moving parts.

Use for push delivery and scheduled reminders after foundation exists.

### Recommended Hybrid

23.1:

- Use RPCs for in-app notification creation and read state.
- Call notification creation after core actions complete.
- Do not block core success if notification RPC fails.

23.2:

- Keep `send-nudge` edge function, but harden it:
  - validates room membership,
  - creates `notifications` row,
  - evaluates preferences,
  - sends push when allowed,
  - logs delivery attempts.

23.3:

- Add scheduled edge function for reminders.

Important integration rule:

- Deposit/check balance/save plan should never wait on push delivery.
- If notification creation is called from the client after a core action, handle errors as non-fatal telemetry/console warning, not user-facing failure.

## 7. Push Delivery Strategy

### Function Shape

Preferred:

- Keep `send-nudge` for compatibility in 23.2.
- Add shared helper logic inside edge functions or create `send-notification` for general push in 23.3+.

MVP:

- `send-nudge` creates in-app notification and sends push.
- General push for partner deposits/reminders can wait.

Future:

- `send-notification` accepts `notification_id` or server-created event request.
- It loads notification row, preferences, push subscriptions, and sends to all recipient devices.

### VAPID/Env Requirements

Already required:

- `VITE_VAPID_PUBLIC_KEY` for client subscription.
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not commit keys.

### Preference Evaluation Before Push

Push is sent only when all are true:

- Recipient has `notification_preferences.master_enabled = true`.
- Recipient has `push_enabled = true`.
- Category enabled.
- Browser has at least one active `push_subscriptions` row.
- Event is `push_safe = true`.
- Event is push-worthy for this phase.
- Throttle/dedupe passes.

In-app notification can still be created when push is skipped, unless master/category settings explicitly disable in-app creation for that event.

### Multiple Devices

- Send to every active subscription for recipient.
- Count successes.
- Log one delivery attempt per subscription if `notification_delivery_attempts` exists.
- Return `delivered` count to caller.

### Invalid Subscription Cleanup

- If Web Push returns 404 or 410, delete that `push_subscriptions` row or mark `revoked_at`.
- Log attempt status `expired`.
- Do not treat expired endpoints as user-facing errors if at least one device succeeds.

### Retry/Failure Handling

MVP:

- No retry queue.
- Log failure if attempts table exists.
- Return clear sender feedback for nudge:
  - no subscriptions: partner has not enabled notifications.
  - throttled: wait a few minutes.
  - zero delivered due failures: nudge saved, push not delivered.

Future:

- Add retry only for transient 5xx push-service errors.

## 8. Scheduled Reminder Strategy

Scheduled reminders are Phase 23.3. Do not include in 23.1.

### Eligibility

A user is eligible when:

- Has active, unarchived `saving_plans` row.
- Has active revision for current Bangkok date.
- Plan is not paused on the current Bangkok date.
- `notification_preferences.master_enabled = true`.
- `saving_reminders_enabled = true`.
- No deposit has been recorded within the relevant cadence window.
- Dedupe key for this cadence window does not already exist.

### Cadence Rules

Use Asia/Bangkok day boundaries.

- `fixed_daily`: remind roughly once per Bangkok day if no deposit today.
- `increasing_daily`: same as daily.
- `increasing_daily_capped`: same as daily.
- `fixed_weekly`: remind when no deposit exists in the current weekly cadence window. Use the same week boundary helper semantics as saving plan calculations, or define a Monday-Sunday Bangkok week and keep it consistent.
- `fixed_monthly`: remind when no deposit exists in the current Bangkok month.

Reminder cadence should consider:

- Plan creation time for first reminder.
- Future preferred reminder time if implemented later.
- MVP default: run scheduler hourly but only create reminders after a conservative local time, for example 18:00 Bangkok, to avoid morning pressure.

### Pause/Resume Awareness

- If `saving_plan_pauses` has an open pause covering today, skip.
- If pause was same-day resumed and interval is empty, do not skip because `resumed_from = paused_from` has no active paused day.
- Do not create "missed while paused" catch-up reminders.

### Scheduler Options

Preferred deployment:

- Supabase Scheduled Edge Function if available in the project.

Fallback:

- Vercel Cron hitting a Supabase Edge Function endpoint.

Function:

- `scheduled-saving-reminders`
- Runs hourly or once per day.
- Uses service role.
- Computes current Bangkok date/time.
- Queries eligible plans.
- Creates notifications with `saving_reminder_due` dedupe key.
- Sends push only if push preferences/subscriptions allow.

### Throttle

- Daily/increasing: one reminder per user/plan/Bangkok date.
- Weekly: one reminder per user/plan/week key.
- Monthly: one reminder per user/plan/month key.

Quiet hours:

- Deferred unless MVP-simple.
- Do not build custom time picker in Task 23 MVP.

## 9. Service Worker Notification Click

### Push Payload Structure

Use a general payload:

```json
{
  "notification_id": "uuid",
  "event_key": "nudge_received",
  "title": "Art sent a nudge",
  "body": "They are checking in on the shared goal.",
  "url": "/dashboard",
  "fallback_url": "/dashboard"
}
```

Optional:

- `tag`: dedupe visible system notifications by event.
- `renotify`: false by default.

### Click Handling

Required behavior:

1. Close system notification.
2. Resolve `target = payload.url || payload.fallback_url || '/dashboard'`.
3. Sanitize target:
   - must start with `/`
   - must not start with `//`
   - allow only known route prefixes:
     - `/dashboard`
     - `/add`
     - `/check-balance`
     - `/saving-plan`
     - `/manage-project`
     - `/notifications`
4. Find existing window clients.
5. If a client exists:
   - focus it,
   - navigate it to target if supported by `WindowClient.navigate`.
6. If none exist, `openWindow(target)`.
7. If target invalid, open fallback route.

Current `src/sw.ts` should be updated because focusing `allClients[0]` without navigation can leave the user on the wrong screen.

### Mark Clicked

Do not require the service worker to call Supabase.

Preferred:

- Include `notification_id` in URL query only if safe, for example `/dashboard?notification_id=...` is not necessary for MVP.
- App can mark clicked/read when notification center item is tapped.
- Push click mark can be deferred unless routing analytics is needed.

## 10. In-App Notification Center Data Flow

UI dependencies come from `docs/plans/23-notification-ux-ui-spec.md`:

- Dashboard bell needs unread count.
- Notification Center needs paginated list, empty/loading/error, read state.
- Profile settings needs preference/device state.
- Tapping an item needs route/fallback navigation.

### Fetch Notifications

Hook:

- `useNotifications({ limit = 30 })`

Data source:

- Prefer RPC `list_notifications` so archived/read filtering and ordering stay server-controlled.
- Query returns:
  - `id`
  - `event_key`
  - `category`
  - `title`
  - `body`
  - `cta_label`
  - `target_route`
  - `target_section`
  - `fallback_route`
  - `read_at`
  - `created_at`
  - `actor_user_id`
  - `room_id`
  - sanitized `payload`

Pagination:

- MVP: limit 30.
- Add `p_before` for older pages.

### Unread Count

Hook:

- `useUnreadNotificationsCount()`

Data source:

- RPC `unread_notification_count()` or a direct count select with RLS.

Realtime:

- MVP optional.
- If simple, subscribe to `notifications` inserts/updates filtered by `recipient_user_id=auth.uid()`.
- If realtime is noisy or policy-sensitive, refetch on app focus and after known actions.

### Mark Read

RPC:

- `mark_notification_read(p_notification_id uuid)`

Behavior:

- Sets `read_at = coalesce(read_at, now())`.
- Validates recipient.
- Returns updated row or success boolean.

### Mark All Read

Optional MVP.

RPC:

- `mark_all_notifications_read()`

Behavior:

- Sets `read_at` for all unread own rows.
- Do not archive/delete.

### Empty/Error States

System plan only needs to provide:

- Empty list returns `[]`.
- Errors bubble to hook for UI error state.
- No special backend row needed.

## 11. Preferences

Simple preferences are global per user in MVP.

### Controls

- `master_enabled`
- `push_enabled`
- `nudges_enabled`
- `saving_reminders_enabled`
- `partner_activity_enabled`
- `product_updates_enabled` optional

### Defaults

- Master: on.
- Nudges: on.
- Partner activity in-app: on.
- Saving reminders: off until user opts in.
- Push: off until user explicitly enables.
- Product updates: on for in-app, push deferred.

### UI Dependencies

The UX spec expects:

- Browser permission state from `usePushSubscription`.
- Device subscription state from `push_subscriptions`.
- Category preferences from `notification_preferences`.
- Master off disables category controls visually, but does not delete in-app notification history.

### Preference RPCs

`get_notification_preferences()`:

- Auth required.
- Creates default row if missing.
- Returns current row.

`update_notification_preferences(...)`:

- Auth required.
- Updates only own row.
- Allows partial updates.
- Sets `updated_at = now()`.

### Push Permission vs Preference

Keep separate:

- Browser permission: `Notification.permission`.
- Device subscription: row in `push_subscriptions`.
- User push preference: `notification_preferences.push_enabled`.

Examples:

- Permission denied + preferences on: push cannot deliver; in-app can still work.
- Device subscribed + master off: endpoint can exist; push sends are skipped.
- Push unsupported: preferences still load; in-app center still works.

## 12. Copy And Payload Privacy

Copy source:

- Use event-specific server-side templates aligned with `docs/plans/23-notification-ux-ui-spec.md`.
- Do not accept arbitrary title/body from clients for partner-facing events.
- Client can pass source IDs, not final copy.

Push copy:

- Short.
- Safe on lockscreen.
- No shame language.
- No "warning", "overdue", "failed", or aggressive streak copy.

In-app copy:

- Can show slightly more context than push, but still no private notes/storage details.
- Amount and bucket names are okay for partner deposit if this matches current Dashboard activity visibility.

Payload privacy:

- Store sanitized payload only.
- For reconcile, do not include note or storage split.
- For plans, avoid exposing detailed cadence/amount to partner unless product decision approves partner-visible plan details. MVP should use generic "plan updated" copy for partner-facing plan events.

## 13. Throttling / Cooldown

### Nudge

Current:

- 5 minutes per `(from_user, to_user)` in `send-nudge`.

Harden:

- Include `room_id` in throttle key if a user can share multiple rooms later:
  - `(from_user, to_user, room_id, created_at desc)`
- Require `room_id`.
- Create in-app notification even if push skipped due no devices, unless throttled.
- Do not create another nudge notification when throttled.

### Saving Reminder

- Daily/increasing: one per plan per Bangkok date.
- Weekly: one per plan per week key.
- Monthly: one per plan per month key.
- Dedupe through `notifications` unique `(recipient_user_id, dedupe_key)`.
- Skip while paused.

### Partner Activity

MVP:

- One notification per source event.
- Dedupe key prevents duplicates.

Future batching:

- If many deposits happen in 10 minutes, collapse to "Art added 3 deposits."
- Do not batch in MVP unless spam appears during testing.

### No Duplicate Notification Per Event

Use dedupe keys:

- Source table + source id + recipient.
- For state changes without stable source ids, include `updated_at` or a generated event id from RPC.

### Read/Unread

- Marking read must be idempotent.
- Realtime updates must not duplicate rows in client state.

## 14. Implementation Phases

### 23.1 Notification Foundation, Preferences, And In-App Notification Log

Implement:

- Migration for `notifications`.
- Migration for `notification_preferences`.
- Optional migration for `notification_delivery_attempts`.
- Hardening migration for `push_subscriptions` own update policy and timestamps.
- RPCs:
  - `get_notification_preferences`
  - `update_notification_preferences`
  - `list_notifications`
  - `unread_notification_count`
  - `mark_notification_read`
  - `mark_all_notifications_read` if UI includes it
  - event helper for `partner_deposited` or generic validated creation
- Types:
  - `NotificationEventKey`
  - `NotificationCategory`
  - `NotificationItem`
  - `NotificationPreferences`
- Hooks:
  - `useNotifications`
  - `useUnreadNotificationsCount`
  - `useNotificationPreferences`
- UI integration points from UX spec:
  - Dashboard bell
  - Notification center
  - Profile settings row
  - Settings screen

Do not implement broad scheduled push engine in 23.1.

### 23.2 Nudge Hardening And Push Click Routing

Implement:

- Update `send-nudge`:
  - require `room_id`,
  - validate sender/recipient are current room members,
  - validate sender is not recipient,
  - throttle by sender/recipient/room,
  - create `nudge_received` notification row,
  - check recipient preferences,
  - send push to all recipient devices when allowed,
  - return clear `delivered`, `notification_id`, and `error` fields.
- Update `nudges` table if needed:
  - index `(from_user, to_user, room_id, created_at desc)`.
- Update service worker routing:
  - sanitize target,
  - navigate existing client to target,
  - use fallback route.
- Update `usePushSubscription`:
  - expose `permission`,
  - distinguish unsupported, permission denied, granted unsubscribed, subscribed.

### 23.3 Saving Plan Reminders

Implement:

- Scheduled edge function.
- Reminder eligibility query.
- Bangkok date/time handling.
- Pause-aware checks using `saving_plan_pauses`.
- Dedupe keys per cadence window.
- Create in-app notifications first.
- Send push only if preferences and subscription allow.
- Manual admin smoke test command or SQL query for "who would be reminded".

### 23.4 Partner Activity Notifications

Implement in order:

1. Deposits.
2. Balance checks.
3. Plan change/pause/resume.
4. Goal change.
5. Room joined/left.
6. Bucket added/updated.

Recommended event creation approach:

- Deposits: after `useLogs.insert` succeeds, call `notify_partner_deposit(p_log_id uuid)`. The RPC validates source log and recipient.
- Balance check: after `create_balance_checkpoint` succeeds, call `notify_balance_checked(p_checkpoint_id uuid)` or add notification creation to the existing RPC only if failures cannot block checkpoint creation.
- Saving Plan/Goal changes: add non-blocking follow-up RPC calls after existing RPC success. Avoid modifying existing critical RPCs until notification helpers are proven.
- Room leave: eventually move leave into an RPC if partner notification is required after membership deletion.

### 23.5 Smart Events

Implement later:

- Overtaking/progress race milestone.
- Bucket goal reached.
- Streak milestones.

Rules:

- Use once-per-threshold dedupe.
- Use positive copy only.
- Avoid frequent rank-change spam.

### 23.6 Polish

Implement later:

- Quiet hours.
- Batching.
- Cleanup jobs.
- Delivery monitoring.
- Rich push actions.
- Notification retention cleanup.
- Product update notifications if replacing current release modal.

## 15. Claude Implementation Handoff

### What To Implement First

Start with 23.1 only:

1. Add notification foundation migration.
2. Add preferences migration/RPCs.
3. Add notification list/count/read RPCs.
4. Add TypeScript types and hooks.
5. Wire Dashboard bell and Notification Center using the UX spec.
6. Add Profile settings entry and settings data flow.
7. Add one safe event creator, preferably `partner_deposited` in-app only, after deposit success.

Then implement 23.2 nudge hardening.

### Files Likely To Touch

Schema/RPC:

- `supabase/migrations/0037_notifications.sql` or next available number.
- Optional later: `supabase/migrations/0038_notification_event_helpers.sql`.

Edge functions:

- `supabase/functions/send-nudge/index.ts`
- Later: `supabase/functions/send-notification/index.ts`
- Later: `supabase/functions/scheduled-saving-reminders/index.ts`

Client:

- `src/types/index.ts`
- `src/hooks/useNotifications.ts`
- `src/hooks/useNotificationPreferences.ts`
- `src/hooks/usePushSubscription.ts`
- `src/lib/notifications.ts`
- `src/sw.ts`
- UI files listed in `docs/plans/23-notification-ux-ui-spec.md`
- `src/hooks/useLogs.ts` or `src/pages/AddMoney.tsx` for non-blocking partner deposit notification call
- `src/components/NudgeButton/NudgeButton.tsx`

### Migrations Likely To Add

One foundation migration should include:

- `notifications`
- `notification_preferences`
- `notification_delivery_attempts` if included in MVP
- push subscription update policy/timestamps
- RPCs for preferences/list/count/read

Keep event-specific helper RPCs in the same migration only if small. Otherwise split into a second migration.

### Hooks Likely To Add

- `useNotifications`
- `useUnreadNotificationsCount`
- `useNotificationPreferences`

Update:

- `usePushSubscription` to expose permission/device states.

### Edge Functions Likely To Touch

- `send-nudge` first.
- Do not create scheduled reminder edge function until 23.3.

### Hard Limits

- Do not change `savings_logs.amount > 0`.
- Do not add negative logs, transfers, withdrawals, or Task 24 correction behavior.
- Do not expose reconcile notes/storage details.
- Do not send push without opt-in.
- Do not create notifications without target/fallback route.
- Do not let notification failure block deposit/check balance success.
- Do not install new libraries.
- Do not add a Notification bottom tab.

### Tests/Build/Lint

After implementation:

- Run `npm run build`.
- Run `npm run lint` when practical.
- Add SQL/RPC smoke tests where feasible:
  - own user can list own notifications,
  - partner cannot read another user's notification row,
  - duplicate dedupe key does not create duplicates,
  - mark read only works for recipient.
- Edge function manual test for nudge.

## 16. Acceptance Criteria

- In-app notifications are visible only to `recipient_user_id`.
- User cannot create arbitrary notifications for another user from the client.
- Unread count works and matches unread rows.
- Mark read works and is idempotent.
- Mark all read works if implemented.
- Tapping notification navigates to target route or fallback route.
- No notification row can have an empty target route.
- Push nudge still works or is clearly deferred behind in-app nudge row.
- Nudge validates room membership and cannot target a non-partner outside the room.
- Sender receives clear feedback if partner has no push enabled.
- Push is never sent when master/push/category preference blocks it.
- In-app notification center still works without push permission.
- No private reconcile note or storage detail is stored in notifications or push payload.
- No duplicate notification is created for the same source event/recipient.
- Deposit flow remains fast and succeeds even if notification creation fails.
- Check Balance flow remains fast and succeeds even if notification creation fails.
- Build passes.
- Lint passes when practical.
- Two-user manual test passes.

## 17. Manual Test Plan

### Enable Permission

1. Open Notification Settings.
2. Tap enable device.
3. Grant browser permission.
4. Verify `push_subscriptions` has one row for user/device.
5. Verify UI shows subscribed/on-this-device state.

### Deny Permission

1. Reset site permission.
2. Tap enable device.
3. Deny browser permission.
4. Verify no subscription row is created.
5. Verify UI shows blocked state and in-app notifications still load.

### Nudge

1. User A and User B are in the same room.
2. User B enables push on one device.
3. User A sends nudge.
4. Verify User B gets in-app `nudge_received`.
5. Verify User B gets push when preferences allow.
6. Tap push and confirm target opens `/dashboard`.
7. Repeat within cooldown and verify throttled response and no duplicate notification.

### Partner Deposit

1. User A logs deposit.
2. Deposit succeeds normally.
3. User B receives in-app partner deposit notification.
4. User A does not receive a self partner-deposit notification unless system explicitly creates self history.
5. User B taps item and lands on Dashboard/activity fallback.

### Saving Reminder Eligibility

1. User has daily plan and reminders enabled.
2. No deposit today in Bangkok time.
3. Run scheduled reminder function in dry-run/test mode.
4. Verify one eligible notification.
5. Run again and verify dedupe prevents duplicate.

### Pause-Aware Reminder

1. User pauses plan.
2. Run reminder scheduler.
3. Verify no reminder created.
4. Resume same day.
5. Verify future eligibility follows `[paused_from, resumed_from)` semantics.

### Tap Notification Route

1. Create notifications for each MVP target:
   - `/dashboard`
   - `/add`
   - `/saving-plan`
   - `/manage-project`
   - `/check-balance`
2. Tap from center and verify route.
3. Send push with each safe route and verify service worker navigation.

### Multiple Devices

1. User B subscribes on two browsers/devices.
2. User A sends nudge.
3. Verify delivery attempts for both devices.
4. Verify one in-app notification row for recipient, not one per device.

### Invalid Subscription

1. Insert or simulate expired subscription.
2. Send nudge.
3. Verify 404/410 response deletes or revokes subscription.
4. Verify other valid devices still receive push.

### Unread/Read States

1. Create two notifications.
2. Verify unread count is 2.
3. Mark one read.
4. Verify unread count is 1.
5. Mark all read.
6. Verify unread count is 0 and list still shows read history.

## 18. Release Risks

- Browser/PWA support differs across Chrome, iOS Safari, Android, and installed vs non-installed PWA contexts.
- Browser permission denial is sticky and cannot be fixed by repeated app prompts.
- Existing service worker click behavior may focus the app without route navigation unless updated carefully.
- Notification spam risk if partner activity triggers are too broad or not deduped.
- Lockscreen privacy risk if push payload contains amounts, reconcile differences, notes, or storage details.
- Scheduler reliability depends on Supabase Scheduled Functions or Vercel Cron deployment.
- Edge function deployment requires VAPID secrets and service-role key availability.
- Existing `push_subscriptions` upsert may need update RLS before subscription refresh works reliably.
- Direct deposit inserts mean notification creation can be forgotten unless helper calls are added and tested.
- Room leave notifications are tricky because membership deletion can remove recipient/actor context; defer or convert leave to RPC.
- Realtime notification updates can behave differently under RLS; polling/refetch fallback should remain.
- Push delivery failures can be noisy; MVP should log but not over-alert users.
