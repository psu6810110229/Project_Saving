# Task 23 UX/UI Spec - Notification System

## Claude Usage Guide

For implementation, do not read this whole file every time.

For 23.1, read:
- MVP Scope
- Data Model / UI Placement
- RLS / Security
- Claude Implementation Handoff
- Acceptance Criteria

For later phases, read only the matching phase section.

If a file has already been read in this session, use targeted search or section reads instead of rereading the full file.

This is a UX/UI implementation spec for Claude Code. It covers only the user-facing notification experience. Backend triggers, notification event storage, edge functions, RLS, delivery jobs, and deduping rules belong in `docs/plans/23-notification-system.md`.

GO-OUT is a mobile-first 2-person shared savings tracker. Notifications should feel like calm project updates from a shared savings space, not alarms, guilt, or growth spam.

## 1. UX Goal

Notifications help users notice useful savings moments without adding pressure.

Notifications are for:

- Partner activity worth reviewing.
- Nudges intentionally sent by the partner.
- Saving reminders the user opted into.
- Project events that affect where the user should look next.
- Immediate confirmation after the user performs an action.

Notifications are not for:

- Shaming missed deposits.
- Creating urgency where none exists.
- Replacing the Dashboard.
- Opening the app to a dead homepage.
- Broadcasting every small calculation change.
- Asking for notification permission on first app open.

Core rule: every notification must answer "what happened?" and "where should I go?".

## 2. Notification Surfaces

### Push Notifications

Use push only for important moments that are useful outside the app.

Use for:

- Nudge received.
- Saving reminder.
- Partner deposited.
- Bucket goal reached.
- Goal/plan changes that affect the shared project.
- Streak milestone only if positive and infrequent.

Do not use push for:

- Inline form errors.
- Successful local saves while the app is open.
- Every balance check.
- Every dashboard recalculation.
- Permission upsells.

Push requirements:

- Title under 45 characters when possible.
- Body under 90 characters when possible.
- Must include a route target.
- Must not use all caps, "warning", "overdue", "failed", or "lost".
- If user taps push while app is open, focus app and navigate to target.

### In-App Notification Center

Use the notification center for reviewable activity. It is the history the user can open when they want context.

Use for:

- Push-backed events.
- Partner activity that may not need push.
- Project changes.
- Nudge history.
- Read/unread state.

Do not use the notification center for:

- Transient form validation.
- One-off button success text that does not matter later.
- Internal system/debug events.

Notification center requirements:

- Mobile-first full-screen subpage for MVP.
- Access from Dashboard bell.
- Also reachable from Profile settings.
- List items are tappable and navigate to useful route targets.
- Empty state is calm and compact.

### Toast/Snackbar

Use toast/snackbar only for immediate feedback after the current user acts.

Use for:

- "Nudge sent."
- "Notification settings updated."
- "Notifications enabled."
- "Reminder saved."
- "Marked as read."

Do not use toast/snackbar for:

- Partner activity received in the background.
- Reminder prompts.
- Permission education cards.
- Anything the user needs to review later.

MVP note: the app currently uses inline message banners instead of a global toast component. For Task 23, implement a small product-native snackbar only if needed by notification flows. Keep it fixed near the bottom above `BottomNav`.

## 3. User Journeys

### First enable prompt after creating a saving plan

1. User saves their first Saving Plan.
2. Saving Plan page shows normal success feedback first.
3. After the success state is visible, show a `NotificationPermissionCard` below the plan summary or CTA area.
4. Card copy: "Get quiet reminders for this plan" with one short body line.
5. Primary action: `Enable reminders`.
6. Secondary action: `Not now`.
7. If enabled, request browser permission, subscribe the device, show success snackbar, and keep the user on Saving Plan.
8. If declined with `Not now`, hide the card for this moment and do not ask again until another meaningful moment.
9. If browser permission is denied, show denied state with a short recovery hint and a settings link.

### First enable prompt after first deposit

1. User completes their first deposit.
2. Deposit confirmation completes normally.
3. On return to Dashboard or Add Money success state, show a compact `NotificationPermissionCard`.
4. Card copy should frame partner/project updates, not reminders only.
5. Primary action: `Enable updates`.
6. Secondary action: `Not now`.
7. On enable success, show snackbar: "Notifications are on for this device."
8. On `Not now`, dismiss without blocking deposit flow.

### User taps Nudge and needs permission

1. User taps `Nudge partner`.
2. If current device is not subscribed and permission has not been denied, show permission card or inline confirm state before calling `Notification.requestPermission()`.
3. Primary action: `Enable and send`.
4. Secondary action: `Not now`.
5. On enable success, subscribe device, send the nudge, and show snackbar: "Nudge sent to {partnerName}."
6. If partner has no enrolled devices, show inline message: "{partnerName} has not enabled notifications yet."
7. If permission is denied, show denied state and do not retry automatically.

