# GO-OUT — App Overview

## What Is GO-OUT?

GO-OUT is a **mobile-first shared savings tracker** designed for small groups of up to 7 people who are saving toward a shared goal — a trip, a home, a wedding, or any project that requires pooled effort over time.

The app does **not** connect to banks or hold real money. Users manually record money they have stored elsewhere — cash in an envelope, a personal bank account, a savings jar — and the app tracks progress, visualises habits, and keeps everyone in the group accountable.

---

## Core Concept

A group creates a **Project Room** and sets a shared goal (a target amount and an end date). Each member then manages their own personal savings inside that room through **Buckets** — labelled categories like Flight, Stay, Food, or Shopping. Everyone can see each other's progress at a high level, which creates social motivation without exposing private financial details.

The key insight: saving for something together is more motivating than saving alone. GO-OUT provides the scoreboard, the habit tools, and the transparency layer — without replacing your bank.

---

## Who Uses It

- **Friend groups** saving for an overseas trip
- **Couples** saving for a home or wedding
- **Families** building a shared travel fund
- **Any group** with a shared financial goal and a deadline

Room capacity: up to **7 members** per room.

---

## Main Features

### Project Rooms
- Create or join a room with an invite code
- Set a shared target amount and end date (the Room Goal)
- Each member sets their own personal sub-goal within the room
- Rename, archive, or leave rooms
- Switch between multiple rooms

### Buckets
Personal savings categories within a room. Each member owns their own buckets.

- Up to **10 buckets** per user per room
- Categories: Flight, Stay, Transport, Food, Activities, Shopping, Buffer, Home, Other
- Smart category suggestions based on bucket name
- Drag to reorder
- Bucket-to-bucket transfers (same user, append-only ledger)
- Archive zero-balance buckets (last active bucket protected)
- Intent badges: Focus / Next / Done — computed from progress toward each bucket's target

### Deposits (Add Money)
Fast, positive-only deposit flow:
- Assign each deposit to a bucket
- Quick-amount presets (user-editable, 1–6 buttons)
- Optional receipt/slip photo upload
- No negative entries — all corrections go through the Reconcile flow

### Dashboard
The main hub screen:

| Card | What It Shows |
|------|--------------|
| **Vault Card** | Room total vs. room goal, projected completion date |
| **Saving Plan Card** | Money status (are you on track?) + habit status (are you saving regularly?) |
| **Balance Check** | Days since you last verified your real-money balance |
| **Leaderboard** | All members ranked by savings, with streak badges |
| **Bucket Grid** | Your buckets + view-only partner buckets |
| **Momentum Chart** | Room/Me/Compare chart by time period, filterable by category |
| **Activity Feed** | Recent deposits across the room |

### Saving Plan
A personal saving schedule attached to your room membership.

Rule types:
- **Fixed Daily** — save the same amount every day
- **Fixed Weekly** — save once a week
- **Fixed Monthly** — save once a month
- **Increasing Daily** — save a little more each day
- **Increasing Daily (Capped)** — increasing with a maximum daily amount

Features:
- Pause and resume without breaking deposit history
- Plan changes create new revisions — history is never rewritten
- Bangkok date logic for all calculations
- Streak tracking: consecutive days you met your saving target
- **Streak Freezes**: a monthly grace-day budget (default 2) for missed days

### Check Balance (Reconcile)
Bridges the gap between what the app records and what you actually have.

Flow:
1. App shows your current recorded balance
2. You enter your real balance (cash + bank + wherever you store it)
3. If they match → checkpoint saved
4. If they differ → you pick a reason, app saves a checkpoint + signed adjustment

Other members see only a sanitised activity summary — no private notes or storage details.

### Notifications
- **In-app notification centre** with unread count badge
- **Push notifications** via Firebase Cloud Messaging (FCM)
- Categories: nudges, saving reminders, partner activity, product announcements
- Per-user preference toggles per category
- Fan-out: deposits and room events notify all eligible room members

### Nudges
One-tap encouragement — send a nudge to all other room members from the dashboard. Throttled to prevent spam.

### Milestones
One-shot celebration modals when the room hits 25%, 50%, 75%, or 90% of the shared goal.

### Team / Leaderboard
Full leaderboard screen with:
- Progress rings per member
- Streak badges
- Head-to-head comparison
- Individual member detail view (their buckets, saving plan, activity)

### Manage Project
Room-level settings screen:
- Update room goal and end date (creator only)
- Update personal sub-goal
- Manage own buckets (create, edit, archive, reorder, transfer)
- Edit quick-amount presets
- Rename the room
- Archive or leave the project

### Profile
- Display name and avatar (upload or crop)
- Theme picker: Terracotta / Slate / Teal
- Language: English / Thai
- Create or join a project from here
- App version badge

