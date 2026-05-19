# Task 29 — Rename Room (creator only, in-app notification fan-out)

Status: Planning only. No code, migrations, or file edits in this document.
Owner: Senior FE/FS pair (Claude) with Fran.
Source: `docs/multi-user-room-feature-plan.md` — Feature 4 (Rename room).
Date drafted: 2026-05-20.

This is a fresh plan; the previous Task 29 plan was undone. Scope is intentionally narrow: only what is required to let the room creator rename the project, surface the new name to every member's UI, and tell the other members it happened — via an in-app notification only, with no Web Push.

---

## 1. Goal

- Let the room creator rename the room/project after creation.
- Show all members (creator and non-creators) the current room name.
- Allow only the creator to edit the name; non-creators see read-only state with a hint.
- When the rename succeeds (and the trimmed new name actually differs from the trimmed old name), insert an in-app `room_renamed` notification for every *other* current room member.
- Deliver only in-app — no push payload, no edge-function call, no VAPID delivery.
- Enforce all validation in a single SECURITY DEFINER RPC so the client cannot bypass it via direct REST updates.

## 2. Non-goals

The following are explicitly out of scope and must not be touched in this task:

- Multi-user room capacity (Feature 2 / cap raise from 2 → 7).
- Member detail page (Feature 3).
- Individual goals / sub-goals (Feature 5).
- `notify_plan_started` / saving-plan-start notifications (Feature 1).
- Bucket logic (creation, ordering, floors, partner buckets).
- Push notification transport (no edge-function changes, no `push_safe = true`).
- Renaming the room invite code, end date, category, or any other room field.
- Creator transfer / admin role.
- Audit log table for renames (the notification + DB row are the audit trail for v1).
- Any unrelated visual redesign of `ManageProject.tsx`.

## 3. Affected files

DB (additive only):
- New migration `supabase/migrations/00XX_rename_room.sql` (number assigned during implementation — after the latest, currently `0052_change_plan_supersede_unborn_revisions.sql`).

Client:
- `src/hooks/useRooms.ts` — add `renameRoom(roomId, name)`.
- `src/components/RoomContext/RoomContextValue.ts` — widen `setRooms` to accept a React functional updater (`Dispatch<SetStateAction<Room[]>>`) so `renameRoom` can use `setRooms(prev => prev.map(...))` without depending on the stale closure value of `currentRooms`. Audit current callers to confirm no regression.
- `src/pages/ManageProject.tsx` — new "Project name" row (creator: opens modal; non-creator: read-only + hint).
- `src/components/Modal/Modal.tsx` — reuse existing modal component; no edits.
- `src/types/index.ts` — add `'room_renamed'` to `NotificationEventKey`.
- `src/i18n/notificationCopy.ts` — add a `case 'room_renamed':` branch.
- `src/i18n/locales/en.ts` and `src/i18n/locales/th.ts` — add notification copy + new ManageProject strings (label, hint, modal title, validation messages, success toast).