### User receives a nudge

1. Push appears with partner name and calm copy.
2. User taps push.
3. App opens `/dashboard`.
4. Dashboard may highlight the notification center unread badge, but should not open a modal automatically.
5. Notification center contains the nudge item.
6. Tapping the item navigates to `/dashboard` or `/add` depending on the event target selected by system spec.

### User gets saving reminder

1. Push appears at the reminder time only if reminders are enabled.
2. Copy references the active plan without guilt.
3. User taps push.
4. App opens `/saving-plan` for plan context or `/add` when the CTA is direct deposit.
5. Notification center item remains available until read.

### User receives partner activity notification

1. Partner logs a deposit or project-relevant activity.
2. In-app center gets an unread item.
3. Push is sent only if partner activity push is enabled.
4. Dashboard bell shows unread badge.
5. User opens center and taps item.
6. App navigates to the best supported destination:
   - Deposit: `/dashboard?section=activity` if section targeting is implemented; otherwise `/dashboard`.
   - Bucket event: `/dashboard?section=buckets` if implemented; otherwise `/dashboard`.

### User taps a notification and lands in the correct route

1. Tap from push or center calls one shared navigation resolver.
2. Resolver reads the notification `targetRoute` and optional `targetSection`.
3. If route is supported, navigate there.
4. If section is supported, scroll/focus that section after page render.
5. If section is not supported, route-level fallback still opens the right screen.
6. Mark notification as read after successful navigation intent.
7. Never fall back to app root unless the target is invalid.

### User turns notifications off

1. User opens Profile -> Notifications.
2. User turns off `Master notifications`.
3. All category toggles visually disable.
4. Push subscription remains a device state unless user chooses `Turn off this device` if implemented by system spec.
5. Notification center still shows historical in-app items.
6. Snackbar: "Notifications are off."
7. Dashboard bell remains visible; unread center still works for in-app review.

## 4. UX Placement

### Dashboard Bell Icon

Recommended MVP placement:

- Add `BellIconButton` in the Dashboard header right side.
- Place it before or beside the existing `NudgeButton`.
- Keep the header compact: project title on left, actions on right.
- If both bell and nudge do not fit on narrow screens, show bell as icon-only and keep nudge as compact button below/right as it works today.
- Bell should show unread badge only when unread count is greater than 0.

Do not add a Notifications bottom tab.

### Profile Or Manage Project Settings Row

Recommended MVP placement:

- Add a `Notifications` row to Profile `SettingsList`.
- Description examples:
  - Enabled: `Push on this device - 3 types on`
  - Disabled: `Off`
  - Permission denied: `Permission blocked in browser`
  - Unsupported: `Push unavailable on this device`
- Row opens Notification Settings.

Manage Project may also include a Notifications row later if project-level settings become room-scoped. MVP should use Profile because notification permission is account/device-adjacent.

### Notification Center Panel/Page

Recommended MVP:

- Dedicated subpage opened by Dashboard bell, e.g. `/notifications`.
- Use existing mobile subpage structure: back icon/header, max-width app shell, warm card list.
- Do not use a floating modal for the main center in MVP; long lists and settings links need stable scrolling.

If implementation avoids new route, a bottom sheet is acceptable only if it uses the existing `Modal`/`BucketSheet` visual language and remains readable at `max-h-[88dvh]`.

### Permission Prompt Card

Place permission cards only after meaningful actions:

- Saving Plan saved.
- First deposit saved.
- Nudge initiated.
- User opens Notification Settings with permission not granted.

Do not show on first app open, login, project setup start, or random Dashboard load.

### Toast/Snackbar Position

MVP snackbar position:

- Fixed bottom center.
- Inside app max width.
- Above `BottomNav`: `bottom-[calc(env(safe-area-inset-bottom)+5.75rem)]`.
- `mx-4`, `rounded-xl`, `bg-ink`, `text-ink-inverse`, `shadow-soft`.
- Auto-dismiss after 2.5 to 3 seconds.
- Provide close button only for error/permission messages that need reading.

## 5. Atomic Components

### BellIconButton

Purpose:

- Opens notification center from Dashboard or app header.

Props/data needed:

- `unreadCount: number`
- `disabled?: boolean`
- `onClick: () => void`
- `ariaLabel?: string`

Visual states:

- Default: `IconButton` ghost style with `IconBell`.
- Unread: badge overlaps top-right.
- Active/pressed: current `active:scale-[0.96]`.
- Disabled: opacity 50%.

Accessibility notes:

- `aria-label` should include unread count: `Notifications, 3 unread`.
- Badge text should be screen-reader visible through the button label, not only visual.