### Android Home-Screen Widget
A live savings widget for the Android home screen:
- Small and medium sizes
- Shows current room progress
- Rendered by capturing the real React UI in a hidden WebView → PNG → widget cell
- Updates automatically when the app syncs

---

## Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Routing | React Router 7 |
| Styling | Tailwind CSS (custom token system) |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) |
| Edge Functions | Supabase Edge Functions (Deno) |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Mobile | Capacitor 8 (iOS + Android wrapper) |
| PWA | vite-plugin-pwa + Workbox (service worker, offline support) |
| Deployment | Vercel |
| Animations | Framer Motion |
| Drag & Drop | dnd-kit |
| Icons | Phosphor Icons |
| Font | IBM Plex Sans + IBM Plex Sans Thai + IBM Plex Mono |

### Project Structure

```
src/
  pages/          — 26 route screens
  components/     — 123 reusable UI components
  hooks/          — 52 custom data and UI hooks
  lib/            — Supabase client + pure helpers
  types/          — shared TypeScript types
  i18n/           — English / Thai translations
supabase/
  migrations/     — 87 numbered schema migrations
  functions/      — 3 edge functions
docs/
  plans/          — 60+ implementation plan documents
  reference/      — design references and mockups
public/           — PWA icons, hero cover images, manifest
android/          — Capacitor Android project
```

### Database (Supabase / Postgres)

Core tables:
- `profiles` — user profile, avatar, theme, language, quick-add presets
- `rooms` — project rooms with target amount, end date, invite code, cover image
- `room_members` — join table: who is in which room
- `goals` — personal sub-goals per member per room
- `buckets` — personal saving categories with target, current balance, category, deadline
- `savings_logs` — append-only deposit ledger (positive only, never deleted)
- `bucket_transfers` — same-user bucket-to-bucket transfers (append-only)
- `saving_plans` + `saving_plan_revisions` + `saving_plan_pauses` — plan history
- `reconcile_checkpoints` — balance verification history
- `balance_allocations` / `balance_deallocations` — reconcile difference allocation
- `notifications` — fan-out notification rows per user
- `push_subscriptions` / `native_push_subscriptions` — FCM tokens
- `streak_freezes` — grace-day usage audit
- `expense_templates` — smart bucket suggestions

Row-Level Security (RLS) is enforced on all tables. Sensitive writes go through security-definer RPCs that validate membership, ownership, and idempotency.

### Edge Functions

| Function | Purpose |
|----------|---------|
| `notify-partner-deposit` | Push notification fan-out when a deposit is recorded |
| `scheduled-saving-reminders` | Daily cron: sends reminders to users who haven't saved today |
| `send-nudge` | Throttled nudge delivery to all other room members |

### Money-State Model

Three distinct numbers — never mixed:

| Term | Meaning |
|------|---------|
| **Recorded Deposits** | Sum of positive entries in `savings_logs` |
| **Verified Balance** | Reconcile total (checkpoints + signed adjustments) |
| **Planned Balance** | What the Saving Plan calculates you should have |

`savings_logs` is positive-only and append-only. Corrections are made via reconcile checkpoints and signed adjustments, not by editing old records.

### Design System

Warm cream / terracotta theme built on custom Tailwind tokens:

| Token | Value |
|-------|-------|
| `bg` | `#FBF6F0` — warm cream background |
| `surface` | Card surface |
| `brand-500` | `#F26B1A` — terracotta orange (primary) |
| `ink` | `#2A1A0E` — cocoa dark text |
| `haloOrange` | Brand glow shadow |
| `neuRaised` / `neuPressed` | Neumorphic soft shadow system |

Radius scale: `lg` (14px) → `xl` (20px) → `2xl` (24px) → `3xl` (32px) → `pill`.

---

## Data Integrity Rules

- Deposits are always positive — no negative `savings_logs`
- Financial history is never hard-deleted; use void, archive, or corrective records
- Bucket targets must not exceed the member's personal goal
- Room capacity (7 members) enforced by a DB trigger with row-level locking
- Saving plan revisions are append-only — past history is never rewritten
- Reconcile checkpoints preserve the full audit trail
- All sensitive RPCs validate `auth.uid()`, room membership, and ownership

---

## Localization

- **English** and **Thai** (ภาษาไทย)
- Per-user language preference stored on the profile
- Thai font support via IBM Plex Sans Thai
- Bangkok date logic for all plan and streak calculations

---

## Versioning

Current app version: **1.0.7**

Version is displayed as a badge in the Profile screen and app-update modal. The service worker handles background updates and shows an opt-in "Update Available" modal.

---

## What GO-OUT Is Not

- Not a bank or financial institution
- Does not connect to bank accounts or payment systems
- Does not hold, move, or store real money
- Not a budgeting app for daily expenses
- Not a group payment splitter (like Splitwise)

It is purely a **shared savings scoreboard** that motivates groups to reach a goal together through transparency, habit tracking, and social accountability.
