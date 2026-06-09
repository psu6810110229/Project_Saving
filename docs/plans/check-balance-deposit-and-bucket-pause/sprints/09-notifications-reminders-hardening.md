# Sprint 9: Notifications And Reminders Hardening

## Branch

`fix/pause-reminder-notification-hardening`

## Goal

Ensure pause state is respected by reminders and any partner-visible activity.

## Global Rules

- Run `npm run build`
- Do not run MCP Browser or in-app browser
- Keep notification changes minimal
- Do not expose private notes or storage details

## Required Context

- `supabase/functions/scheduled-saving-reminders/index.ts`
- reminder-related migrations/RPCs
- `src/lib/notifyEvents.ts`
- `src/i18n/notificationCopy.ts`
- `src/hooks/useNotificationPreferences.ts`
- Sprint 1 pause table/RPCs
- Sprint 0 partner visibility decision

## Tasks

### Reminder Audit

- Identify all reminder sources:
  - legacy saving plan reminders
  - bucket-rule reminders, if any
  - push fan-out path
- Ensure paused bucket does not receive saving reminder.
- Ensure resumed bucket becomes eligible again.
- Ensure pause does not disable unrelated notification categories.

### Partner Activity

If Sprint 0 locks partner pause visibility:

- Add partner-visible pause/resume notification events.
- Keep payload sanitized:
  - bucket id
  - bucket name
  - paused/resumed status
  - no private note
- Respect notification preferences.

If partner pause visibility is not locked:

- Do not add partner notification.
- Keep pause state owner-only.

### Copy

- Add Thai and English notification copy only for approved events.

## Files Likely Touched

- `supabase/functions/scheduled-saving-reminders/index.ts`
- Supabase migration for reminder RPC update if needed
- `src/lib/notifyEvents.ts`
- `src/i18n/notificationCopy.ts`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`

## Verification

- `npm run build`
- No MCP Browser

## Manual Test Checklist

- Paused bucket receives no reminder.
- Resumed bucket receives reminder when due.
- Partner notification behavior matches product decision.
- Notification preferences are respected.

## Risks

- Edge function behavior is harder to verify locally. Keep code path small and log-safe.
- Partner visibility can leak sensitive plan status if not scoped carefully.
