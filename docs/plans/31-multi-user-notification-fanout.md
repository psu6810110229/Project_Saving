# Task 31 — Multi-User Notification Fan-Out (N-safe partner notifications)

Status: Planning only. No code, migrations, or file edits in this document.
Owner: Senior FE/FS pair (Claude) with Fran.
Source: `docs/multi-user-room-feature-plan.md` (Feature 2 only) + `docs/plans/feature-2-multi-user-rooms-audit.md`.
Date drafted: 2026-05-20. Patched: 2026-05-20.

This task is one slice of Feature 2 (multi-user rooms). It does **not** raise the room cap. It makes most "partner activity" notification paths structurally safe to send to N − 1 recipients while preserving the current 2-user behaviour exactly.

This slice covers fan-out for: `notify_partner_deposit`, `notify_balance_checked`, `notify_plan_created`, `notify_plan_changed`, `notify_plan_paused`, `notify_plan_resumed`, `notify_goal_changed`, `notify_room_joined`, `notify_room_left`, `notify_bucket_added`, `notify_bucket_updated`, `_smart_check_goal_reached`, plus the `notify-partner-deposit` edge function.

`_smart_check_overtaking` is **not touched** in this slice. Its N-player crossing semantics (did the actor pass one or more members, and who gets notified?) is a product question that requires its own design, so it is left exactly as it is today and tracked as a follow-up. When the cap is later raised from 2 to 7, that helper will need a separate task; nothing else on this surface will.

---

## 1. Goal

- Replace every single-recipient `_other_room_member(...)` usage inside the `notify_*` RPCs listed above (and inside `_smart_check_goal_reached`) with an explicit loop over all other current room members.
- Make `notify_partner_deposit` and its companion edge function `notify-partner-deposit` fan out push delivery per recipient.
- Keep per-recipient preference gating (`master_enabled` + `partner_activity_enabled` + `push_enabled`) and per-recipient dedupe (`(recipient_user_id, dedupe_key)`) intact.
- Preserve the current 2-user user experience byte-for-byte: same number of notifications, same copy, same routing, same push behaviour, including for `_smart_check_overtaking` (which is unchanged in this slice).
- Stay strictly inside the SQL + edge-function layer. Do not touch the room-capacity trigger, the join RPC, the client hooks, the Dashboard, DataContext, goals, sub-goals, or Task 30 (`scheduled-saving-reminders` / `plan_started`).

## 2. Non-goals

The following are explicitly out of scope and must not be touched in this task:

- Raising the room capacity (2 → 7). The trigger `enforce_two_player_cap` (0023) and the RPC `join_room_by_code` (0024) stay exactly as they are.
- Changing the meaning of `goals.target_amount`, room goals, or introducing per-member sub-goals (Feature 5).
- Member detail page (Feature 3) and any UI surface decisions about a leaderboard list, grouped buckets, charts, or copy.
- DataContext / `usePartnerBuckets` / `usePartnerSavingPlan` / leaderboard hooks. These remain single-partner-shaped for now; they will be addressed by a separate state-layer task.
- Task 30 (`scheduled-saving-reminders` edge function, `enqueue_plan_start_notifications` RPC, the `plan_started` event). These are owner-only and already N-safe.
- The `send-nudge` edge function. Already recipient-targeted; no fan-out work needed here.
- `notify_goal_change_request` (0049). It intentionally targets the room creator only; not a fan-out path.
- `rename_room` (0053). Already iterates `room_members` directly (Task 29); confirmed safe.
- **`_smart_check_overtaking`. Not modified in this slice.** Today's 2-user behaviour ("actor crossed the only other member") stays exactly as it is. The N-player overtaking question (did the actor pass one or more members, and which of them get notified?) is a product decision deferred to a follow-up task. Because this slice does not touch the helper, today's 2-user crossing behaviour is preserved without risk of subtle regression, and the helper's continued reliance on `_other_room_member` is acceptable (it will be addressed when the N-player redesign happens).
- Web Push transport changes (no new VAPID config, no new edge functions, no new payload schema fields beyond what's necessary for fan-out).
- Notification UI copy rewrites ("partner" → "member"). Copy cleanup is a later slice (S6 in the audit).
- Realtime broadcast changes for partner activity surfaces.

## 3. Affected files

DB (additive only, single new migration):
- New migration `supabase/migrations/0055_partner_notification_fanout.sql` (number assigned during implementation — after the latest `0054_plan_start_notifications.sql`).

Edge function (single replacement):
- `supabase/functions/notify-partner-deposit/index.ts` — fan-out the existing single-recipient push flow into a per-recipient loop. Written to tolerate both the old `uuid` and the new `jsonb` return shapes from `notify_partner_deposit` so it can be deployed before the migration (see §6 Deployment).

No client / UI / hook files are touched. No type changes. No i18n changes.

Files read for context but not edited:
- `supabase/migrations/0040_partner_activity_notifications.sql` — shape of `_insert_partner_notification`, `_actor_display_name`, `_other_room_member`.
- `supabase/migrations/0041_partner_activity_prefs_and_buckets.sql` — preference gate inside `_insert_partner_notification`, bucket RPCs.
- `supabase/migrations/0042_smart_event_notifications.sql` and `0043_smart_event_crossing_hardening.sql` — smart-event helpers.
- `supabase/migrations/0049_goal_change_request_notification.sql` — confirms creator-only path stays as-is.
- `supabase/migrations/0053_rename_room.sql` — reference loop pattern (Task 29).
- `supabase/migrations/0054_plan_start_notifications.sql` — owner-only; confirms no Task-30 overlap.
- `supabase/functions/notify-partner-deposit/index.ts` — current single-recipient push flow.

## 4. DB / RPC design

The whole DB change is one new migration. It does not edit prior migrations and does not change any policy or column.

### 4.1 Replace the single-recipient pattern

Every existing `notify_*` RPC currently does:

```
v_recipient := public._other_room_member(v_room_id, v_actor);
if v_recipient is null then return null; end if;
... build copy, dedupe, payload ...
return public._insert_partner_notification(v_recipient, ...);
```

For N-safety this is replaced by:

```
for v_member in
  select rm.user_id
    from public.room_members rm
   where rm.room_id = v_room_id
     and rm.user_id <> v_actor
loop
  v_dedupe := <stable per-actor-event key> || ':' || v_member.user_id::text;
  perform public._insert_partner_notification(v_member.user_id, ...);
end loop;
```

This is the same pattern Task 29's `rename_room` (0053) already uses. The brief from the audit (§5) names `rename_room` as the canonical loop reference; this migration ports the same loop into every other in-scope `notify_*` RPC.

Important rules for the loop body:

- The dedupe key MUST include the recipient id when the event id alone is not already recipient-disambiguated, otherwise the unique `(recipient_user_id, dedupe_key)` index already disambiguates and the recipient suffix is redundant but harmless. The keys below are written explicitly so each recipient gets exactly one row.
- Copy (`title`, `body`, `cta_label`, `target_route`, `payload`) is **identical** across recipients for the same event. The only per-recipient field is the dedupe key.
- `_insert_partner_notification` already gates on the **recipient's** `master_enabled` + `partner_activity_enabled` (migration 0041). Calling it once per recipient applies each recipient's preferences independently — no extra plumbing needed.
- The order of insertion is irrelevant for correctness; do not add `order by` unless we want stable ordering for tests (we don't, for v1).

### 4.2 RPCs to update in 0055

In each case the migration creates the function with `create or replace function ...` so the new body replaces the old. Inputs, return type, search_path, and grant remain identical to the prior version, **except for `notify_partner_deposit`** — see §4.3 for the only return-type change and its required `DROP FUNCTION` step.

| RPC | Source migration | Recipient set today | New behaviour |
| --- | --- | --- | --- |
| `notify_partner_deposit(p_log_id)` | 0040 | one (via `_other_room_member`) | loop all `room_members where user_id <> actor`. Return type **changes** from `uuid` to `jsonb` — requires `DROP FUNCTION` + recreate. See §4.3 and §6. |
| `notify_balance_checked(p_checkpoint_id)` | 0040 | one | loop. Return unchanged (`uuid`, returning `null` after the loop). |
| `notify_plan_created(p_revision_id)` | 0040 | one | loop. Return unchanged (`uuid`, `null` after loop). |
| `notify_plan_changed(p_revision_id)` | 0040 | one | loop. Return unchanged. |
| `notify_plan_paused(p_pause_id)` | 0040 | one | loop. Return unchanged. |
| `notify_plan_resumed(p_pause_id)` | 0040 | one | loop. Return unchanged. |
| `notify_goal_changed(p_room_id)` | 0040 | one | loop. Return unchanged. |
| `notify_room_joined(p_room_id)` | 0040 | one | loop. Return unchanged. |
| `notify_room_left(p_room_id)` | 0040 | one | loop. Return unchanged. |
| `notify_bucket_added(p_bucket_id)` | 0041 | one | loop. Return unchanged. |
| `notify_bucket_updated(p_bucket_id)` | 0041 | one | loop. Return unchanged. |
| `_smart_check_goal_reached(p_log_id)` | 0043 | depositor + one partner | loop over every current room member (including depositor, who already gets their own `goal_reached`). |
| `_smart_check_overtaking(p_log_id)` | 0043 | one partner | **Not modified in this slice.** Stays exactly as 0043 left it (including its current `_other_room_member` call). See §2 and the dedicated note below. |
| `_smart_check_bucket_goal(p_log_id)` | 0043 | self (depositor) | no change. Self-recipient is correct. Listed here only to confirm "no change". |
| `_smart_check_streak(p_log_id)` | 0042 | self (depositor) | no change. Listed only for completeness. |

**Note on `_smart_check_overtaking`:** This helper is intentionally left untouched in 0055. Reasoning:

- Its 2-user behaviour ("did the actor cross the only other member today?") is correct and works because the cap is still 2. Not touching it guarantees zero behavioural risk for the surface that production actually exercises.
- Its N-player semantics are a product question (who counts as "overtaken", which recipients are notified, what's the dedupe window across multiple crossings in the same deposit), not a mechanical loop swap. Designing that belongs in a separate task scheduled alongside the cap raise.
- Because the room cap is unchanged in this slice (it stays at 2), `_smart_check_overtaking` cannot be exercised in an N > 2 room in production. Leaving it as-is is therefore safe.

`_other_room_member` itself is **kept in place**, with no edits except a documentation comment, because:

- `_smart_check_overtaking` still depends on it and is deliberately not modified in this slice.
- It still exists for any future caller that genuinely needs "an arbitrary other member" semantics.
- Dropping it would break `_smart_check_overtaking` and is out of scope.

We add a one-line comment on top of the function in the new migration noting it is legacy/limit-1, should not be used for new fan-out paths, and that its only remaining intentional caller (after 0055) is `_smart_check_overtaking`, which itself is queued for an N-player redesign.

### 4.3 `notify_partner_deposit` return shape (the only return-type change)

This is the one RPC whose caller (the `notify-partner-deposit` edge function) inspects the return value and uses it to drive push. Its current return type `uuid` becomes insufficient because we now insert up to N − 1 rows.

Two options were considered:

- **Option A — `DROP FUNCTION` then `CREATE FUNCTION ... returns jsonb`.** Single canonical RPC name. Requires explicit `DROP FUNCTION` because PostgreSQL `CREATE OR REPLACE FUNCTION` cannot change a function's return type. Requires re-issuing the `grant execute` after recreation. Requires coordinated deploy with the edge function (see §6).
- Option B — keep `notify_partner_deposit(uuid)` returning `uuid` unchanged; add a separate new RPC (e.g. `notify_partner_deposit_fanout(uuid)`) returning `jsonb`; point the edge function at the new RPC. Avoids the `DROP FUNCTION` step entirely and gives a clean rollback (just point the edge function back at the old RPC).

**Recommended: Option A (DROP + recreate as `returns jsonb`).** Reasons:

1. The project convention is one canonical RPC per event; we already accept additive migrations as the unit of change.
2. There is only one caller (the `notify-partner-deposit` edge function — to be re-verified during implementation via `rg "notify_partner_deposit"`), so the coordination cost of a return-type change is bounded.
3. The deployment risk (a brief window between DB and edge-function deploys) is fully mitigated by writing the new edge function to **accept both the old `uuid` and the new `jsonb` return shapes**, then deploying the edge function first and the migration second. See §6 for the full deployment recipe.
4. Avoids leaving two RPCs with overlapping responsibility in the schema (a `_fanout` variant alongside an obsolete original) plus the cleanup task to drop the legacy one later.

**`DROP FUNCTION` step (explicit, required because PostgreSQL `CREATE OR REPLACE` cannot change return type):**

```
drop function if exists public.notify_partner_deposit(uuid);

create function public.notify_partner_deposit(p_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$ ... $$;

revoke all on function public.notify_partner_deposit(uuid) from public;
grant execute on function public.notify_partner_deposit(uuid) to authenticated;
```

**Grants:** The `DROP FUNCTION` removes the existing `grant execute to authenticated`. The migration must re-issue both `revoke all ... from public` and `grant execute ... to authenticated` immediately after the new `CREATE FUNCTION`. Forgetting this would cause client deposits to start failing with a permission error inside the edge function (the service-role connection used by the edge function would still work, but the function only takes a service-role connection for the per-recipient push loop after the RPC call returns — the initial RPC call is made via the **caller's** auth context, not the service role). The migration body in §4.8 must include these grants.

Concrete return shape (returned via `jsonb_agg(jsonb_build_object('notification_id', v_id, 'recipient_user_id', v_member.user_id))`):

```
[
  { "notification_id": "…uuid…", "recipient_user_id": "…uuid…" },
  …
]
```

**Return-value semantics (resolved decision — see §12):** The RPC distinguishes three outcomes:

- **`null`** — the room has no other members (1-person room). The edge function maps this to `status: 'no_partner'`.
- **`'[]'::jsonb`** — other members existed but every per-recipient insert was deduped by `_insert_partner_notification`. The edge function maps this to `status: 'duplicate'`.
- **Non-empty `jsonb` array** — one entry per recipient that actually had a row inserted. The edge function fans push out to those recipients only.

The two empty cases are kept distinct because the edge function already exposes `no_partner` and `duplicate` as separate response statuses today, and the in-app row count for the two cases differs (zero vs. zero-after-dedupe), which matters for observability.

Inside the RPC: filter `null` results from `_insert_partner_notification` out of the loop before aggregating. The final `null`-vs-`[]` choice is decided by whether `room_members where user_id <> actor` returned any rows.

### 4.4 Why we can return `null` from the non-deposit RPCs

Searching the client (`rg "notify_balance_checked|notify_plan_(created|changed|paused|resumed)|notify_goal_changed|notify_room_(joined|left)|notify_bucket_(added|updated)" src/`) shows these are fire-and-forget calls whose result is discarded after error checking. We do **not** need to preserve "returns a uuid on success". Returning `null` after the loop completes is acceptable. The audit command above must be run during implementation (step 1 of §7) to confirm no caller depends on the return value before merging.

Because the return type stays `uuid` for these RPCs, `CREATE OR REPLACE FUNCTION` is valid for all of them — no `DROP FUNCTION` is needed.

### 4.5 Dedupe-key strategy per RPC

Per-recipient dedupe is already enforced by the unique index on `(recipient_user_id, dedupe_key)`. We keep the existing key suffix conventions:

| RPC | Existing key (today) | New key (per recipient) |
| --- | --- | --- |
| `notify_partner_deposit` | `'deposit:' \|\| log_id \|\| ':' \|\| recipient` | unchanged — already includes recipient id |
| `notify_balance_checked` | `'balance_check:' \|\| checkpoint_id \|\| ':' \|\| recipient` | unchanged |
| `notify_plan_created` | `'plan_created:' \|\| plan_id \|\| ':' \|\| recipient` | unchanged |
| `notify_plan_changed` | `'plan_revision:' \|\| revision_id \|\| ':' \|\| recipient` | unchanged |
| `notify_plan_paused` | `'plan_pause:' \|\| pause_id \|\| ':paused:' \|\| recipient` | unchanged |
| `notify_plan_resumed` | `'plan_pause:' \|\| pause_id \|\| ':resumed:' \|\| recipient` | unchanged |
| `notify_goal_changed` | `'goal_changed:' \|\| room_id \|\| ':' \|\| bangkok_minute \|\| ':' \|\| recipient` | unchanged |
| `notify_room_joined` | `'room_joined:' \|\| room_id \|\| ':' \|\| actor \|\| ':' \|\| recipient` | unchanged |
| `notify_room_left` | `'room_left:' \|\| room_id \|\| ':' \|\| actor \|\| ':' \|\| recipient` | unchanged |
| `notify_bucket_added` | `'bucket_added:' \|\| bucket_id \|\| ':' \|\| recipient` | unchanged |
| `notify_bucket_updated` | `'bucket_updated:' \|\| bucket_id \|\| ':' \|\| bangkok_minute \|\| ':' \|\| recipient` | unchanged |
| `_smart_check_goal_reached` | `'goal_reached:' \|\| room_id \|\| ':' \|\| target \|\| ':' \|\| recipient` | unchanged |
| `_smart_check_overtaking` | `'overtaking:' \|\| room_id \|\| ':' \|\| actor \|\| ':' \|\| bangkok_date \|\| ':' \|\| recipient` | **unchanged — helper is not touched in this slice** |

All existing keys already include the recipient id (because each was generated against the single resolved `_other_room_member`). Looping does not change the format; it only changes which `recipient` value is substituted on each iteration. This is intentional — we get free fan-out with no schema changes.

### 4.6 Recipient preference handling (unchanged surface, verified semantics)

`_insert_partner_notification` (0041) already short-circuits to NULL when the **recipient's** `notification_preferences.master_enabled` is false OR `partner_activity_enabled` is false (with the 0037 defaults applied when the row is missing). Because we call this helper once per recipient, each recipient's preferences are evaluated independently. No additional gating is required in 0055.

The `push_enabled` preference is evaluated in the edge function (`notify-partner-deposit`), not in SQL. The fan-out edge-function rewrite (§5) replicates that gating per recipient.

### 4.7 Permissions / RLS

- All updated RPCs keep `language plpgsql`, `security definer`, `set search_path = public`.
- All keep their existing `revoke all from public` + `grant execute to authenticated` pairing (except smart-event helpers, which keep `revoke from authenticated` — they are not directly callable).
- **`notify_partner_deposit` specifically:** because of the `DROP FUNCTION` step (§4.3), the migration must re-issue `revoke all on function public.notify_partner_deposit(uuid) from public;` and `grant execute on function public.notify_partner_deposit(uuid) to authenticated;` after the `CREATE FUNCTION`. Without this, the client-issued RPC call from the edge function (which runs under the caller's auth context for the initial invocation) would fail with a permission error.
- No policy changes on `notifications`, `room_members`, `notification_preferences`, or `push_subscriptions`.
- The migration does **not** touch `enforce_two_player_cap`, `join_room_by_code`, `room_members_select`, `is_room_member`, `room_members_for_room`, or any room-capacity surface.

### 4.8 Migration body (high-level outline, not the literal SQL)

```
-- 0055_partner_notification_fanout.sql
begin;

-- 1. Add a comment on _other_room_member documenting that it is
--    legacy single-recipient and should not be used in fan-out paths.
comment on function public._other_room_member(uuid, uuid) is
  'Legacy single-recipient helper. Returns at most one other member. ' ||
  'Do not use for new partner-activity fan-out paths — loop room_members ' ||
  'directly per the pattern in 0053_rename_room.sql. Only intentional ' ||
  'remaining caller after migration 0055 is _smart_check_overtaking, ' ||
  'which is queued for an N-player redesign in a follow-up task.';

-- 2. notify_partner_deposit: return type changes uuid -> jsonb.
--    PostgreSQL CREATE OR REPLACE cannot change return type, so we
--    DROP first, then CREATE, then re-grant.
drop function if exists public.notify_partner_deposit(uuid);

create function public.notify_partner_deposit(p_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  ...
  v_results jsonb := '[]'::jsonb;
  v_id      uuid;
  v_has_other boolean;
begin
  -- (same preamble: auth check, log ownership, room membership)
  ...
  for v_member in
    select rm.user_id
      from public.room_members rm
     where rm.room_id = v_room_id
       and rm.user_id <> v_actor
  loop
    v_dedupe := 'deposit:' || p_log_id::text || ':' || v_member.user_id::text;
    v_id := public._insert_partner_notification(
      v_member.user_id, v_actor, v_room_id, 'partner_deposited', v_dedupe,
      v_title, v_body, 'View activity',
      '/dashboard', 'activity', '/dashboard',
      false,  -- push_safe: the edge function still handles push explicitly
      v_payload, 'savings_logs', p_log_id
    );
    if v_id is not null then
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'notification_id', v_id,
          'recipient_user_id', v_member.user_id
        )
      );
    end if;
  end loop;

  if v_results = '[]'::jsonb then
    -- Distinguish "no other members" (null) from "other members
    -- existed but all duped" ([]) so the edge function can emit
    -- distinct `no_partner` vs `duplicate` statuses.
    select exists (
      select 1 from public.room_members rm
       where rm.room_id = v_room_id and rm.user_id <> v_actor
    ) into v_has_other;
    if not v_has_other then
      return null;
    end if;
    return '[]'::jsonb;
  end if;

  return v_results;
end;
$$;

-- DROP wiped the grants — re-issue them.
revoke all on function public.notify_partner_deposit(uuid) from public;
grant execute on function public.notify_partner_deposit(uuid) to authenticated;

-- 3. CREATE OR REPLACE each remaining notify_* RPC with the loop
--    pattern. Return type stays `uuid` for all of them, so no DROP
--    is needed and existing grants survive. Bodies match 0040/0041
--    exactly except for the recipient-resolution block, which is
--    replaced by a `for v_member in select rm.user_id from
--    public.room_members rm where ...` loop. They return null after
--    the loop.
--      notify_balance_checked, notify_plan_created, notify_plan_changed,
--      notify_plan_paused, notify_plan_resumed, notify_goal_changed,
--      notify_room_joined, notify_room_left, notify_bucket_added,
--      notify_bucket_updated.

-- 4. _smart_check_goal_reached: replace the depositor + partner block
--    with a single loop over all current room members (depositor
--    included). Each recipient still gets the existing dedupe key
--    `'goal_reached:' || room_id || ':' || target || ':' || recipient`.

-- 5. _smart_check_overtaking is intentionally NOT touched here.
--    Its body, signature, grants, and behaviour remain as left by
--    migration 0043. See §2 and §4.2 for the reasoning.

commit;
```

## 5. Edge-function design: `notify-partner-deposit`

The existing edge function (`supabase/functions/notify-partner-deposit/index.ts`) does the following today:

1. Auth-check the caller.
2. Call `notify_partner_deposit(p_log_id)` as the caller.
3. Expect a single `notification_id`.
4. Load that notification row, the recipient's prefs, the recipient's `ui_language`, the recipient's push subscriptions.
5. Build push copy, send web-push to each device, record delivery attempts.
6. Return `{ status, delivered, notification_id, error? }`.

The new flow:

1. Auth-check the caller (unchanged).
2. Call `notify_partner_deposit(p_log_id)` as the caller. The response is parsed into a normalised internal shape, **tolerating both**:
   - The **old return shape** (a `uuid` string or `{ notification_id }` object) — normalised to `[{ notification_id, recipient_user_id: <looked up from the notification row> }]`. This branch exists only to keep the function safe during the deploy window where it has been deployed but the migration has not yet been applied; once the migration lands, this branch is never hit. It must remain in place until the migration is confirmed applied in every environment.
   - The **new return shape** (`null | [] | [{ notification_id, recipient_user_id }, ...]`).
3. Branching on the normalised value:
   - `null` → return `{ status: 'no_partner', delivered: 0, notification_ids: [] }`.
   - `[]` → return `{ status: 'duplicate', delivered: 0, notification_ids: [] }`.
   - non-empty array → continue.
4. With the service-role client, load every notification row in one query: `select id, recipient_user_id, payload from notifications where id in (:ids)`.
5. Collect unique `recipient_user_id` values from the rows.
6. Load preferences for all recipients in one query: `select user_id, master_enabled, push_enabled, partner_activity_enabled from notification_preferences where user_id = any(:recipient_ids)`. Apply 0037 defaults when a recipient's row is missing.
7. Load profile language for all recipients in one query: `select id, ui_language from profiles where id = any(:recipient_ids)`.
8. Load active subscriptions for all recipients in one query: `select id, user_id, endpoint, p256dh, auth_key from push_subscriptions where user_id = any(:recipient_ids)`.
9. For each recipient `r` in the result set, in parallel:
   - Skip if `r.push_enabled !== true` or `master_enabled !== true` or `partner_activity_enabled !== true` (push gate); still count the notification row as saved.
   - Skip if `r` has no subscriptions (mark as `saved_no_push`).
   - Build the locale-aware push payload via `buildPushCopy(...)` using `r.ui_language` and the payload stored on `r`'s notification row.
   - Send web-push to each of `r`'s devices in parallel; record `notification_delivery_attempts` rows; clean up 404/410 endpoints exactly as today.
10. Aggregate counts and return a structured summary:

```
{
  status: 'sent' | 'saved_no_push' | 'no_partner' | 'duplicate' | 'partial',
  delivered: <total_pushes_succeeded>,
  notification_ids: [<all inserted notification ids>],
  recipients: [
    { recipient_user_id, notification_id, delivered, error? },
    ...
  ]
}
```

Status semantics:

- `sent` — at least one device for at least one recipient received the push.
- `saved_no_push` — every recipient row exists in-app but no push could be delivered (no subscriptions, push disabled, or all attempts failed).
- `partial` — some recipients delivered, some didn't. Optional; folding into `sent` is also acceptable. Recommendation: emit `partial` for observability.
- `no_partner` — 1-person room.
- `duplicate` — fan-out happened but every row collided on dedupe.

Failure-mode rules (preserve current behaviour):

- The deposit save must **not** depend on this function's success — the caller in `useLogs` / `AddMoney` already treats any non-2xx as "log + continue". Do not change the contract on the caller side.
- Per-device push errors stay per-device. A 500 from one subscription does not abort the whole fan-out.
- Expired endpoints (404/410) still trigger a `push_subscriptions` delete, per recipient.
- `notification_delivery_attempts` still records one row per `(notification_id, push_subscription_id)` pair.
- CORS, allowed origins, allowed push prefixes, VAPID secret loading, and `sanitizeRoute` logic stay identical.

Performance note (per the audit): 6 recipients × ~3 devices = ~18 web-push calls per deposit in a hypothetical 7-user room. `Promise.all` across the matrix is fine; no batching/backoff layer is introduced in this task.

### 5.1 What does **not** change in the edge function

- The VAPID secrets, the CORS allow list, the URL allow list, the locale-aware copy builder (`buildPushCopy`).
- The "caller must be authenticated" guard.
- The `notification_delivery_attempts` schema and insert path.
- The expired-endpoint cleanup.
- The "return 2xx on partial/zero delivery" contract.

The diff is conceptually: replace the single-recipient flow (one row fetched, one prefs lookup, one subs lookup, one `Promise.all` over devices) with a per-recipient grouped flow (one row-fetch with `IN`, one prefs lookup with `IN`, one profile lookup with `IN`, one subs lookup with `IN`, then a recipient-keyed `Promise.all`), plus a small response-normalisation shim at the top to handle both the legacy `uuid` and new `jsonb` return shapes.

## 6. Deployment

`notify_partner_deposit` is the only piece of this task with a coordination requirement: its return type changes (`uuid` → `jsonb`) via `DROP FUNCTION` + `CREATE FUNCTION`, and its only caller is the `notify-partner-deposit` edge function. All other RPCs in 0055 keep `returns uuid` and use `CREATE OR REPLACE`, so they have no deploy-ordering constraint.

**Recommended ordering — edge function first, migration second:**

1. **Deploy the new edge function.** The new edge function is written to accept **both** return shapes from `notify_partner_deposit`: the old `uuid` (still produced by the unmigrated DB) and the new `jsonb` (produced after 0055 lands). While the migration has not yet been applied, the edge function calls the still-`uuid` RPC, gets back a single uuid, normalises it to `[{ notification_id, recipient_user_id }]` after a quick lookup on the notifications row, and fan-out trivially loops over one recipient — i.e. it behaves exactly like today. **Push delivery continues uninterrupted during this phase.**
2. **Apply migration 0055.** Once applied, the RPC returns `jsonb`. The new edge function parses the new shape directly and fans out to all other room members. Because the cap is still 2, "all other room members" is still exactly one user, so the visible behaviour is identical.
3. **(Optional, later)** Remove the legacy `uuid`-normalisation branch from the edge function once the migration is confirmed applied in every environment.

This ordering guarantees **zero push-delivery downtime** in either direction:

- If for any reason step 2 is delayed, step 1 keeps production behaving exactly as it does today.
- If step 2 lands before step 1 (the unsafe ordering), the **old** edge function would call the **new** RPC and receive `jsonb` where it expects `uuid`. It would log a parse error and the response would be a 500. Push delivery would break until the new edge function is deployed. **Do not deploy in this order.**

**If the edge function and migration must be deployed simultaneously (e.g. no separate edge-function deploy slot), the safe substitute is:**

- Deploy edge function and apply migration in the same window, with the edge function deploy initiated **first** so it is live before the migration commits. The new edge function tolerates both return shapes, so a brief window where the old RPC is still in place is harmless.

**What breaks if you do the unsafe ordering (migration first, then edge function):**

- The interval between the migration landing and the new edge function deploying: every deposit's call to `notify-partner-deposit` returns a 500 because the old code expects a `uuid` and now gets `jsonb`. The deposit itself still succeeds (the SQL in the new RPC still inserts the in-app `partner_deposited` row), but no push is sent.
- In-app notifications continue to work during this gap (the row is still inserted by the new RPC).
- The fix is simply to finish deploying the edge function; no data repair is needed.

**Why not Option B (separate `_fanout` RPC name) instead?** Option B would avoid the deploy-ordering constraint entirely but leaves two RPCs covering the same event in the schema. With the dual-shape edge function above, Option A is just as safe in practice and keeps the schema clean.

## 7. Recipient preference handling — explicit summary

In-app gate (SQL, inside `_insert_partner_notification`):

- `master_enabled` (default true): false → no in-app row, no push.
- `partner_activity_enabled` (default true): false → no in-app row, no push.

Push gate (edge function, per recipient):

- `master_enabled` (default true): false → no push for this recipient.
- `partner_activity_enabled` (default true): false → no push for this recipient.
- `push_enabled` (default false): false → no push for this recipient.
- No active `push_subscriptions` rows → no push for this recipient.

The two gates intentionally overlap on master + partner-activity. The SQL gate ensures we don't even save an in-app row when a recipient has those off; the edge-function gate is belt-and-braces for push specifically (in case the in-app row is saved by some other path and we still want push-suppressed). With fan-out, both gates are evaluated per recipient because we call `_insert_partner_notification` per recipient in SQL and we look up `notification_preferences` per recipient in the edge function.

## 8. Implementation steps

Order chosen so each step is independently verifiable. Code work happens in a follow-up task; this plan only lists the order.

1. **Caller audit** (read-only): `rg "notify_(partner_deposit|balance_checked|plan_(created|changed|paused|resumed)|goal_changed|room_(joined|left)|bucket_(added|updated))" --type=ts --type=sql` and confirm:
   - `notify_partner_deposit` has exactly one caller (the edge function).
   - No client code reads `notification_id` from the edge function's response body in a way that would break when the field is renamed to `notification_ids` (also `rg "notification_id" src/`).
   - The other `notify_*` RPCs are only called from client hooks that discard the return value.
   - Document the caller list in the migration header.
2. **Update the edge function first** per §5. Include the dual-shape normalisation (accept both legacy `uuid` and new `jsonb` returns). Keep the function signature, route, and CORS surface identical.
3. **Deploy the edge function** to the project's environment(s) before applying the migration. Confirm logs show normal `status: 'sent'` / `'no_partner'` responses with the still-`uuid` RPC.
4. **Write `supabase/migrations/0055_partner_notification_fanout.sql`** per §4. Include the explicit `DROP FUNCTION public.notify_partner_deposit(uuid)` step and the re-issued grants.
5. **Apply 0055 locally.** Smoke-test each updated RPC via the SQL editor against a seeded 2-user room: every notification still arrives at the single other member; `notify_partner_deposit` returns a single-element `jsonb` array; in a 1-person room it returns `null`; a forced dedupe collision returns `'[]'::jsonb`.
6. **Re-test end-to-end locally:** record a deposit from member A in a 2-user room, confirm member B still gets exactly one in-app row + one push (same as before).
7. **Apply 0055 to staging / project DB.** Edge function is already deployed and tolerates the new shape, so push continues uninterrupted.
8. **Run `npm run build` and `npm run lint`** (SQL and edge-function changes don't strictly require these, but the project guide asks for them after meaningful code changes — run as a safety net).
9. **Manual QA per §10.**
10. **(Optional follow-up)** Remove the legacy `uuid`-normalisation branch from the edge function once the migration is confirmed live everywhere.
11. **Report** changed files, checks run, residual risks, and deferred follow-ups (notably: `_smart_check_overtaking` N-player semantics, copy cleanup, DataContext fan-out, capacity raise).

Do **not** bundle any unrelated work in the implementation commit (no copy fixes, no smart-event redesign, no UI changes).

## 9. Acceptance criteria

This slice makes most partner/activity notification fan-out N-safe (every in-scope `notify_*` RPC plus `_smart_check_goal_reached`, plus the `notify-partner-deposit` edge function). **`_smart_check_overtaking` remains a documented follow-up** and is not touched here.

For the current 2-user behaviour (the **only** behaviour exercised in production today):

- Every notification that fires today still fires, with the same `event_key`, the same dedupe key, the same `title`/`body`/`cta_label`/`target_route`/`fallback_route`/`payload` shape, the same `push_safe` flag, the same `category`, the same `channel_policy`.
- Recording a deposit by member A still delivers (a) one in-app `partner_deposited` row to member B and (b) exactly one web push per active device of member B, with the locale-aware copy unchanged.
- A 1-person room (creator only, before another user joins) still produces zero notifications and zero pushes; the edge function returns `no_partner`.
- Disabling member B's `master_enabled` still suppresses both the in-app row and the push.
- Disabling member B's `partner_activity_enabled` still suppresses both.
- Disabling member B's `push_enabled` still allows the in-app row but suppresses the push.
- A retried RPC call inside the same dedupe window still inserts no duplicate row (recipient/dedupe-key index holds).
- All in-scope partner-activity RPCs (deposit, balance check, plan create/change/pause/resume, goal change, room join/left, bucket add/update, smart-event goal reached) behave **identically** for the 2-user case.
- `_smart_check_overtaking` — not touched — also behaves identically for the 2-user case by definition (its body, grants, and dependency on `_other_room_member` are unchanged).

For the future N-user case (reasoned, not exercised today because the cap is still 2):

- Each in-scope RPC, called in a hypothetical 3-user room, inserts two `notifications` rows (one per other member), each gated by that recipient's preferences.
- The edge-function fan-out delivers a push per recipient's subscriptions, locale-aware per recipient.
- Dedupe is per recipient — the same dedupe key on different recipients does not collide.
- No code path in this task relies on the room having exactly 2 members **except `_smart_check_overtaking`**, which is intentionally not addressed in this slice. The N-player overtaking question is a separately scheduled follow-up; in a hypothetical 3-user room, `_smart_check_overtaking` would still notify a single member (the one returned by `_other_room_member`), which is acceptable as a known-suboptimal placeholder until the follow-up redesign lands.

## 10. Manual QA checklist

Setup: a 2-user room with member A (creator) and member B (non-creator). Both have push subscriptions registered.

In-app + push parity (the regression suite for today's behaviour):

- [ ] A records a deposit → B receives one in-app `partner_deposited` row and one push per device. A receives nothing for this event (sender never pushes themselves).
- [ ] A re-runs the same RPC immediately → no duplicate row (dedupe holds), no extra push.
- [ ] A creates a balance checkpoint → B gets `balance_checked`.
- [ ] A creates a saving plan → B gets `plan_created`.
- [ ] A changes the saving plan → B gets `plan_changed`.
- [ ] A pauses then resumes the plan → B gets `plan_paused` then `plan_resumed`.
- [ ] A changes the room goal → B gets `goal_changed` (per-minute dedupe still collapses double-saves).
- [ ] A joins after B (or vice versa) → existing member gets `room_joined`.
- [ ] A leaves the room → B gets `room_left` (delivered before the membership row is removed).
- [ ] A adds a bucket → B gets `bucket_added`.
- [ ] A updates a bucket → B gets `bucket_updated`.
- [ ] A overtakes B in recorded deposits → B gets `overtaking` (helper unchanged in this slice).
- [ ] A's deposit crosses the room goal → both A and B get `goal_reached`.

Preference gating:

- [ ] B sets `master_enabled = false` → no in-app row, no push for any of the above. Re-enable.
- [ ] B sets `partner_activity_enabled = false` → no in-app row, no push for any of the above. Re-enable.
- [ ] B sets `push_enabled = false` → in-app rows still appear, no push. Re-enable.
- [ ] B unsubscribes all devices → in-app rows still appear, no push.

Edge-function contract:

- [ ] A invokes `notify-partner-deposit` while B is offline → 2xx response, in-app row exists, no push delivered (or push delivered when B comes online via service worker, depending on browser).
- [ ] An expired endpoint on B (force-deleted on the push provider) → returns 410, the endpoint is removed from `push_subscriptions`, response status stays 2xx.
- [ ] A deposit is recorded by A in a 1-person room (B has not joined yet) → edge function returns `no_partner`, no rows inserted, no pushes attempted.

Deployment-window verification:

- [ ] After deploying the new edge function but **before** applying 0055, record a deposit → push delivery still works (edge function falls back to the legacy `uuid` normalisation path).
- [ ] After applying 0055, record a deposit → push delivery still works (edge function takes the new `jsonb` path).
- [ ] Inspect edge-function logs across the two phases → no parse errors, no 500s attributable to the return-shape change.

Reasoned N-user verification (no production users today; verify via SQL fixture):

- [ ] Insert a fake third user C into a test room (bypassing the cap trigger in a local dev DB only). Record a deposit from A. Confirm:
  - Two `notifications` rows are inserted (one for B, one for C), each with the recipient-suffixed dedupe key.
  - Both rows have identical `title`/`body`/`payload`.
  - Both rows are gated by the recipient's preferences independently.
  - The edge function (`notify-partner-deposit`) returns a result with two `recipients` entries and a positive `delivered` count when both have active subscriptions.
- [ ] Repeat the test with B's `push_enabled = false` and C's `push_enabled = true` → C gets push, B gets in-app only.
- [ ] Roll back the fake third member when the test is done. The production cap trigger remains untouched (do not run this test against production data).

## 11. Risk level

**Medium.**

- Touches every in-scope partner-activity SQL path simultaneously. A subtle copy/dedupe regression in any one RPC affects production immediately.
- The `notify_partner_deposit` return type change requires `DROP FUNCTION` + re-grant; a missing re-grant or a deploy in the unsafe order (migration before edge function) would break push delivery until corrected. Mitigation: the dual-shape edge function (§5, §6) + the "edge function first" deploy ordering eliminate the window entirely when followed.
- The edge-function rewrite changes the response-body shape returned to the client (`notification_id` → `notification_ids` and a `recipients` array). Verify no client consumer of the response body relies on the old shape (`rg "notification_id" src/`).
- The migration is otherwise additive (only `notify_partner_deposit` is dropped-and-recreated; all other RPCs are `CREATE OR REPLACE`; no schema changes), so SQL rollback is straightforward.
- No financial state surfaces are touched; the money-state guardrails in `CLAUDE.md` are not at risk.
- The room capacity trigger and join RPC are untouched, so a regression cannot accidentally let a third user in.

Specific failure modes to watch for during code review:

- An RPC that forgets to include the recipient id in its dedupe key would, post-fan-out, cause the second-and-later inserts to all collide on `(recipient_user_id, dedupe_key)`. Today this never matters because we resolve a single recipient; tomorrow it would silently drop notifications. Mitigation: copy the existing keys verbatim — they already include the recipient suffix.
- A loop that forgets to gate copy by the recipient's locale would deliver English push to a Thai recipient. Mitigation: copy is rendered server-side in the existing in-app row (English) and overridden per recipient in the edge function via `buildPushCopy(r.ui_language, ...)` — the new fan-out preserves this per-recipient.
- Returning a different jsonb shape from `notify_partner_deposit` than the edge function expects causes a runtime crash on every deposit. Mitigation: the new edge function tolerates both old and new shapes; QA item §10 explicitly verifies both phases of the deploy window.
- Forgetting to re-issue `grant execute ... to authenticated` after the `DROP FUNCTION` would cause every client-originated `notify_partner_deposit` call to fail with a permission error. Mitigation: the migration body in §4.8 includes the grant; reviewers must verify it is present.

## 12. Rollback plan

DB:

- Most of the migration is additive: every updated RPC except `notify_partner_deposit` is replaced via `create or replace function`, and `_other_room_member` only receives a `COMMENT` change.
- `notify_partner_deposit` requires the inverse `DROP FUNCTION public.notify_partner_deposit(uuid)` (now `returns jsonb`) followed by `CREATE FUNCTION ... returns uuid` with the original body from 0040, then re-issued grants. A rollback migration must include this explicitly.
- Rollback for the other RPCs = a follow-up migration that re-issues the prior bodies (from 0040, 0041, 0043) via `create or replace function`. No data migration required. Notifications already inserted under the new behaviour remain harmless (they are read-only history).

Edge function:

- Rollback = redeploy the previous edge-function version. Because the new edge function is written to tolerate both return shapes, you can leave the new edge function in place even after rolling back the SQL — it will simply take the legacy `uuid` branch again. There is therefore usually **no need** to roll the edge function back at all.

Combined recommended rollback ordering:

1. Apply the SQL rollback migration first (restores `returns uuid` and original bodies; re-issues grants).
2. **(Optional)** Redeploy the previous edge function only if the new dual-shape edge function is itself implicated in the incident; otherwise leave it in place.

No destructive operation, no data migration, no irreversible side effects. The room-capacity invariant (2 members) is unchanged throughout.

## 13. Resolved decisions (previously open questions)

These were open in the draft and are now resolved so implementation can proceed:

- **`notify_partner_deposit` return semantics:** `null` for "no other members" (→ `no_partner`); `'[]'::jsonb` for "other members existed but all duped" (→ `duplicate`); non-empty `jsonb` array for "at least one row inserted". The two empty cases are kept distinct because the edge function already exposes `no_partner` and `duplicate` as separate statuses today and the difference matters for observability. (See §4.3.)
- **Singular `notification_id` in the response body:** the audit step (§8.1) confirms whether any client consumer reads this field; the expected answer is "no caller besides the edge function itself reads `notify_partner_deposit`'s return value, and no UI surface reads the edge function's response body beyond the HTTP status." If the audit reveals a consumer, the edge function will retain a top-level `notification_id` field set to the first entry's id alongside the new `notification_ids` array. Default assumption: only `notification_ids` is needed.
- **`_smart_check_overtaking`:** **not touched in this slice.** Today's 2-user crossing behaviour is preserved by definition because the helper, its grants, and its dependency on `_other_room_member` are unchanged. The N-player crossing question is a separate product/design task scheduled as a follow-up. (See §2, §4.2, §9.)
- **`_other_room_member` lifecycle:** stays in the schema as a documented legacy helper. Its only intentional remaining caller after 0055 is `_smart_check_overtaking`, which is queued for the N-player redesign. The migration adds a `COMMENT` explaining this. No drop, no grant change. (See §4.2, §4.8.)
