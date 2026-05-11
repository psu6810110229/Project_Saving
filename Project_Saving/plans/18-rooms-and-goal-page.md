# Task 18 — Rooms (Battle Circles) + Goal Page

## Goal
Introduce the **Room** concept: a named battle arena with a deadline, joined by 2–5 friends via an invite code. **Each member has their own personal goal inside the room.** The Goal page is where users create rooms, share invite codes, see rooms they're in, and switch the active room. Existing single-app data migrates into a default "Japan 2027" room so nothing breaks.

This is the largest task in the suite — a real schema change plus refactors of leaderboard, logs, goals, and reactions to scope by room.

## Data Model

### New tables (`supabase/migrations/0002_rooms.sql`)

```sql
create table rooms (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  invite_code  text not null unique,            -- short 6-char e.g. 'A4B7C2'
  end_date     date not null,                   -- shared deadline / trip date
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now()
);

create table room_members (
  room_id    uuid not null references rooms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index idx_room_members_user on room_members(user_id);
```

### Schema changes

```sql
alter table goals          add column room_id uuid references rooms(id) on delete cascade;
alter table savings_logs   add column room_id uuid references rooms(id) on delete cascade;
-- reactions stay tied to logs; logs are scoped, so reactions inherit scope.

-- Existing rows: backfill into a default room so users don't lose data.
-- (Run once during migration — see migration script.)
```

Backfill in the migration:
1. Create one default room called "Japan 2027" with `end_date='2027-11-01'`.
2. Add every existing user as a member of that room.
3. Set every existing `goals.room_id` and `savings_logs.room_id` to that room.
4. Make `room_id` `not null` after the backfill.

### RLS

- `rooms`: SELECT allowed if `auth.uid()` is in `room_members(room_id, user_id)`. INSERT allowed for any authenticated user (creator). UPDATE/DELETE only by `created_by`.
- `room_members`: SELECT if you're a member of the same room. INSERT allowed when joining via valid invite code (function-driven; see below). DELETE allowed for self (leave room).
- `goals` / `savings_logs` / `reactions`: existing policies extended — additionally require `auth.uid()` to be a member of the row's `room_id`.

### `join_room_by_code(code text)` RPC
A SECURITY DEFINER Postgres function that:
1. Looks up `room_id` from invite_code.
2. Inserts into `room_members(room_id, auth.uid())` if not already a member.
3. Returns the joined room id, or null if not found.

Avoids letting clients select the entire `rooms` table to find codes.

## Files Created
- `supabase/migrations/0002_rooms.sql` — schema + backfill + RLS + RPC.
- `src/types/index.ts` — add `Room`, `RoomMember` interfaces.
- `src/hooks/useRooms.ts` — fetches the user's rooms (joined via `room_members`).
- `src/hooks/useActiveRoom.ts` — global-ish hook backed by `localStorage` (key `activeRoomId`) + `RoomContext`. Provides `{ activeRoomId, setActiveRoomId, activeRoom }`.
- `src/components/RoomContext/RoomContext.tsx` — provider that wraps protected pages so all hooks can read the active room id without prop drilling.
- `src/components/RoomCard/RoomCard.tsx` — single room in the list on the Goal page: name, member count, days remaining, "Active" badge if it's the current selection.
- `src/components/RoomSwitcher/RoomSwitcher.tsx` — dropdown rendered in the BattlePage header to switch rooms quickly without leaving the battle view.
- `src/components/CreateRoomModal/CreateRoomModal.tsx` — name + end_date inputs, generates a fresh invite code on submit, becomes active room.
- `src/components/JoinRoomModal/JoinRoomModal.tsx` — invite code input → calls `join_room_by_code` RPC → adds to my rooms, sets active.
- `src/lib/inviteCode.ts` — 6-char alphanumeric generator, biased to unambiguous chars (no `0/O`, `1/I`).

## Files Edited
- `src/pages/GoalPage.tsx` — fully built out (was a stub from Task 15). Lists `useRooms`, "Create" + "Join" CTAs, each room shown via `RoomCard`. Tapping a room sets it active and routes to `/battle`.
- `src/hooks/useLogs.ts` — accept active `roomId`. All queries and the realtime subscription filter on `room_id=eq.{roomId}`. Returns empty array if `roomId` is null.
- `src/hooks/useAllLogs.ts` (from Task 16) — same room scoping.
- `src/hooks/useLeaderboard.ts` (from Task 14) — query members of `roomId` via `room_members` join, then aggregate logs from the same room only. Returns empty until active room exists.
- `src/hooks/useGoal.ts` — read/write `goals` filtered by `(user_id, room_id)`. The composite key effectively becomes (user, room).
- `src/pages/BattlePage.tsx` — top of page renders `<RoomSwitcher>` + room name; if no active room, renders a "No room yet — head to Goal tab to create one" empty state.
- `src/pages/ProfilePage.tsx` — goal editor now writes to the goals row scoped to the *active* room.
- `src/components/AuthProvider/AuthProvider.tsx` (or App.tsx layout wrapper) — mount `<RoomProvider>` around the protected layout so every page can read active room.