### NotificationBadge

Purpose:

- Shows unread count on bell or settings row.

Props/data needed:

- `count: number`
- `max?: number` default `9`
- `size?: 'sm' | 'md'`

Visual states:

- Hidden when count is 0.
- `1-9`: numeric.
- `10+`: `9+` by default.
- Use `bg-brand-500 text-ink-inverse`.
- Size `sm`: 16px circle; `md`: 20px circle.

Accessibility notes:

- If inside `BellIconButton`, hide badge from screen readers and expose count via button label.
- If standalone, use `aria-label="{count} unread notifications"`.

### NotificationDot

Purpose:

- Marks unread list items without loud badges.

Props/data needed:

- `unread: boolean`

Visual states:

- Unread: 8px `bg-brand-500` dot.
- Read: reserve the same width but invisible to avoid text shift.

Accessibility notes:

- Do not rely on color only. The list item should also include `aria-label` or hidden text saying unread.

### NotificationIcon

Purpose:

- Provides a calm event-type marker.

Props/data needed:

- `type: NotificationEventType`
- `read?: boolean`

Visual states:

- Use existing `IconBubble`.
- Default tone `peach`.
- Muted/read tone can use `muted`.
- Avoid danger tone unless a true error state, not normal notification.

Recommended icon mapping:

- `nudge`: `IconBell`
- `partner_deposited`: `IconPiggyBank`
- `saving_reminder`: `IconCalendar`
- `balance_checked`: `IconVault`
- `goal_changed`: `IconEdit`
- `plan_changed`, `plan_paused`, `plan_resumed`: `IconCalendar`
- `bucket_added`, `bucket_updated`, `bucket_goal_reached`: `IconPiggyBank`
- `room_joined`, `room_left`: `IconUser`
- `overtaking`, `streak_milestone`: `IconTrendingUp`

Accessibility notes:

- Decorative inside a labeled item: `aria-hidden`.

### NotificationTimestamp

Purpose:

- Shows when an item happened.

Props/data needed:

- `occurredAt: string`
- Optional absolute `title` text.

Visual states:

- Relative copy from existing `formatRelativeTime`: `just now`, `4m ago`, `2h ago`, `3d ago`.
- `text-xs text-ink-muted`.

Accessibility notes:

- Include full timestamp in `title` or `aria-label` if practical.

### NotificationChip

Purpose:

- Compact status/category label.

Props/data needed:

- `label: string`
- `tone?: 'peach' | 'white' | 'leaf' | 'danger'`

Visual states:

- Reuse `Chip`.
- Examples: `Reminder`, `Partner`, `Plan`, `Read`.
- Do not show more than one chip per list item in MVP.

Accessibility notes:

- Chip text must be actual text, not icon-only.

### PermissionStatusPill

Purpose:

- Displays browser/device push state in settings and permission cards.

Props/data needed:

- `permission: 'default' | 'granted' | 'denied' | 'unsupported'`
- `subscribed: boolean`

Visual states:

- Enabled: `On this device`, `bg-brand-50 text-brand-800`.
- Permission needed: `Needs permission`, `bg-well text-ink-muted`.
- Denied: `Blocked`, `bg-danger-soft text-danger`.
- Unsupported: `Unavailable`, `bg-well text-ink-muted`.
- Granted but not subscribed: `Permission on`, `bg-brand-50 text-brand-800`.

Accessibility notes:

- Include exact status text.

### NotificationToggle

Purpose:

- Toggle master and category settings.

Props/data needed:

- `checked: boolean`
- `disabled?: boolean`
- `label: string`
- `description?: string`
- `onChange: (checked: boolean) => void`

Visual states:

- On: `bg-brand-500`, knob right, optional halo avoided for calmness.
- Off: `bg-well`, knob left.
- Disabled: opacity 50%, no pointer events.
- Saving: optional spinner or disabled state.

Accessibility notes:

- Native `button role="switch"` or checkbox input.
- Use `aria-checked`.
- Label must be clickable.

## 6. Molecule Components

### NotificationListItem

Content:

- Leading `NotificationIcon`.
- Title line.
- Body line, max 2 lines.
- Timestamp.
- Optional `NotificationChip`.
- `NotificationDot` for unread.

States:

- Unread: slightly warmer surface `bg-brand-50/60` or left dot.
- Read: `bg-surface`.
- Pressed: `active:scale-[0.99]`.
- Disabled target: should not happen; show error state if target invalid.

Click behavior:

- Entire row is tappable.
- Navigate to target route.
- Mark read on click.
- If target route fails, keep item unread and show snackbar: "Could not open that update."

Mobile layout:

- `rounded-xl bg-surface shadow-soft p-3`.
- `flex items-start gap-3`.
- Min touch target 44px.
- Body text truncates naturally, no horizontal scroll.