Existing files that need a small read pass but no edits:
- `src/components/Notifications/NotificationListItem.tsx` — confirm a new `event_key` automatically routes through `notificationDisplayCopy`; no per-event icon switch needed unless we want a custom one (we don't, for v1).
- `supabase/migrations/0040_partner_activity_notifications.sql` — confirms `_insert_partner_notification` and `_actor_display_name` signatures.

## 4. DB / RPC design

One RPC only: `rename_room(p_room_id uuid, p_name text) returns text`.

The RPC must:

1. Be `language plpgsql`, `security definer`, `set search_path = public`.
2. Require authentication: `auth.uid()` must not be null (else `42501 authentication required`).
3. Require non-null `p_room_id` and `p_name` (else `22023`).
4. Trim leading/trailing whitespace from `p_name` (`btrim`).
5. Reject empty or whitespace-only trimmed names with `22023 name required`.
6. Reject names longer than 60 characters after trim (`22023 name too long`).
7. Reject names containing ASCII control characters. Use a regex such as `p_name ~ '[[:cntrl:]]'` on the **raw** input (so embedded tabs/newlines don't survive a trim and slip through). Error: `22023 name contains control characters`.
8. Look up `rooms.id = p_room_id` and lock it `FOR UPDATE` to serialise concurrent renames. If the row does not exist → `P0002 room not found`.
9. Verify the caller is the creator: `rooms.created_by = auth.uid()` (else `42501 only the creator can rename this room`).
10. Block archived rooms: if `rooms.archived_at is not null` → `42501 room is archived`.
11. Compare the trimmed new name to the **current trimmed** old name. If equal, return the trimmed name immediately and do **not** update the row, do **not** insert any notification.
12. Otherwise: `update rooms set name = <trimmed> where id = p_room_id` and capture both `old_name` and `new_name` from the trimmed values (the `update … returning` form, or capture before the update). Both values must be **derived inside the RPC** from the row + the trimmed argument. Never pass `old_name` / `new_name` from the client.
13. Insert one in-app notification per *other current room member* by iterating `room_members rm where rm.room_id = p_room_id and rm.user_id <> auth.uid()`. For each recipient, call `_insert_partner_notification(...)` from migration 0040 with:
    - `p_recipient_user_id = rm.user_id`
    - `p_actor_user_id = auth.uid()`
    - `p_room_id = p_room_id`
    - `p_event_key = 'room_renamed'`
    - `p_dedupe_key = 'room_renamed:' || p_room_id || ':' || <updated-at-bucket>` (see §5 for the bucket strategy)
    - `p_title` / `p_body` / `p_cta_label` derived from `_actor_display_name(auth.uid())`, the DB-derived `old_name`, and the DB-derived `new_name`
    - `p_target_route = '/dashboard'`, `p_target_section = null`, `p_fallback_route = '/dashboard'`
    - `p_push_safe = false` — **must be false** so the existing push pipeline does not attempt delivery for this event
    - `p_payload = jsonb_build_object('actor_name', <name>, 'old_name', <old>, 'new_name', <new>, 'room_id', p_room_id)`
    - `p_source_table = 'rooms'`, `p_source_id = p_room_id`
14. Return the accepted trimmed name as `text`.

Permissions:

```
revoke all on function public.rename_room(uuid, text) from public;
grant execute on function public.rename_room(uuid, text) to authenticated;
```

No new tables, no new columns, no policy changes. The existing `rooms_update_creator` policy still technically allows the creator to update `rooms.name` via PostgREST; we accept that surface and treat the RPC as the only sanctioned path. (A later hardening task could shrink the update policy to non-name columns, but that's out of scope for Task 29 because it could regress unrelated creator-edit flows.)

### Why fan-out inside the rename transaction

Keeping the recipient loop and notification insert inside the same SECURITY DEFINER transaction as the rename:

- Guarantees the notification fires iff the rename succeeded.
- Guarantees `old_name` / `new_name` are read from the DB row, not user input.
- Rolls the notification back automatically if the update fails (atomicity).
- Keeps the entire feature surface to a single RPC, with no extra client wiring.

## 5. Notification design

- `event_key`: `'room_renamed'` (new value, added to `NotificationEventKey` in `src/types/index.ts`).
- `category`: `'partner_activity'` — inherited from `_insert_partner_notification`, which hard-codes that category and `channel_policy = 'in_app'`. This is exactly what we want: in-app surface, no push.
- `push_safe`: `false`. This matches every other `notify_*` RPC except `notify_partner_deposit` (which uses an edge function to push). Because no edge function is wired for `room_renamed`, there is no path that would emit a push.
- Recipients: every current row in `room_members` for `p_room_id` whose `user_id <> auth.uid()`. In today's 2-user rooms this is exactly one recipient; the loop is written for N members so we do not need to revisit it when Feature 2 lands.
- Per-recipient delivery is gated by `_insert_partner_notification`'s `on conflict (recipient_user_id, dedupe_key) do nothing`, so a retried RPC call inside the same dedupe bucket is idempotent.
- Dedupe key: `'room_renamed:' || p_room_id || ':' || to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI')`. Per-minute bucket matches the pattern in `notify_goal_changed` (0040) and `notify_goal_change_request` (0049) — collapses a double-tap save inside the same minute, but a later genuine rename still produces a new row. The dedupe key intentionally does **not** include `old_name` or `new_name`, so a rapid "A → B → A" tap-storm inside a minute still collapses to one notification per recipient.
- Title (EN): "Project renamed".
- Body (EN): `<actor name> renamed "<old name>" to "<new name>".` (Old + new are DB-derived; truncation handled at the i18n layer if needed.)
- CTA label: "Open project". `target_route` = `/dashboard`.
- Routing rationale: a rename is a project-wide event; Dashboard is the canonical landing. We deliberately do not point at `/manage-project` so that non-creators (who see the field as read-only there) don't land on a screen that suggests action.
- Payload: `actor_name`, `old_name`, `new_name`, `room_id`. These let the i18n renderer reconstruct copy on the fly and let any future analytics consumer reconstruct history without an extra table.

## 6. Client design

### `useRooms.renameRoom(roomId, name)`

Signature: `renameRoom(roomId: string, name: string): Promise<ActionResult>` — reuses the existing `ActionResult` shape (`{ error?: string; roomId?: string }`).

Behaviour:

1. If `!userId` → return `{ error: 'Not authenticated' }`.
2. Compute `trimmed = name.trim()`. Client-side validation (length, empty, control-chars) duplicates the DB rules so the UI can show inline errors instantly; on mismatch the DB rule still wins.
3. Call `supabase.rpc('rename_room', { p_room_id: roomId, p_name: trimmed })`.
4. On error → return `{ error: <mapped copy> }` (see §7 for the EN/TH copy mapping; map well-known Postgres error codes to friendly strings, fall back to the raw `error.message`).
5. On success → the RPC returns the accepted trimmed name as `text`. Apply it locally with a functional state update so we do not depend on the closed-over `currentRooms`:

   ```ts
   const accepted = (data as string) ?? trimmed;
   setRooms(prev => prev.map(room =>
     room.id === roomId ? { ...room, name: accepted } : room,
   ));
   ```

6. Return `{ roomId }`.

Notes:
- The functional updater requires widening `RoomContextValue.setRooms` from `(rooms: Room[]) => void` to `Dispatch<SetStateAction<Room[]>>`. The underlying `useState` setter already supports this; only the type is narrowed. Audit existing callers (`useRooms.fetchRooms`, `createRoom`, `archiveRoom`, `leaveRoom`, `updateRoom`) — all pass plain `Room[]`, which remains assignable to `SetStateAction<Room[]>`. No call-site changes needed beyond the type widening.
- The client calls only `rename_room`. The RPC handles validation, the rename, and the notification fan-out itself.
- Realtime is not required for this change to land; the RPC commits the name, so any later refetch (e.g. on next visit to ManageProject or `RoomContext` reload) returns the new value. Other members see the new name once the next room fetch runs or they receive the in-app notification and re-open the project. Realtime broadcast wiring is intentionally out of scope (and would belong in the partner-realtime task, not here).

### `ManageProject.tsx` UI

Add a new "Project name" row near the top of the screen, above the existing invite/QR row. Both creators and non-creators see it; the affordance differs.

Creator path:
- Row shows the current `activeRoom.name` and a small chevron/edit affordance.
- Tap → open a new modal (`activeModal === 'rename-room'`, extend the `ManageModal` union type).
- Modal contents:
  - Title: copy.manageProject.renameTitle ("Rename project" / "เปลี่ยนชื่อโปรเจกต์").
  - Single text input pre-filled with the current name.
  - Live char counter `n/60`.
  - Inline validation error area for empty / too-long / control-char / unchanged states.
  - Primary button: "Save" — disabled when trimmed input is empty, longer than 60, contains control chars, or equals the current trimmed name.
  - Secondary button: "Cancel".
- On Save: call `renameRoom(activeRoomId, draftName)`.
  - If `result.error` → show inline error message (mapped from §7 copy).
  - If success → close modal, show success toast via the existing `setMessage` mechanism (copy.manageProject.renameSuccess).
- `haptic('selection')` on save, mirroring existing patterns in the file.

Non-creator path:
- Same row visually, but no chevron and no tap action.
- Below the value, a single-line hint: copy.manageProject.renameNonCreatorHint ("Only the project creator can rename this." / "เฉพาะผู้สร้างโปรเจกต์เท่านั้นที่เปลี่ยนชื่อได้").
- No modal is registered for non-creators (defensive: `if (!isCreator) return;` inside the open handler).

State:
- Add `renameDraft` (string) to `ManageProject`'s local state, initialised from `activeRoom.name` when the modal opens; reset on close. Do **not** keep it in sync with `activeRoom.name` while typing — that would clobber the user's edit if a partner-side fetch happened mid-typing.

### Notification rendering

- `src/types/index.ts`: add `'room_renamed'` to the `NotificationEventKey` union.
- `src/i18n/notificationCopy.ts`: add `case 'room_renamed':` returning `n.events.roomRenamed(actorName(payload, fallbackPartner), payloadString(payload, 'old_name'), payloadString(payload, 'new_name'))`.
- The Notification Center uses the existing list item renderer; no per-event icon work is required for v1. (Adding a custom icon would touch `NotificationListItem.tsx` and is deliberately deferred — the default room-context icon is fine.)

## 7. i18n additions (EN/TH)

`src/i18n/locales/en.ts`:

```
manageProject.projectNameLabel: 'Project name'
manageProject.renameTitle: 'Rename project'
manageProject.renameInputLabel: 'Project name'
manageProject.renamePlaceholder: 'e.g. Japan 2027'
manageProject.renameSave: 'Save'
manageProject.renameCancel: 'Cancel'
manageProject.renameSuccess: 'Project renamed.'
manageProject.renameNonCreatorHint: 'Only the project creator can rename this.'
manageProject.renameErrorEmpty: 'Enter a project name.'
manageProject.renameErrorTooLong: 'Keep the name under 60 characters.'
manageProject.renameErrorControlChars: 'Name can\'t contain line breaks or control characters.'
manageProject.renameErrorUnchanged: 'New name is the same as the current one.'
manageProject.renameErrorNotCreator: 'Only the project creator can rename this project.'
manageProject.renameErrorArchived: 'You can\'t rename an archived project.'
manageProject.renameErrorGeneric: 'Couldn\'t rename the project. Try again.'

notifications.events.roomRenamed(name, oldName, newName) → {
  title: 'Project renamed',
  body: `${name} renamed "${oldName ?? 'the project'}" to "${newName ?? 'a new name'}".`,
  ctaLabel: 'Open project',
}
```

`src/i18n/locales/th.ts`:

```
manageProject.projectNameLabel: 'ชื่อโปรเจกต์'
manageProject.renameTitle: 'เปลี่ยนชื่อโปรเจกต์'
manageProject.renameInputLabel: 'ชื่อโปรเจกต์'
manageProject.renamePlaceholder: 'เช่น ญี่ปุ่น 2027'
manageProject.renameSave: 'บันทึก'
manageProject.renameCancel: 'ยกเลิก'
manageProject.renameSuccess: 'เปลี่ยนชื่อโปรเจกต์แล้ว'
manageProject.renameNonCreatorHint: 'เฉพาะผู้สร้างโปรเจกต์เท่านั้นที่เปลี่ยนชื่อได้'
manageProject.renameErrorEmpty: 'กรุณากรอกชื่อโปรเจกต์'
manageProject.renameErrorTooLong: 'ชื่อต้องไม่เกิน 60 ตัวอักษร'
manageProject.renameErrorControlChars: 'ชื่อห้ามมีอักขระควบคุมหรือขึ้นบรรทัดใหม่'
manageProject.renameErrorUnchanged: 'ชื่อใหม่เหมือนชื่อเดิม'
manageProject.renameErrorNotCreator: 'เฉพาะผู้สร้างโปรเจกต์เท่านั้นที่เปลี่ยนชื่อโปรเจกต์ได้'
manageProject.renameErrorArchived: 'ไม่สามารถเปลี่ยนชื่อโปรเจกต์ที่เก็บถาวรแล้ว'
manageProject.renameErrorGeneric: 'เปลี่ยนชื่อโปรเจกต์ไม่สำเร็จ กรุณาลองใหม่'

notifications.events.roomRenamed(name, oldName, newName) → {
  title: 'เปลี่ยนชื่อโปรเจกต์แล้ว',
  body: `${name} เปลี่ยนชื่อ "${oldName ?? 'โปรเจกต์'}" เป็น "${newName ?? 'ชื่อใหม่'}"`,
  ctaLabel: 'เปิดโปรเจกต์',
}
```

Error-mapping table (client → user-facing copy):

| RPC error                                  | Mapped string                                |
|--------------------------------------------|----------------------------------------------|
| `name required` (22023)                    | `renameErrorEmpty`                           |
| `name too long` (22023)                    | `renameErrorTooLong`                         |
| `name contains control characters` (22023) | `renameErrorControlChars`                    |
| `only the creator can rename this room`    | `renameErrorNotCreator`                      |
| `room is archived`                         | `renameErrorArchived`                        |
| `room not found` / anything else           | `renameErrorGeneric`                         |

## 8. ManageProject UI changes (summary)

- Add `ManageModal` union value `'rename-room'`.
- Add a new SettingsList row "Project name" near the top of the screen.
- Creator: chevron + `onPress = () => openModal('rename-room')`.
- Non-creator: read-only, hint line beneath, no press handler.
- New modal contains a single text input, char counter, validation copy, Save / Cancel buttons.
- On success: close modal, `setMessage(copy.manageProject.renameSuccess)`.
- No layout reflow elsewhere; the existing invite-code / quick-amounts / buckets rows stay where they are.

## 9. Security / RLS considerations

Audit of the proposed RPC against existing policies:

- `rooms_update_creator` (migration 0002 / 0003) — already lets the creator update their `rooms` row. Our SECURITY DEFINER bypasses that policy anyway, but inside the function we re-verify `created_by = auth.uid()` and `archived_at is null`, so we are *stricter* than the raw policy (which allows updating archived rooms). Good.
- `room_members_select` (0012) — uses `public.is_room_member` to avoid recursion. We do **not** read `room_members` from the client; we read it inside the RPC where SECURITY DEFINER bypasses RLS. We must remember to keep `search_path = public` so the policy/helper resolves correctly.
- `notifications` insert policy — bypassed by SECURITY DEFINER on `_insert_partner_notification`, which is the same path already used by every other `notify_*` RPC. No new policy work.
- `push_safe = false` is honoured by the existing scheduled-push pipeline (`scheduled-saving-reminders` and friends filter on `push_safe = true` when fanning out web-push). Belt-and-braces: there is also no edge function reading `event_key = 'room_renamed'`, so even a future regression in the filter could not push this event.
- Race: two creator devices renaming simultaneously. `select … for update` on `rooms` serialises them; the second call will see the first's new name and (a) treat it as a no-op rename if identical, or (b) write its own value and fire a fresh fan-out. Both outcomes are correct.
- Authorisation check happens *before* the update, so a non-creator REST attempt to call the RPC fails with `42501` and writes nothing.
- A non-creator who tries to update `rooms.name` via direct PostgREST is blocked by `rooms_update_creator` (only the creator can update). They would not get the centralised validation / notification, but they cannot perform the action at all, so we accept the small redundancy.

### Helper reuse audit (per task brief)

- `_insert_partner_notification` (0040) — **reusable as-is**. Accepts `push_safe boolean`; passing `false` keeps delivery in-app only. Hard-codes `category = 'partner_activity'` and `channel_policy = 'in_app'`, which matches our requirement. Returns the inserted id or null on dedupe conflict; we ignore the return value inside the fan-out loop.
- `_actor_display_name` (0040) — reusable for the actor's display name with safe fallback.
- `_other_room_member` (0040) — **must NOT be reused.** It returns at most one recipient (`limit 1`). Rename must fan out to *every* other member. Iterate `room_members` directly inside the new RPC.
- `is_room_member` (0012) — not needed: we already verify the caller is the creator (which implies membership).
- `room_members_for_room` (0016) — exists as a separate RPC for client reads. Not the right shape for in-RPC iteration; we query `room_members` directly inside SECURITY DEFINER instead.
- `push_safe` — this is a **column on `notifications`**, not a helper function. Setting it to `false` in the insert is the entire mechanism for blocking push delivery. There is no `push_safe()` helper to call.

Conclusion: the only reusable helpers are `_insert_partner_notification` and `_actor_display_name`. The recipient-resolution helper is single-recipient and must be replaced by an inline loop in this RPC.

## 10. Implementation steps

Order chosen so each step is independently verifiable:

1. Write the migration `00XX_rename_room.sql` (single statement block, no DROP of prior objects, additive).
2. Apply the migration locally; smoke-test the RPC via `psql` / Supabase SQL editor against a seeded room with one creator + one non-creator.
3. Add `'room_renamed'` to `NotificationEventKey` in `src/types/index.ts`.
4. Add EN + TH copy entries listed in §7 to `src/i18n/locales/en.ts` and `src/i18n/locales/th.ts`. Confirm `Messages` interface updates (or its equivalent shape source) compile.
5. Add the `case 'room_renamed':` branch to `src/i18n/notificationCopy.ts`.
6. Widen `setRooms` in `src/components/RoomContext/RoomContextValue.ts` to `Dispatch<SetStateAction<Room[]>>`. Build to confirm no callers regress.
7. Add `renameRoom(roomId, name)` to `src/hooks/useRooms.ts` using the functional `setRooms(prev => prev.map(...))` pattern. Export it from the hook's return object.
8. Wire the new "Project name" row + modal into `src/pages/ManageProject.tsx`, including the creator/non-creator branch.
9. Run `npm run build` and `npm run lint`.
10. Manual QA per §12.
11. Report changed files, checks run, residual risks, and any deferred follow-ups (e.g. a future task to harden the rooms-update RLS to non-name columns only).

Do not bundle any unrelated work (no token churn, no refactors, no fixes to the existing partner notifications, no edge-function changes).

## 11. Acceptance criteria

- Creator can open the rename modal from ManageProject, type a new name (trimmed, ≤ 60 chars, no control chars, different from current), tap Save, and see:
  - The header / project list / dashboard chrome reflect the new name on their device.
  - A single `room_renamed` in-app notification appears in every other current member's Notification Center, with EN/TH copy quoting both old and new names.
  - No Web Push is delivered for the rename event on any member's device (since `push_safe = false` and there is no edge-function path for this event).
- Saving the same trimmed name (no actual change) is a no-op — no DB write, no notification.
- Whitespace-only or empty names are rejected client-side and server-side with a clear message.
- Names longer than 60 chars (after trim) are rejected client-side and server-side.
- Names containing control characters are rejected server-side.
- A non-creator never sees the modal; the row is read-only and labelled.
- A non-creator who calls `supabase.rpc('rename_room', …)` directly receives a `42501` error.
- Calling `rename_room` on an archived room returns `42501 room is archived` for both creator and non-creator.
- `npm run build` and `npm run lint` pass.

## 12. Manual QA checklist

Setup: a 2-user room with member A (creator) and member B (non-creator).

- [ ] Member A: ManageProject shows "Project name" row with chevron; tapping it opens the modal pre-filled with the current name.
- [ ] Member B: ManageProject shows "Project name" row without chevron, and the non-creator hint underneath; tapping it does nothing.
- [ ] Member A: rename to a new valid name → modal closes, success toast appears, header + project list update locally.
- [ ] Member B (in another browser/profile): receives exactly one in-app notification with the EN body `<A's display name> renamed "<old>" to "<new>".`. Tapping it routes to `/dashboard`.
- [ ] Member B: no Web Push is delivered (verify via DevTools push log / service worker console / device).
- [ ] Member A: rename to the same trimmed value → Save is disabled at the client; if forced via dev tools, the RPC returns the same name and no notification appears for B.
- [ ] Member A: try empty name / whitespace-only → blocked at client; if forced, RPC returns `name required`.
- [ ] Member A: try 61-character name → blocked at client; if forced, RPC returns `name too long`.
- [ ] Member A: try a name containing `\t` or `\n` (use clipboard) → blocked client-side or by RPC (`name contains control characters`).
- [ ] Member B: attempt `supabase.rpc('rename_room', …)` via DevTools → receives `42501 only the creator can rename this room`.
- [ ] Member A: archive the room, then attempt rename via RPC → `42501 room is archived`.
- [ ] Toggle UI language to Thai → modal labels, validation messages, success toast, and the notification body all read in Thai with no missing-key fallbacks.
- [ ] Rename twice in quick succession (inside the same Bangkok minute) → only one notification row is inserted for member B due to the dedupe key.
- [ ] Rename, wait 90 seconds, rename again → two distinct notification rows for member B.
- [ ] Confirm in `notifications` table that `room_renamed` rows have `push_safe = false` and `channel_policy = 'in_app'`.

## 13. Risk level

**Low.**

- The change is additive at the DB layer (one new RPC, no schema or policy changes).
- It reuses two well-trodden helpers from migration 0040.
- Frontend changes are localised to `useRooms`, one context type widening, one new modal in `ManageProject`, and i18n / notification-copy additions.
- No push transport changes, no edge functions touched, no money-state surfaces touched.
- The biggest secondary risk is forgetting to update the `RoomContextValue.setRooms` type — caught by TypeScript build.

## 14. Rollback plan

DB:
- New migration is additive. Rollback = a follow-up migration that drops `public.rename_room(uuid, text)`. Notification rows already inserted remain harmless (they're read-only history; the renderer's `default:` branch in `notificationCopy.ts` falls back to the stored `title` / `body`, which we wrote server-side).

Client:
- Revert the four file changes (`useRooms.ts`, `RoomContextValue.ts`, `ManageProject.tsx`, `types/index.ts`) and the i18n / notification-copy additions in one commit. The room name remains editable by the creator at the DB level via `rooms_update_creator`, so existing data continues to display correctly.

No data migration, no destructive operation, no irreversible side effects.
