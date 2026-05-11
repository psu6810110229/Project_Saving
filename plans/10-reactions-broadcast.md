# Task 10 — Encouragement Reactions via Broadcast

## Goal
Tap 🔥 ❤️ 👏 on a partner's log to send instant encouragement. Persist counts for history; broadcast a transient "ping" for the live floaty animation.

## Files Created / Edited
- `src/components/ReactionBar/ReactionBar.tsx` — three icon buttons under each log.
- `src/components/ReactionFloater/ReactionFloater.tsx` — global overlay that animates incoming pings.
- `src/hooks/useReactions.ts` — fetch persisted counts per log + insert new.
- `src/hooks/useReactionBroadcast.ts` — subscribes/sends on a Broadcast channel.
- `src/lib/reactions.ts` — emoji map and types.
- Update `src/components/LogItem/LogItem.tsx` to mount the ReactionBar.

## Two-Layer Design
1. **Persistent layer** — DB inserts into `reactions` table (Task 3). Used for showing a small count next to each emoji on each log.
2. **Ephemeral layer** — Supabase Broadcast for instant floaty animation. Doesn't write to DB; pure UX feedback.

## Channel
- Name: `reactions:room` (single shared room since only two users).
- Event: `ping`.
- Payload:
  ```ts
  interface ReactionPing {
    logId: string;
    fromUserId: string;
    emoji: 'fire' | 'heart' | 'clap';
    sentAt: number; // Date.now()
  }
  ```

## Flow on Tap
1. Optimistically bump local count.
2. `INSERT` into `reactions` (idempotent because PK = `(log_id, user_id, emoji)`; tap again = no-op).
3. `channel.send({ type: 'broadcast', event: 'ping', payload })`.
4. On the OTHER user's client, the broadcast handler triggers a floating emoji animation near that log.

## ReactionFloater
- Listens on the broadcast channel.
- Maintains a small queue of active animations (max ~6 to avoid spam).
- Each ping renders an absolutely-positioned emoji rising and fading over ~1.2s.
- Only animates pings that aren't from the current user (no self-confetti).

## Persisted Counts
- `useReactions(logId)` returns `{ counts: { fire, heart, clap }, myReactions: Set, toggle(emoji) }`.
- Tap toggles: insert if missing, delete if already mine.
- Counts come from `select emoji, count(*) from reactions where log_id = ? group by emoji`.

## Edge Cases / Risks
- Broadcast doesn't deliver if the other user is offline → that's fine, persisted count still updates when they next load.
- Spam-tapping: throttle to 1 broadcast per emoji per 500ms per log.
- Duplicate inserts → handled by composite PK; catch unique-violation as benign.
- Self-react: allow it (DB allows), but don't animate floater on own client.
- RLS: `reactions` insert/delete only where `auth.uid() = user_id` (set in Task 3); broadcast itself is unauthenticated within the channel — keep payload minimal (no secrets).

## Acceptance Criteria
- [ ] Tapping 🔥 on partner's log shows a floating 🔥 on partner's screen within ~500ms.
- [ ] Count next to each emoji reflects the database accurately on reload.
- [ ] Re-tapping the same emoji removes it (toggle).
- [ ] No duplicate-key errors in console.
- [ ] Animation smooth on mid-range Android (no jank when several land at once).