### NotificationGroup

Content:

- Section label such as `Today`, `Yesterday`, `Earlier`.
- List of `NotificationListItem`.

States:

- Hidden when no items.
- No complex grouping beyond date labels in MVP.

Click behavior:

- Group itself is not clickable.

Mobile layout:

- `section` with `SectionLabel` then `flex flex-col gap-2`.

### NotificationPermissionCard

Content:

- Title.
- One short body line.
- `PermissionStatusPill`.
- Primary button.
- Secondary text button.

States:

- Not asked: enable CTA visible.
- Requesting: primary button disabled with `Enabling...`.
- Enabled/subscribed: success state with no repeated CTA.
- Denied: recovery hint and `Open browser settings` guidance.
- Unsupported: explain unavailable in one line.

Click behavior:

- Primary calls permission/subscription flow.
- Secondary dismisses for current context.
- In settings, secondary can be omitted.

Mobile layout:

- `rounded-xl bg-surface p-4 shadow-soft`.
- Leading `IconBubble` with `IconBell`.
- Buttons full-width stacked on small screens.

### NotificationSettingsSection

Content:

- Section label `Notifications`.
- Master toggle.
- Category toggles.
- Permission/device status card or row.

States:

- Loading settings: skeleton rows.
- Save error: inline soft danger message.
- Master off: category rows disabled and visually muted.

Click behavior:

- Toggle changes save immediately.
- Show snackbar after success.
- Show inline error if save fails.

Mobile layout:

- Full-width vertical stack.
- Rows reuse `SettingsRow` density but toggles replace chevron.

### NudgeNotificationCard

Content:

- Title: `{partnerName} sent a nudge`.
- Body: short partner/project message.
- CTA: `Open Dashboard` or `Add deposit`.

States:

- Unread/read.
- If partner missing: use `Your partner`.

Click behavior:

- Default route `/dashboard`.
- If CTA is direct action, `/add`.

Mobile layout:

- Same as `NotificationListItem`; this is a typed item preset, not a separate visual system.

### SavingReminderCard

Content:

- Title: `Saving reminder`.
- Body references plan cadence or next suggested action.
- CTA: `View plan` or `Add deposit`.

States:

- Plan active.
- Plan paused: do not send push; in-app item may say `Plan is paused` only if generated by plan action.
- No active plan: should not appear.

Click behavior:

- `/saving-plan` for plan review.
- `/add` only when the message asks user to record a deposit.

Mobile layout:

- Same row/card pattern.

### PartnerActivityItem

Content:

- Actor name.
- Event summary.
- Timestamp.
- Optional amount/bucket name when visible.

States:

- Partner deposited.
- Partner checked balance.
- Partner changed goal/plan.
- Partner added/updated bucket.

Click behavior:

- Deposits and balance: `/dashboard?section=activity` when supported, else `/dashboard`.
- Buckets: `/dashboard?section=buckets` when supported, else `/dashboard`.
- Goal/room: `/manage-project`.

Mobile layout:

- Match `ActivityTimelineRow` density.
- Do not show private notes or storage details.

### NotificationEmptyState

Content:

- Title: `No notifications yet`.
- Body: `Updates from your project will show up here.`
- Optional CTA: `Back to Dashboard`.

States:

- True empty.
- Empty after filters is deferred because filters are deferred.

Click behavior:

- CTA navigates `/dashboard`.

Mobile layout:

- One compact `StatusCard` style card.
- No illustration required.

### NotificationErrorState

Content:

- Title: `Could not load notifications`.
- Body with short recoverable message.
- CTA: `Try again`.

States:

- Fetch failed.
- Mark-read failed should be snackbar, not full-page error.

Click behavior:

- Retry reloads center.

Mobile layout:

- `rounded-xl bg-surface p-5 shadow-soft`.
- Danger color only for small helper text, not whole card.

## 7. Page / Organism UI

### NotificationCenter

Layout:

- Full-screen subpage inside existing `AppShell`.
- Header:
  - Back icon.
  - Eyebrow: `Notifications`.
  - Title: `Updates`.
  - Optional right action: `Mark all read` only if simple and supported.
- Optional top permission card when permission is useful and not granted.
- Content groups: `Today`, `Yesterday`, `Earlier`.
- Bottom spacing must clear `BottomNav`.

Hierarchy:

1. Header.
2. Permission/device status prompt if relevant.
3. Unread items first within date groups by time.
4. Read items.
5. Empty/error states.

Empty/loading/error states:

- Loading: 4 skeleton rows using existing `Skeleton`.
- Empty: `NotificationEmptyState`.
- Error: `NotificationErrorState`.

Interaction rules:

- Opening center does not automatically mark all read.
- Tapping an item marks only that item read.
- Use route fallback if section target unsupported.
- Keep list scroll position during mark-read updates.
- Do not interrupt with permission prompt modal.

### NotificationSettings

Layout:

- Recommended MVP route or full-screen subpage opened from Profile row.
- Header:
  - Back icon.
  - Eyebrow: `Profile`.
  - Title: `Notifications`.
- Sections:
  - Push/device status.
  - Master notifications.
  - Categories.
  - Deferred row for quiet hours if visible at all.

Hierarchy:

1. Permission status card.
2. Master toggle.
3. Category toggles:
   - Nudges.
   - Saving reminders.
   - Partner activity.
4. Device subscription action if supported:
   - `Turn off this device` or `Enable this device`.

Empty/loading/error states:

- Loading: skeleton rows.
- Error: inline `Could not load notification settings. Try again.`
- Unsupported: show settings but push status says unavailable; category toggles can still control in-app center preferences if system supports them.

Interaction rules:

- Master off disables category toggles.
- Permission denied does not disable in-app center, only push delivery.
- Toggle saves should be immediate and reversible.
- Do not ask browser permission until user taps an enable CTA.

### Permission Onboarding Card

Layout:

- Use `NotificationPermissionCard`.
- Place after meaningful success states:
  - Saving Plan saved: under plan summary or success message.
  - First deposit: under success feedback on Add Money or Dashboard return.
  - Nudge: inline near nudge control.

Hierarchy:

1. Title.
2. Body.
3. Status pill.
4. Primary action.
5. Secondary action.

States:

- Default: not asked.
- Loading: enabling.
- Enabled: success.
- Denied: blocked with recovery hint.
- Unsupported: unavailable.

Interaction rules:

- One prompt per meaningful moment.
- `Not now` dismisses without changing settings.
- Denied state should not immediately show another browser prompt.

### Dashboard Bell Placement

Layout:

- In Dashboard header right action cluster.
- `BellIconButton` should be icon-only.
- `NudgeButton` remains a separate action.

Hierarchy:

- Bell should be visually quieter than the nudge CTA.
- Unread badge is enough; no text label in Dashboard header.

States:

- 0 unread: no badge.
- 1-9 unread: numeric badge.
- 10+ unread: `9+`.
- Loading unread count: show bell without badge.

Interaction rules:

- Tap bell navigates to/open `NotificationCenter`.
- Do not auto-prompt for permission from bell tap unless user chooses from center.

## 8. Deep-Link / Tap Target UX

Every notification must have a destination. Use route-level targets first. Section targets are allowed only after the app implements scroll/focus handling for those query params.

| Event type | Preferred destination | Section target | Fallback |
|---|---|---|---|
| Partner deposited | `/dashboard?section=activity` | `activity` | `/dashboard` |
| Saving reminder | `/saving-plan` or `/add` | none | `/saving-plan` |
| Nudge received | `/dashboard` or `/add` | none | `/dashboard` |
| Balance checked | `/check-balance` or `/dashboard?section=activity` | `activity` | `/dashboard` |
| Goal changed | `/manage-project` | none | `/manage-project` |
| Plan changed | `/saving-plan` | none | `/saving-plan` |
| Plan paused/resumed | `/saving-plan` | none | `/saving-plan` |
| Bucket added/updated | `/dashboard?section=buckets` | `buckets` | `/dashboard` |
| Bucket goal reached | `/dashboard?section=buckets` | `buckets` | `/dashboard` |
| Room joined/left | `/manage-project` | none | `/manage-project` |
| Overtaking | `/dashboard?section=progress` | `progress` | `/dashboard` |
| Streak milestone | `/dashboard?section=progress` | `progress` | `/dashboard` |

Navigation requirements:

- Store both `targetRoute` and optional `targetSection`.
- Never emit a notification with empty target.
- Service worker click handler should open the target URL, not just `/dashboard`.
- If an existing client is focused but on the wrong route, navigate it to the target.
- If query section is unsupported, target route must still be useful.
- Do not deep-link to modals for MVP.

## 9. Copywriting System

Tone rules:

- Helpful, concise, calm.
- Use partner/project language.
- Prefer "record", "check", "view", "open".
- Avoid guilt, threats, ranking insults, and alarm words.

Avoid:

- `You failed`
- `Warning`
- `Overdue`
- `You lost`
- `Your streak is dying`
- `Hurry up`
- `Don't fall behind`

Copy table:

| Event type | Push title | Push body | In-app title | In-app body | CTA label |
|---|---|---|---|---|---|
| Partner deposited | `{partnerName} added savings` | `{amount} was recorded for {bucketName}.` | `{partnerName} added savings` | `{amount} was recorded for {bucketName}.` | `View activity` |
| Saving reminder | `Saving reminder` | `A small update keeps your plan current.` | `Saving reminder` | `Your plan is ready when you want to record today's savings.` | `View plan` |
| Nudge received | `{partnerName} sent a nudge` | `They are checking in on the shared goal.` | `{partnerName} sent a nudge` | `Open the project when you are ready.` | `Open Dashboard` |
| Balance checked | `Balance checked` | `{actorName} checked the project balance.` | `{actorName} checked balance` | `The latest balance check is available in activity.` | `View activity` |
| Goal changed | `Project goal updated` | `{actorName} updated the shared goal.` | `Project goal updated` | `{actorName} changed the target or date.` | `Manage project` |
| Plan changed | `Saving plan updated` | `Your plan details were updated.` | `Saving plan updated` | `The current plan has new details.` | `View plan` |
| Plan paused | `Saving plan paused` | `Reminders are quiet while the plan is paused.` | `Saving plan paused` | `The plan is paused until it is resumed.` | `View plan` |
| Plan resumed | `Saving plan resumed` | `Reminders can continue for this plan.` | `Saving plan resumed` | `The plan is active again.` | `View plan` |
| Bucket added | `Bucket added` | `{bucketName} was added to the project.` | `Bucket added` | `{actorName} added {bucketName}.` | `View buckets` |
| Bucket updated | `Bucket updated` | `{bucketName} was updated.` | `Bucket updated` | `{actorName} updated {bucketName}.` | `View buckets` |
| Bucket goal reached | `Bucket goal reached` | `{bucketName} reached its target.` | `Bucket goal reached` | `{bucketName} is fully saved.` | `View buckets` |
| Room joined | `Partner joined` | `{partnerName} joined {projectName}.` | `Partner joined` | `{partnerName} is now in the project.` | `Manage project` |
| Room left | `Partner left` | `{partnerName} left the project.` | `Partner left` | `The project is still available to you.` | `Manage project` |
| Overtaking | `Progress changed` | `{actorName} moved ahead in recorded savings.` | `Progress changed` | `The shared progress order changed.` | `View progress` |
| Streak milestone | `Savings streak` | `{count} saving days recorded.` | `Savings streak` | `{count} saving days have been recorded.` | `View progress` |

Permission prompt copy:

- Title: `Stay in the loop`
- Body: `Get quiet updates for nudges, reminders, and partner activity.`
- Primary: `Enable notifications`
- Secondary: `Not now`

Saving Plan prompt variant:

- Title: `Get quiet reminders`
- Body: `GO-OUT can remind you when it is time to check your plan.`
- Primary: `Enable reminders`
- Secondary: `Not now`

Deposit prompt variant:

- Title: `Follow project updates`
- Body: `Get notified when your partner adds savings or sends a nudge.`
- Primary: `Enable updates`
- Secondary: `Not now`

Denied copy:

- Title: `Notifications are blocked`
- Body: `Enable notifications in your browser settings to receive push updates on this device.`
- CTA: `Open settings guide`

Unsupported copy:

- Title: `Push is unavailable here`
- Body: `This browser cannot receive GO-OUT push notifications. In-app updates still appear here.`

## 10. Permission UX

### When To Ask

Ask only after meaningful moments:

- User creates or saves a Saving Plan.
- User records their first deposit.
- User taps a nudge action that requires push setup.
- User opens Notification Settings and taps enable.

Do not ask:

- On first app open.
- During login/auth callback.
- Before project setup.
- On every Dashboard visit.
- Immediately after `Not now`.

### Prompt Copy

Default card:

- Title: `Stay in the loop`
- Body: `Get quiet updates for nudges, reminders, and partner activity.`
- Primary: `Enable notifications`
- Secondary: `Not now`

Browser prompt timing:

- Show product card first.
- Call `Notification.requestPermission()` only after the primary button.
- Do not trigger browser permission from page load.

### Not Now Behavior

- Dismiss the card for the current meaningful moment.
- Do not change category settings.
- Do not mark browser permission as denied.
- Allow the user to enable later from Notification Settings.
- System spec should define cooldown/storage; UI must honor `dismissed` state when provided.

### Denied State

Show:

- Status pill: `Blocked`.
- Body: `Enable notifications in your browser settings to receive push updates on this device.`
- No repeated browser prompt button.
- CTA can open an in-app guide or settings instructions if implemented.

### Enabled State

Show:

- Status pill: `On this device`.
- Body: `This device can receive push notifications.`
- Optional action: `Turn off this device`.

### Device Subscribed State

Device status is separate from user category settings.

States:

- Permission granted + subscription exists: `On this device`.
- Permission granted + no subscription: `Permission on, device not subscribed`.
- Permission default + no subscription: `Needs permission`.
- Permission denied: `Blocked`.
- Browser unsupported or missing VAPID key: `Unavailable`.

