# Task 30 — Plan-start push notification

Status: Planning only. No code, migrations, or file edits in this document.
Owner: Senior FE/FS pair (Claude) with Fran.
Source: `docs/multi-user-room-feature-plan.md` — Feature 1 (Plan-start push notification).
Date drafted: 2026-05-20.

Decision A (from feature plan) is resolved up-front for v1:

- Reuse the existing `saving_reminders_enabled` preference and the existing
  `'saving_reminder'` notification category.
- Do **not** add `plan_lifecycle_enabled`.
- Do **not** add a new notification category.

Rationale: the plan-start notification is conceptually a one-shot
saving-plan reminder, fits cleanly under the existing toggle, and avoids a
preference-schema / settings-UI change for v1. Reversible later if users
want a dedicated toggle.

---

## 1. Goal

When a user creates a saving plan whose earliest revision has
`effective_from_date` strictly in the future, the app must automatically
deliver:

- one **in-app** notification (row in `public.notifications` with
  `event_key = 'plan_started'`), and
- one **Web Push** delivery (when the user has `push_enabled = true` and an
  active subscription),

to the **owner only**, on the Bangkok-local morning of that revision's
`effective_from_date`. The notification routes to `/saving-plan`.

Exactly one delivery per (plan, start date). Same-day plan creation does
**not** trigger `plan_started` (the existing partner-facing `plan_created`
flow already covers that case for the partner; the owner does not need a
self-notification on a plan that started the same day they made it).

## 2. Non-goals

The following are explicitly out of scope and must not be touched in this
task:

- Multi-user rooms / capacity raise (Feature 2).
- Rename room (Feature 4 — already shipped under task 29).
- Member detail view (Feature 3).
- Individual sub-goals under a room goal (Feature 5).
- Adding `plan_lifecycle_enabled` or a `plan_lifecycle` category.
- Re-firing `plan_started` on later revisions that shift the start date
  (only the **earliest** revision's start date is considered).
- Anything that changes the existing `enqueue_saving_plan_reminders`
  eligibility logic, copy, dedupe key, or 18:00 gate.
- Anything that changes `notify_plan_created` (partner-facing,
  unchanged).
- Bangkok timezone refactor; the 'Asia/Bangkok' literal already used
  across the migrations stays.
- New i18n locales beyond EN + TH.
- Visual changes to `SavingPlanCard` or any other page (no "Plan starts
  in N days" pill in this task — defer).

## 2a. Pre-flight verifications

These must be confirmed before any code is written. They do not change the
design; they catch the design's failure modes early.

1. **Production cron cadence.** Verify that the production scheduler
   invokes `scheduled-saving-reminders` at least once inside the
   [07:00, 10:00) Bangkok window every day. Today the function is
   expected to run hourly; confirm this against the actual deployed
   schedule (Supabase Scheduled Functions config, Vercel Cron, or
   whatever currently drives it). If the cadence is coarser than once
   per hour, the plan-start RPC may miss the window on some days and
   we must adjust the schedule **before** shipping. Do not implement
   until the cadence is confirmed adequate.

2. **Schema audit of the saving-plan revision model.** Before writing
   the migration SQL, re-read at minimum:
   - `0030_saving_plans.sql` — the `saving_plans` and
     `saving_plan_revisions` table definitions, the active-plan unique
     index (`uq_saving_plans_active_per_user_room`), the `archived_at`
     semantics, and the `rule_type` check constraint.
   - `0048_relax_change_plan_backdate_guard.sql` — current behavior of
     `change_saving_plan` around effective dates.
   - `0052_change_plan_supersede_unborn_revisions.sql` — confirms that
     superseding a pending revision is implemented as a **hard
     DELETE** of every `effective_from_date > today` row, not a
     soft-delete flag. There is no `superseded_at` column on
     `saving_plan_revisions`.
   - `0046_fix_saving_reminder_eligibility.sql` — the canonical
     `rule_type` whitelist (`fixed_daily`, `fixed_weekly`,
     `fixed_monthly`, `increasing_daily`, `increasing_daily_capped`).
     The plan-start RPC must use the same whitelist verbatim so a new
     rule type cannot silently slip through.

   The audit must confirm all of the following, in writing in the
   migration's header comment, before the function body is finalized:

   - The plan's "start date" for the purpose of `plan_started` is the
     `effective_from_date` of the **earliest non-deleted** revision
     belonging to a non-archived plan. Because 0052 hard-deletes
     unborn future revisions on every `change_saving_plan`, the
     earliest surviving revision is always the active/current root
     and is never an obsolete superseded row.
   - The `saving_plans.archived_at is null` filter is sufficient to
     exclude archived plans; there is no per-revision archive flag.
   - The CTE must select with `distinct on (r.plan_id)` ordered by
     `effective_from_date asc, created_at asc` so the tiebreaker is
     deterministic if two revisions share the same date.
   - The `rule_type` whitelist matches 0046 exactly. If 0046 is later
     extended (e.g. a new rule), the plan-start RPC must be updated
     in lockstep.

   If the audit surfaces any contradiction with the §4 design (e.g.
   a future migration adds a `superseded_at` column, or pauses gain a
   pre-start variant), pause and re-plan rather than coding around it.

## 3. Affected files

DB (additive only):

- New migration `supabase/migrations/00XX_plan_start_notifications.sql`
  (number assigned during implementation — after the latest, currently
  `0053_rename_room.sql`). Adds one new RPC; does **not** modify any
  existing RPC.

Edge function (one extra RPC call):

- `supabase/functions/scheduled-saving-reminders/index.ts` — extend the
  existing handler to also call `enqueue_plan_start_notifications()`
  after the existing `enqueue_saving_plan_reminders()` call, reusing the
  same VAPID setup, the same per-recipient prefs/subscription lookups,
  the same delivery-attempts batch insert, and the same route allow-list.

Client:

- `src/types/index.ts` — add `'plan_started'` to `NotificationEventKey`.
- `src/i18n/notificationCopy.ts` — add a `case 'plan_started':` branch.
- `src/i18n/locales/en.ts` and `src/i18n/locales/th.ts` — add a
  `planStarted` entry under `notifications.events`.
- `src/lib/notifications.ts` — add `'plan_started'` to the
  `notificationIconKind` switch (returns `'calendar'`, matching the
  other plan-* events).

Existing files that need a read pass but no edits:

- `src/components/Notifications/NotificationListItem.tsx` — confirm new
  `event_key` routes through `notificationDisplayCopy` automatically
  (no per-event switch needed for v1).
- `supabase/migrations/0037_notifications.sql` — confirms the
  `(recipient_user_id, dedupe_key)` unique constraint, the
  `category` check constraint, and the `target_route` /
  `fallback_route` non-empty checks.
- `supabase/migrations/0046_fix_saving_reminder_eligibility.sql` —
  authoritative reference for the structure of the eligibility CTE
  pattern we will mirror.

## 4. DB / RPC design

One new function only: `enqueue_plan_start_notifications()`.

Signature, mirroring the existing `enqueue_saving_plan_reminders()` so
the edge function can treat them uniformly:

```sql
create or replace function public.enqueue_plan_start_notifications()
returns table (
  notification_id   uuid,
  recipient_user_id uuid,
  plan_id           uuid,
  room_id           uuid,
  start_date        date
)
language plpgsql
security definer
set search_path = public
```

Inside the function:

1. Compute Bangkok local clock from `now() at time zone 'Asia/Bangkok'`:
   - `v_today date` = the Bangkok-local date.
   - `v_hour int` = the Bangkok-local hour (0–23).

2. Apply the morning time gate: `if v_hour < 7 or v_hour >= 10 then
   return; end if;`. Inclusive lower bound, exclusive upper bound, so
   the window is [07:00, 10:00) Bangkok. Matches the feature doc
   "07:00–10:00".

3. Find each active plan's **earliest surviving** revision and use it as
   the start marker. Per the §2a audit, this is the current/active
   start root — `change_saving_plan` hard-deletes any unborn future
   revision before inserting a new one (migration 0052), so there is
   no superseded row to filter out.

   ```sql
   with first_revisions as (
     select distinct on (r.plan_id)
       r.plan_id,
       p.user_id,
       p.room_id,
       r.effective_from_date,
       r.rule_type,
       p.created_at as plan_created_at
     from public.saving_plan_revisions r
     join public.saving_plans p on p.id = r.plan_id
     where p.archived_at is null
       -- Canonical rule_type whitelist, must match
       -- 0046_fix_saving_reminder_eligibility.sql verbatim. Any
       -- future rule type has to be added intentionally in both
       -- RPCs in lockstep (see §2a audit).
       and r.rule_type in (
         'fixed_daily',
         'fixed_weekly',
         'fixed_monthly',
         'increasing_daily',
         'increasing_daily_capped'
       )
     order by r.plan_id, r.effective_from_date asc, r.created_at asc
   )
   ```

   The `distinct on` plus `order by ... asc, created_at asc` picks the
   single earliest revision per plan, with `created_at` as a stable
   tiebreaker if two revisions somehow share the same
   `effective_from_date`. The `rule_type in (...)` filter mirrors
   migration 0046 exactly so the two enqueue RPCs cannot drift on
   which rule types are considered valid saving-plan cadences.

4. Filter to plans whose start is today **and** that were created before
   today:

   ```sql
   , due_today as (
     select fr.*
     from first_revisions fr
     where fr.effective_from_date = v_today
       and (fr.plan_created_at at time zone 'Asia/Bangkok')::date < v_today
   )
   ```

   This implements the rule "same-day plan creation must not fire
   `plan_started`".

5. Honor user preferences. Same coalesce defaults as the post-0046
   saving-reminder eligibility:

   ```sql
   , eligible_recipients as (
     select dt.*
     from due_today dt
     left join public.notification_preferences prefs
       on prefs.user_id = dt.user_id
     where coalesce(prefs.master_enabled, true)
       and coalesce(prefs.saving_reminders_enabled, true)
   )
   ```

   A missing prefs row defaults to opted-in, matching migration 0046's
   intent.

6. Insert one notification per eligible plan:

   ```sql
   , inserted as (
     insert into public.notifications (
       recipient_user_id, actor_user_id, room_id, event_key, category,
       channel_policy, title, body, cta_label,
       target_route, target_section, fallback_route, push_safe,
       payload, source_table, source_id, dedupe_key
     )
     select
       er.user_id,
       null,                                   -- system-generated
       er.room_id,
       'plan_started',
       'saving_reminder',                      -- reuse category per Decision A
       'push_candidate',
       'Your saving plan starts today',
       'Your saving plan starts today. Record your first deposit when you''re ready.',
       'Open plan',
       '/saving-plan',
       null,
       '/saving-plan',
       true,
       jsonb_build_object(
         'plan_id', er.plan_id,
         'rule_type', er.rule_type,
         'start_date', to_char(er.effective_from_date, 'YYYY-MM-DD')
       ),
       'saving_plans',
       er.plan_id,
       'plan_started:' || er.plan_id::text || ':' || to_char(er.effective_from_date, 'YYYY-MM-DD')
     from eligible_recipients er
     on conflict (recipient_user_id, dedupe_key) do nothing
     returning
       notifications.id,
       notifications.recipient_user_id,
       (notifications.payload ->> 'plan_id')::uuid,
       notifications.room_id,
       (notifications.payload ->> 'start_date')::date
   )
   select * from inserted;
   ```

   Notes:
   - `category = 'saving_reminder'` keeps the existing category-check
     constraint happy without any migration churn.
   - `push_safe = true` so the edge function will push for users who have
     enabled push.
   - The DB stores plain-English title/body. The client renders
     localized copy via `notificationCopy.ts` (see §6); the DB columns
     act as the fallback when the locale layer has no entry for an
     event.
   - `actor_user_id = null` because the system, not another user, fires
     this notification. The owner is `recipient_user_id`.

7. Grants:

   ```sql
   revoke all on function public.enqueue_plan_start_notifications() from public;
   revoke all on function public.enqueue_plan_start_notifications() from authenticated;
   grant execute on function public.enqueue_plan_start_notifications() to service_role;
   ```

   Service-role only. Clients must not be able to trigger this on
   demand.

No new tables, no new columns, no new triggers. The existing
`notifications.notifications_recipient_dedupe_unique` constraint provides
the dedupe guarantee.

## 5. Dedupe strategy

- Per-(plan, start_date) dedupe key: `'plan_started:<plan_id>:<YYYY-MM-DD>'`.
- The recipient is implicit in the unique constraint
  `(recipient_user_id, dedupe_key)` from migration 0037. Including the
  recipient in the key would be redundant.
- `start_date` is rendered with `to_char(... 'YYYY-MM-DD')` — a stable,
  timezone-agnostic ISO date that already matches how the saving plan
  revisions store `effective_from_date`.
- Re-running the cron within the [07:00, 10:00) window on the same day
  inserts zero new rows because the dedupe key already exists.
- If a future revision changes the plan's start date, we do **not**
  re-fire (out of scope per §2). The dedupe is keyed on the **earliest**
  revision's date, which is what the eligibility CTE selects.

Edge case: if a plan is archived after the first revision but before
`plan_started` fires, `archived_at is null` filter drops it from
`first_revisions` and no notification is created. Correct behavior.

## 6. Notification copy + i18n

`src/types/index.ts` — add `'plan_started'` to `NotificationEventKey`:

```ts
export type NotificationEventKey =
  | 'nudge_received'
  | 'saving_reminder_due'
  | 'plan_started'          // ← new
  | 'partner_deposited'
  | ...
```

`src/i18n/notificationCopy.ts` — add a switch branch above the
`default:` case:

```ts
case 'plan_started':
  return withStoredFallback(item, n.events.planStarted());
```

`src/i18n/locales/en.ts` — add a `planStarted` entry under
`notifications.events`:

```ts
planStarted: () => ({
  title: 'Your saving plan starts today',
  body: 'Record your first deposit when you''re ready.',
  ctaLabel: 'Open plan',
}),
```

`src/i18n/locales/th.ts` — Thai equivalent:

```ts
planStarted: () => ({
  title: 'แผนเก็บเงินของคุณเริ่มวันนี้',
  body: 'บันทึกยอดเก็บได้เมื่อคุณสะดวก',
  ctaLabel: 'ดูแผน',
}),
```

(Final Thai wording reviewed by Fran during implementation; the strings
above are the proposal.)

`src/lib/notifications.ts` — extend `notificationIconKind`:

```ts
case 'saving_reminder_due':
case 'plan_changed':
case 'plan_paused':
case 'plan_resumed':
case 'plan_created':
case 'plan_started':        // ← new
  return 'calendar';
```

No new toggle row in Notification Settings (Decision A): the existing
"Saving reminders" toggle (`saving_reminders_enabled`) gates this
event, and the existing description copy under that toggle is
**reused unchanged for v1** — no string updates in
`NOTIFICATION_CATEGORY_COPY` or its locale equivalents.

## 7. Edge function integration

`supabase/functions/scheduled-saving-reminders/index.ts` extends the
existing handler. The cron contract, secret check, cleanup calls, VAPID
setup, route allow-list, and delivery-attempts batch insert all stay
identical.

The change is additive:

1. After the existing `enqueue_saving_plan_reminders()` RPC call and
   its push-loop, invoke the new RPC:

   ```ts
   const { data: planStartData, error: planStartErr } =
     await admin.rpc('enqueue_plan_start_notifications');
   ```

   Treat an error as non-fatal: log to `summary.errors` and continue,
   matching the cleanup-RPC behavior already in the file.

2. The returned shape is the same five columns as `EnqueuedRow` but
   with `start_date: string` in place of `cadence`/`period_key`. Define
   a sibling interface:

   ```ts
   interface PlanStartRow {
     notification_id: string;
     recipient_user_id: string;
     plan_id: string;
     room_id: string | null;
     start_date: string; // 'YYYY-MM-DD'
   }
   ```

3. **Make the plan-start push path independent of the saving-reminder
   result.** The current handler short-circuits with
   `if (created.length === 0) return jsonResponse(summary);` after the
   reminders RPC. That early return must be removed (or skipped) so
   the plan-start RPC is always invoked. Restructure the handler so
   that:

   - both RPCs are called (reminders first, then plan-start), errors
     on either logged into `summary.errors` without aborting the
     other;
   - the **union** of `recipient_user_id` from both result sets is
     computed (`Array.from(new Set([...reminderIds, ...planStartIds]))`);
   - `pushEnabledFor` and `subsFor` are fetched in one round trip per
     map against that union, even when the reminders set is empty;
   - the push loop runs over the concatenation of both notification
     lists, using the same `pushEnabledFor` / `subsFor` lookups for
     both event types.

   Equivalent alternative if it keeps the diff smaller: fetch
   prefs/subscriptions independently for plan-start recipients (a
   second `.in('user_id', planStartRecipientIds)` call against each
   table) and merge into the existing maps before the plan-start push
   loop. Either approach is acceptable; both must demonstrably deliver
   a push for a plan-start recipient who is **not** in the reminder
   recipient set.

   Keep the rest of the push loop identical; the per-notification
   `payload` becomes:

   ```ts
   const payload = JSON.stringify({
     notification_id: note.notification_id,
     event_key: 'plan_started',
     title: 'Your saving plan starts today',
     body: 'Record your first deposit when you''re ready.',
     url: safeUrl,
     fallback_url: safeFallback,
     tag: `plan_started:${note.plan_id}:${note.start_date}`,
   });
   ```

4. Extend the `RemindersSummary` shape with a `plan_starts_created`
   counter for visibility from manual cron runs (the rest —
   `push_attempted` / `push_delivered` / `push_skipped_*` /
   `errors` — should accumulate across both sources so the existing log
   line still summarizes everything in one place).

   ```ts
   interface RemindersSummary {
     // existing fields...
     plan_starts_created: number;
   }
   ```

5. No change to the secret check, the 405 method gate, or the cleanup
   RPC calls. Saving-reminders eligibility still runs unchanged at
   ≥ 18:00 Bangkok; plan-start eligibility runs unchanged at
   [07:00, 10:00) Bangkok. Both RPCs are called on every tick; each
   one returns an empty rowset when its own time gate is closed, so
   the two windows do not interfere.

## 8. Permissions / RLS

- No RLS changes on `notifications` — existing `notifications_select_own`
  + per-recipient unique constraint cover both read and dedupe.
- No new client-callable RPC. `enqueue_plan_start_notifications()` is
  service-role only, identical to the saving-reminder RPC.
- The owner is the recipient; the notification body never references
  another user, so there is no cross-user data leak surface.

## 9. UX behavior

- Notification Center shows the new row using the localized copy from
  §6. The list item icon is the calendar icon (same family as other
  plan events).
- Tapping the in-app row routes to `/saving-plan` via the standard
  `resolveNotificationTarget` path (already covered by the existing
  allow-list).
- Push payload uses the same `tag` shape as `saving_reminder_due` so
  the service worker dedupes the OS-level notification within the
  same day (the unique constraint already prevents a duplicate
  in-app row).
- The notification text does **not** show amounts, bucket names, or
  partner info. The body is intentionally generic — owner-only,
  one-shot.

## 10. Implementation steps

1. Read the active CLAUDE.md (already in context) and confirm no
   product rules block this addition.
2. **Pre-flight (§2a)** — verify the production cron cadence covers
   [07:00, 10:00) Bangkok; complete the schema audit and write its
   conclusions into the migration's header comment. Do not proceed
   until both are signed off.
3. **DB migration** — write `00XX_plan_start_notifications.sql` with
   the RPC from §4 and §5. Use `begin; ... commit;` like other
   notification migrations. No alterations to existing objects.
4. **Edge function** — extend `scheduled-saving-reminders/index.ts`
   per §7, keeping the diff minimal:
   - remove the `if (created.length === 0) return ...` early exit so
     the plan-start path always runs,
   - new `PlanStartRow` interface,
   - new `summary.plan_starts_created` counter,
   - additive RPC call + push loop,
   - prefs/subscription maps built from the **union** of reminder
     and plan-start recipients (or fetched independently for the
     plan-start set; see §7 step 3).
5. **Types** — add `'plan_started'` to `NotificationEventKey`.
6. **Locale + copy** — add `planStarted` entries to `en.ts` and `th.ts`,
   and the `case 'plan_started'` branch in `notificationCopy.ts`.
7. **Icon** — extend the `notificationIconKind` switch.
8. Run `npm run build`.
9. Run `npm run lint` if practical.
10. Manual QA per §12.
11. Deploy migration; deploy edge function.

## 11. Acceptance criteria

- A plan created today with `effective_from_date = today + 5` and the
  owner opted-in (`saving_reminders_enabled = true`, `master_enabled =
  true`) causes:
  - exactly one in-app `plan_started` notification on day +5, with a
    Bangkok-local `created_at` somewhere in [07:00, 10:00); and
  - exactly one push delivery if the user has `push_enabled = true` and
    at least one valid `push_subscriptions` row.
- A plan created today with `effective_from_date = today` does **not**
  trigger `plan_started`. The owner sees no plan_started notification.
  (The partner still receives the existing `plan_created` via
  `notify_plan_created`, unchanged.)
- A plan created yesterday with `effective_from_date = today` **does**
  trigger `plan_started` today (within the 07:00–10:00 window).
- Re-running the cron at 07:30, 08:30, and 09:30 on the start day
  produces exactly one row total per plan (dedupe).
- A user with `master_enabled = false` receives nothing (neither in-app
  nor push) regardless of `saving_reminders_enabled`.
- A user with `saving_reminders_enabled = false` receives nothing,
  matching Decision A.
- A user with `push_enabled = false` but the master + reminders toggles
  on receives the in-app row, no push.
- A user with no `push_subscriptions` row receives the in-app row, no
  push, and `summary.push_skipped_no_devices` increments.
- Archived plans never produce a `plan_started` notification.
- Plans with a later revision that shifts the start to a different date
  still fire `plan_started` only on the **earliest** revision's date
  (v1 contract — see §2).

## 12. Manual QA checklist

Pre-conditions: a logged-in test user with `push_enabled = true`,
`saving_reminders_enabled = true`, at least one push subscription, and
an active room. A second test user for the negative cases.

DB seeding helpers (paste into Supabase SQL editor; never check in):

```sql
-- Force a plan whose start is "today" in Bangkok but whose creation is
-- "yesterday in Bangkok". Adjust IDs as appropriate.
update public.saving_plans
   set created_at = now() - interval '2 days'
 where id = '<plan_id>';
update public.saving_plan_revisions
   set effective_from_date = ((now() at time zone 'Asia/Bangkok')::date)
 where plan_id = '<plan_id>';
```

To force-run the cron at an in-window Bangkok time during local dev,
temporarily widen the gate in the RPC to `0..24` and invoke the edge
function with the cron secret; revert before commit. Alternatively, set
the host clock by deploying to a Vercel preview at the right wall-clock
moment.

Cases:

- [ ] Seed a future-start plan (effective_from_date = today + 1 in
      Bangkok). Verify **no** `plan_started` notification exists in the
      `notifications` table before the start day.
- [ ] On the start day morning, trigger the edge function (cron, manual
      POST, or scheduled tick). Verify exactly one in-app row and one
      push.
- [ ] Tap the in-app row → routes to `/saving-plan`.
- [ ] Re-run the edge function within the window → no duplicate row,
      `push_attempted` may grow but no new in-app row inserted
      (verify via `select count(*) from notifications where event_key
      = 'plan_started' and ...`).
- [ ] Disable `master_enabled` on the recipient → run edge function →
      no row created.
- [ ] Enable master, disable `saving_reminders_enabled` → no row
      created.
- [ ] Enable both toggles but disable `push_enabled` → in-app row
      created, push not attempted, `push_skipped_no_prefs` increments.
- [ ] Enable everything but delete all `push_subscriptions` rows for
      the user → in-app row created, `push_skipped_no_devices`
      increments.
- [ ] Create a same-day plan (effective_from_date = today, plan
      created_at = today) → no `plan_started`.
- [ ] Run the cron at 06:30 Bangkok and at 10:30 Bangkok → no rows
      created in either case (out-of-window).
- [ ] Switch UI language to TH → confirm the in-app row renders the
      Thai title/body/CTA from §6.
- [ ] Archive a future-start plan before the start day arrives → no
      `plan_started` ever fires for that plan.
- [ ] With multiple plans starting the same day (e.g. two rooms, same
      user), confirm one notification per plan, both dedupe keys
      distinct.
- [ ] Force `enqueue_saving_plan_reminders` to return zero rows (e.g.
      run the cron inside [07:00, 10:00) Bangkok, when the 18:00
      reminder gate is closed) while at least one plan is due to
      start today. Verify the plan-start notification is still
      created **and** the push is delivered — i.e. the edge function
      no longer short-circuits on the empty reminders result, and
      prefs/subscriptions are looked up for the plan-start recipient
      regardless of the reminder set.

## 13. Risk level

**Low.**

- Additive migration only (one new RPC, no schema change, no policy
  change).
- Edge function diff is small (one extra RPC call + a sibling push
  loop reusing the existing maps).
- Reuses existing preference toggles, push transport, dedupe
  constraint, and route allow-list.
- All eligibility logic and the time gate live in SQL, not in the
  edge function, matching the existing pattern from migration 0046.

The only meaningful surface is the i18n addition; a typo there is a
cosmetic regression at worst.

## 14. Rollback notes

- **DB**: the migration is purely additive. Rollback = a follow-up
  migration that runs `drop function if exists
  public.enqueue_plan_start_notifications();`. Any `plan_started` rows
  already inserted into `notifications` are harmless and can be left in
  place, archived, or removed via the existing
  `cleanup_old_notifications` retention RPC.
- **Edge function**: redeploy the previous version (no plan-start RPC
  call) to stop further inserts. The function still works correctly
  with the old payload shape; it ignores the rows already in the DB.
- **Client**: revert the type/i18n/notifications.ts changes. Any
  `plan_started` rows that arrive after revert render via the
  `withStoredFallback` default path using the DB-stored English
  title/body, so the in-app surface degrades gracefully rather than
  breaking.
- No data migration or backfill required in either direction.

## 15. Resolved decisions

All previous open questions are closed for v1:

- **EN copy** (locked):
  - title: `Your saving plan starts today`
  - body: `Record your first deposit when you're ready.`
  - ctaLabel: `Open plan`
- **TH copy** (locked):
  - title: `แผนเก็บเงินของคุณเริ่มวันนี้`
  - body: `บันทึกยอดเก็บได้เมื่อคุณสะดวก`
  - ctaLabel: `ดูแผน`
- **Time window** (locked): `[07:00, 10:00)` Bangkok — inclusive 07:00,
  exclusive 10:00. Encoded directly in the RPC's time gate.
- **Settings copy** (locked): reuse the existing "Saving reminders"
  toggle description verbatim. No string change in
  `NOTIFICATION_CATEGORY_COPY` or its locale entries for v1.
- **Cron cadence** (gating pre-flight, see §2a): must be verified to
  fire at least once inside the [07:00, 10:00) Bangkok window in
  production before this task starts implementation. If the current
  schedule does not satisfy that, fix the schedule first.

Out of scope for v1 (revisit only if asked): dedicated
`plan_lifecycle_enabled` toggle, dedicated category, "Plan starts in
N days" UI pill, re-firing on shifted future revisions.