## UX flows

### First-time user (no rooms yet, post-backfill)
- Migration ensures every existing user is in the default "Japan 2027" room. So no one starts roomless.
- New users (who sign up after the migration) land in `/battle` with empty state → "Create or join a room" CTA → routes to `/goal`.

### Create a room
- Name (required, max 40 chars).
- End date (date input, defaults to one year from today).
- On submit: generate a unique invite code, insert `rooms`, insert `room_members(creator)`, set `activeRoomId`, navigate to `/battle`.
- Toast / confirmation: "Room created. Share code: A4B7C2" (with copy-to-clipboard button).

### Join a room
- Type 6-char invite code.
- Submit → call `join_room_by_code(code)` RPC.
- On success: set active room, navigate to `/battle`.
- On not-found: inline error.

### Switch rooms
- Use `RoomSwitcher` in the BattlePage header. Saves to localStorage, refetches everything (leaderboard, logs, goal).

### Leave a room
- From `RoomCard` on Goal page, "Leave" button (with confirm). DELETE from `room_members`. If it was the active room, fall back to first remaining room.

## Visual Spec — Goal page

```
┌──────────────────────────────────────┐
│  Your battle rooms                    │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐ │
│  │ 🇯🇵 Japan 2027        [Active] │ │
│  │ 2 members · 540 days left      │ │
│  │ Code: A4B7C2  [📋 Copy]        │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ 🛒 New iPad fund               │ │
│  │ 3 members · 90 days left       │ │
│  │ Code: K9D2L4  [📋 Copy]        │ │
│  └────────────────────────────────┘ │
│                                      │
│  [ + Create room ]  [ Join with code ]│
└──────────────────────────────────────┘
```

## Acceptance Criteria
- [ ] Migration runs cleanly on a populated DB; existing users + goals + logs land in the default "Japan 2027" room.
- [ ] After migration, `room_id` is `not null` on `goals` and `savings_logs`.
- [ ] User can create a new room from the Goal page; invite code displayed and copyable.
- [ ] User can join a room with a valid invite code; joining a fake code shows an error.
- [ ] BattlePage shows the active room name + a switcher dropdown.
- [ ] Leaderboard, logs, log popup, and goal editor are all scoped to the active room.
- [ ] Switching rooms refetches all room-scoped data (no stale leaderboard from previous room).
- [ ] Leaving a room removes you from member list and from related queries.
- [ ] RLS denies access to rooms / logs / goals / reactions you don't have membership for (verify with a second account).
- [ ] `join_room_by_code` RPC works and returns null on bad codes.
- [ ] No `any` types. `npx tsc --noEmit` + `npm run build` clean.

## Edge Cases / Risks
- **Active room deleted by creator**: client must detect (404 on fetch) and clear localStorage; fall back to first available room.
- **User in zero rooms** (after leaving last one): UI must handle empty state gracefully on Battle page.
- **Invite code collision**: regenerate up to N times in `lib/inviteCode.ts` (extremely rare with 32^6 ≈ 1B combos).
- **Backfill fails on partial state**: wrap migration in a transaction.
- **Realtime channel name conflicts**: include room id in the channel name (`logs:{roomId}`) so subscriptions don't bleed across rooms.
- **Two browser tabs different rooms**: each tab reads localStorage on mount; tab-A switching room won't auto-update tab-B. Acceptable; document.
- **Reaction permissions**: reactions inherit from logs which inherit from rooms. Make sure no orphan policies.
- **Self-only goal vs shared deadline confusion**: room.end_date and goals.end_date must stay consistent — when room.end_date is set, mirror to all members' goals.end_date on join. (Or: drop goals.end_date column entirely and read from rooms — simpler. Decide during implementation; default to mirroring to avoid a destructive schema change.)

## Out of Scope
- Sharing invite codes via a deep-linked URL (`/join/A4B7C2`) — could come later.
- Member roles (admin / member). Everyone equal in v1.
- Push notifications when a friend joins / saves.
- Per-room theming or icons (the 🇯🇵 / 🛒 emojis are user-typed in the name field, not a separate field).
- Archived / completed rooms.