### Recovery If Permission Denied

- Explain that browser/site settings control recovery.
- Do not show a button that calls `requestPermission()` again.
- Provide short instructions or link to Notification Settings page section.
- Keep in-app notification center usable.

## 11. Notification Settings UX

MVP controls:

### Master Notifications

- Label: `Notifications`
- Description on: `Nudges, reminders, and partner updates can appear here.`
- Description off: `All notification categories are off.`
- Turning off disables category toggles.
- In-app center remains accessible for historical items.

### Nudges

- Label: `Nudges`
- Description: `When your partner sends a nudge.`
- Applies to push and in-app if system supports both; otherwise UI should say `Push nudges`.

### Saving Reminders

- Label: `Saving reminders`
- Description: `Quiet reminders for your active Saving Plan.`
- Disabled state if no active plan: `Set up a plan first.`

### Partner Activity

- Label: `Partner activity`
- Description: `Deposits and project updates from your partner.`

### Push Permission Status

- Show `PermissionStatusPill`.
- Show one-line explanation.
- Primary action:
  - Default: `Enable this device`
  - Granted but unsubscribed: `Enable this device`
  - Denied: no direct permission request; show recovery copy
  - Unsupported: no action

### Device Subscription Status

- Show whether this browser/device is subscribed.
- Optional action: `Turn off this device`.
- If master is off, device can still be subscribed but push categories should not send. UI copy: `Device enabled, notifications off`.

### Quiet Hours

Deferred unless MVP can implement it as one simple control without time picker complexity.

If shown as deferred placeholder:

- Label: `Quiet hours`
- Description: `Coming later`
- Disabled row only.

## 12. Visual States

### Unread

- List item has `NotificationDot`.
- Optional `bg-brand-50/60`.
- Title font weight bold.
- Bell badge count includes item.

### Read

- No visible dot.
- Normal `bg-surface`.
- Title remains readable, not faded below contrast.

### Loading

- Skeleton rows.
- Bell shows no badge until count is loaded.
- Settings toggles disabled while loading.

### Empty

- Title: `No notifications yet`.
- Body: `Updates from your project will show up here.`
- No large illustration.

### Error

- Short message.
- Retry button.
- Danger color only for text/helper, not full-screen red.

### Permission Denied

- Status pill `Blocked`.
- Recovery copy.
- Category toggles still visible but push status explains delivery cannot happen on this device.

### Push Unavailable

- Status pill `Unavailable`.
- Hide push-specific enable actions.
- Keep in-app center visible.

### Muted Category

- Category toggle off.
- Existing notifications stay visible.
- Future push/in-app behavior follows system spec.

### Disabled Master Switch

- Category toggles disabled and muted.
- Permission/device status still readable.
- Snackbar after turning off: `Notifications are off.`

## 13. Motion And Interaction

Use existing motion language: subtle scale, fade, and bottom-sheet/page transitions. No flashy effects.

### Bell Tap

- Reuse `IconButton` active scale.
- Badge does not bounce repeatedly.
- Optional single soft scale on unread count change.

### Center Open/Close

- If route page: use existing `PageTransition`.
- If sheet fallback: use existing `Modal`/`BucketSheet` spring style.

### Item Press

- `active:scale-[0.99]`.
- No swipe actions in MVP.

### Mark As Read

- Dot fades out.
- Background softly returns to `bg-surface`.
- No layout shift; reserve dot space.

### Toast Enter/Exit

- Fade and translate up 8px.
- Auto-dismiss after 2.5 to 3 seconds.
- Pause dismiss while user hovers/focuses is optional.

### Permission Card Reveal

- Use `animate-fade-in-up` or existing page reveal.
- Text must appear immediately with the card, not delayed behind animation.

Requirements:

- Respect global `prefers-reduced-motion`.
- No flashing, pulsing, confetti, or repeated badge animation.
- No layout shift on unread/read changes.
- No delayed important text.

## 14. MVP UX Scope

Implement first:

- Dashboard bell icon with unread count.
- Notification center full-screen subpage.
- Unread/read visual state.
- Profile settings entry for Notifications.
- Notification settings subpage or full-screen view.
- Permission prompt card after meaningful moments.
- Permission/device status UI.
- Nudge notification UI.
- Saving reminder UI.
- Partner deposit notification UI.
- Tap navigation resolver with route fallback.
- Snackbar feedback for notification actions.

MVP event types to fully polish:

- Nudge received.
- Saving reminder.
- Partner deposited.

MVP route targets:

- `/dashboard`
- `/add`
- `/saving-plan`
- `/manage-project`
- `/check-balance`

MVP section query support:

- Can be deferred.
- If not implemented, all section targets fall back to route-level pages.

