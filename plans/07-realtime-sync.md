# Task 7 — Realtime Sync of Shared Dashboard

## Goal
Replace polling/refetch in Task 6 with Supabase Realtime so any insert by either user appears instantly on both screens, and the battle dashboard totals stay live.

## Files Created / Edited
- `src/hooks/useRealtimeLogs.ts` — subscribes to `savings_logs` changes, exposes the live list.
- Refactor `src/hooks/useLogs.ts` to internally use `useRealtimeLogs` (or merge them — pick one).
- `src/hooks/useSavingsTotal.ts` — recompute from realtime list rather than separate query.
- `src/lib/supabase.ts` — no change, but document channel-naming convention here in a comment.

## Subscription Strategy
Channel: `public:savings_logs`.
Events: `INSERT`, `UPDATE`, `DELETE` on `savings_logs`.
- On INSERT → prepend to list (dedup by `id` against optimistic temp rows).
- On UPDATE → replace by id.
- On DELETE → filter by id.

Pseudocode:
```ts
const channel = supabase.channel('public:savings_logs')
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'savings_logs' },
      payload => dispatch(payload))
  .subscribe();

return () => { supabase.removeChannel(channel); };
```

## Dedup Logic (important)
Optimistic insert in Task 6 created a temp row with a client-generated UUID. Realtime echo arrives with the SAME UUID (because we send it, or with a different one if DB generates). Decision:
- **Generate the UUID client-side** (`crypto.randomUUID()`) and send it in the insert. Realtime echoes the same id → match by id and replace flag from "pending" to "confirmed".
- If echo arrives before the insert promise resolves: still safe, ids match.

## Totals
`useSavingsTotal(userId)` becomes a derived selector over the realtime list. No separate aggregate query — keeps a single source of truth.

## Edge Cases / Risks
- Subscription leak on hot reload → strict cleanup in `useEffect` return.
- User logs in/out → channel must be torn down and recreated under the new auth context (or rely on `auth` channel param if needed).
- Dropped websocket → Supabase reconnects; we may miss events between disconnect and resubscribe. Mitigation: on `SUBSCRIBED` event after reconnect, re-fetch the last 30 logs and merge.
- RLS interaction: realtime respects RLS — both users can SELECT, so they receive each other's events as designed.
- Performance: keeping unbounded list in memory. Cap to last 100 in client; older accessible via "load more" later.

## Acceptance Criteria
- [ ] Insert on device A appears on device B within 1 second without manual refresh.
- [ ] Optimistic temp rows are not duplicated when the realtime echo arrives.
- [ ] Sign-out cleanly tears down the channel (no console warnings).
- [ ] Dashboard totals update live from the realtime list.
- [ ] Disconnect/reconnect doesn't leave stale data (re-fetch on resubscribe).