## 15. Deferred UX

Explicitly defer:

- Quiet hours advanced UI.
- Filters.
- Bulk delete.
- Complex grouping.
- Full Thai copy.
- Custom reminder time picker.
- Notification analytics.
- Swipe actions.
- Rich push action buttons.
- Notification search.
- Notification archive/delete controls.
- Deep links to specific modals.

## 16. Claude Implementation Handoff

### Files Likely To Create

- `src/pages/Notifications.tsx`
- `src/pages/NotificationSettings.tsx`
- `src/components/Notifications/BellIconButton.tsx`
- `src/components/Notifications/NotificationBadge.tsx`
- `src/components/Notifications/NotificationListItem.tsx`
- `src/components/Notifications/NotificationCenter.tsx`
- `src/components/Notifications/NotificationPermissionCard.tsx`
- `src/components/Notifications/NotificationSettingsSection.tsx`
- `src/components/Notifications/NotificationSnackbar.tsx`
- `src/hooks/useNotifications.ts`
- `src/hooks/useNotificationSettings.ts`
- `src/lib/notifications.ts`

Exact data hooks may change based on `docs/plans/23-notification-system.md`.

### Components Likely To Touch

- `src/App.tsx`: add notification routes if using pages.
- `src/pages/Dashboard.tsx`: add bell in header action cluster.
- `src/pages/Profile.tsx`: add Notifications settings row.
- `src/components/NudgeButton/NudgeButton.tsx`: align permission UX and snackbar behavior.
- `src/hooks/usePushSubscription.ts`: expose permission/device state needed by UI if not already available.
- `src/sw.ts`: ensure push click opens payload target, not generic home/dashboard only.
- Preview pages only if shared notification components need demo coverage.

### Screens To Touch First

1. `Dashboard`: bell entry point and unread count only.
2. `Notifications`: center list, empty/loading/error, and item tap behavior.
3. `Profile`: settings row entry point.
4. `NotificationSettings`: permission state and toggles.
5. `SavingPlan` and `AddMoney`: permission cards after meaningful success moments.
6. `NudgeButton`: permission-needed flow and send feedback.

### UI Order To Implement

1. Add route/page shell for Notification Center.
2. Add `BellIconButton` with static count, then wire unread count.
3. Build `NotificationListItem` and empty/loading/error states.
4. Add tap navigation resolver with target fallback.
5. Add Profile `Notifications` row.
6. Build Notification Settings with master/category toggles.
7. Build permission status/card using existing push subscription hook.
8. Align Nudge permission flow to use the new card/snackbar.
9. Add snackbar for notification actions.
10. Polish mobile spacing, reduced motion, and accessibility labels.

### UX Risks To Watch

- Dashboard header crowding when bell and nudge are both visible.
- Browser permission prompts firing before product context is shown.
- Notifications with missing or generic targets.
- Permission denied being mistaken for all notifications being off.
- Push unavailable state hiding the in-app center by accident.
- Copy drifting into guilt or urgency around reminders and streaks.
- Section query targets being added before scroll/focus support exists.

### What Not To Touch

- Do not redesign Dashboard sections.
- Do not add a Notifications bottom tab.
- Do not change Saving Plan calculations.
- Do not change `savings_logs`.
- Do not implement withdrawals, transfers, or approval flows.
- Do not add new UI libraries.
- Do not duplicate backend/RLS/system details in UI components.
- Do not implement advanced quiet hours or reminder time picker in MVP.

### Build/Lint Expectations

After implementation:

- Run `npm run build`.
- Run `npm run lint` when practical.
- Manually verify mobile layout width around 360px.
- Verify Dashboard header does not crowd with bell + nudge.
- Verify notification item tap navigates to a useful route.
- Verify permission denied, unsupported, default, granted/subscribed states.

## 17. UX Acceptance Criteria

- User knows notifications live behind the Dashboard bell.
- User can also find notification settings from Profile.
- User understands whether push permission is on, blocked, unavailable, or not set up.
- User can turn master notifications on/off.
- User can turn Nudges, Saving reminders, and Partner activity on/off.
- Tapping a notification navigates to a useful route.
- No notification opens only the app root or a dead homepage.
- Notification center is readable on mobile.
- Unread and read states are visually clear but calm.
- Toast/snackbar is used only for immediate feedback.
- Permission prompt never appears on first app open.
- Permission prompt appears only after meaningful moments or explicit settings action.
- Copy contains no shame language.
- Dashboard remains uncluttered.
- No new design system or library is introduced.
- Existing warm cream/peach/orange visual style is preserved.
- Push unavailable and permission denied states remain understandable.
- Notification history remains accessible even when push is off.
- MVP works without section query deep-link support by falling back to route-level pages.
