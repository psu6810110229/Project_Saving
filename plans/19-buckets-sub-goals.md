# Task 19 — Buckets (Sub-Goals)

## Goal
Each user can divide their per-room goal into up to **10 named buckets** (e.g. Transportation ฿20k, Accommodation ฿8k, Pocket ฿10k for a ฿50k Japan trip). Every savings log must target exactly one bucket. The sum of all bucket targets must equal the goal target — strict.

Depends on: **Task 18** (rooms), since buckets are scoped per (user, room).

## Data Model

### New table — `supabase/migrations/0003_buckets.sql`

```sql
create table buckets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  room_id       uuid not null references rooms(id)      on delete cascade,
  name          text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  unique(user_id, room_id, name)
);

create index idx_buckets_user_room on buckets(user_id, room_id);

-- Cap at 10 buckets per (user, room) via trigger
create or replace function enforce_bucket_limit() returns trigger as $$
begin
  if (select count(*) from buckets where user_id = NEW.user_id and room_id = NEW.room_id) >= 10 then
    raise exception 'Bucket limit reached (10 per room)';
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_bucket_limit
  before insert on buckets
  for each row execute function enforce_bucket_limit();
```

### Schema change to `savings_logs`

```sql
alter table savings_logs add column bucket_id uuid references buckets(id) on delete restrict;
-- after backfill (below), make NOT NULL:
alter table savings_logs alter column bucket_id set not null;
```

### Backfill (inside migration, transactional)

For each `(user_id, room_id)` pair that has any goal or savings_logs:
1. Insert a default bucket: `name='General'`, `target_amount = goals.target_amount`, `position=0`.
2. Update existing `savings_logs` in that (user, room) to `bucket_id = <the General bucket id>`.
3. After all rows are backfilled, set `bucket_id NOT NULL`.

### RLS

- `buckets`: SELECT/INSERT/UPDATE/DELETE allowed only when `user_id = auth.uid()` AND user is a member of `room_id`.
- `savings_logs`: existing policies extend — additionally check that `bucket_id`'s `user_id == auth.uid()`. (Prevents logging into someone else's bucket.)

## Files Created
- `supabase/migrations/0003_buckets.sql` — schema, backfill, RLS, trigger.
- `src/types/index.ts` — add `Bucket` interface.
- `src/lib/buckets.ts` — pure helpers:
  - `sumTargets(buckets): number`
  - `validateBuckets(buckets, goalTarget): { ok: boolean; diff: number; reason?: string }`
  - `bucketSaved(bucket, logs): number` — sum of logs with that bucket_id.
  - `bucketPercent(bucket, logs): number`
- `src/hooks/useBuckets.ts` — fetch + mutate buckets for the active room.
- `src/components/BucketEditor/BucketEditor.tsx` — Profile page card for managing buckets (list + add + sum indicator + save).
- `src/components/BucketRow/BucketRow.tsx` — one bucket inside editor: name input, target input, delete button, inline saved-progress.
- `src/components/BucketSelector/BucketSelector.tsx` — dropdown for the log composer. Persists last-used bucket id to localStorage per room.

## Files Edited
- `src/components/QuickLogBar/QuickLogBar.tsx` — add bucket selector above the +100/+500/+1000 buttons. Pass `bucketId` along with amount on insert.
- `src/components/ManualLogForm/ManualLogForm.tsx` — same, bucket selector before the amount input.
- `src/hooks/useLogs.ts` — `insert(amount, bucketId, note?)`. Reject if `bucketId` is missing.
- `src/pages/ProfilePage.tsx` — render `<BucketEditor>` below goal config.
- `src/components/LogItem/LogItem.tsx` — show bucket name as a small chip next to the amount (e.g. `฿500 · Transportation`).
- `src/types/index.ts` — `SavingsLog` interface gains `bucket_id: string` and optional `bucket_name?: string` (for joined queries).

## Visual Spec — BucketEditor (Profile page)

```
┌──────────────────────────────────────┐
│  YOUR BUCKETS (3 of 10)              │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐ │
│  │ Transportation     ฿20,000  ✕  │ │
│  │ ████████░░ 42% · ฿8,500 saved  │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │ Accommodation      ฿8,000   ✕  │ │
│  │ █████░░░░░ 52% · ฿4,200 saved  │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │ Pocket money       ฿10,000  ✕  │ │
│  │ ██░░░░░░░░ 20% · ฿2,000 saved  │ │
│  └────────────────────────────────┘ │
│                                      │
│  ✓ ฿38,000 / ฿50,000 allocated      │
│    ฿12,000 unallocated               │
│                                      │
│  [ + Add bucket ]   [ Save changes ] │
└──────────────────────────────────────┘
```

States for the sum indicator:
- **Match** (sum == goal): `✓ ฿X / ฿X allocated` in `text-emerald-600`. Save button enabled.
- **Under** (sum < goal): `⚠ ฿X / ฿Y — ฿Z unallocated` in `text-amber-600`. Save button enabled (allowed; warns user).
- **Over** (sum > goal): `✕ ฿X / ฿Y — over by ฿Z` in `text-red-500`. Save button disabled.

Reasoning: "strict" means logs can't drift out of the goal envelope. Allowing temporary "under" is friendlier UX (users may add buckets gradually) but never over.

Each `BucketRow`:
- Name input (`text-base`, max 30 chars).
- Target input (`type=number`, ฿ prefix).
- Delete `✕` (disabled if it's the only bucket — we always need one for logs).
- Below the inputs: progress bar showing `bucketSaved(bucket) / bucket.target * 100%` and saved amount.

Adding: "+ Add bucket" appends a fresh row (name=empty, target=0). User must fill before saving.

## Visual Spec — BucketSelector (in log composer)

A pill-shaped dropdown above the quick-log buttons:

```
Bucket: [ Transportation ▼ ]
        +100   +500   +1000
```

- `<select>` styled with Tailwind: `bg-surface border border-border rounded-full px-3 py-1.5 text-sm`.
- Default value: last-used bucket id from localStorage (`lastBucket:{roomId}`); falls back to first bucket in `position` order.
- If user has 0 buckets in this room (shouldn't happen post-migration, but defensive): show inline message "Create a bucket on Profile first" and disable composer.

## Visual Spec — LogItem (chip)

```
F  ฿500  Transportation   2 min ago  🔥
```

Bucket chip: `text-xs bg-surface border border-border rounded-full px-2 py-0.5 text-ink-muted ml-2`. Truncates with `max-w-[8rem] truncate` if name is long.

## useBuckets hook

```ts
export interface UseBucketsResult {
  buckets: Bucket[];
  loading: boolean;
  saveBuckets: (next: BucketDraft[]) => Promise<{ error?: string }>;
}

export function useBuckets(roomId: string | null): UseBucketsResult;
```

`saveBuckets` semantics:
- Diff old vs new: compute inserts, updates, deletes.
- Run as a single batch (no transaction in JS-side Supabase, so optimistic with rollback on error).
- Reject if delete would orphan logs (i.e., logs reference the bucket being deleted) — show error "This bucket has X logs; reassign or delete those first." (v1: just block.)
- Refetches on success.

## Goal/target sync rules

When user edits **goal target** (Profile page):
- After save, immediately recompute bucket sum.
- If sum no longer matches: keep the new target, but the bucket editor's sum indicator goes red and forces rebalance before next save.
- We do NOT auto-rescale buckets — too magical, could surprise the user. Force them to adjust manually.

When user adds first bucket:
- The auto-created "General" bucket from migration may or may not exist. If exactly one "General" bucket exists with target == goal target, treat its target as a movable budget that user can split into multiple buckets.

## Acceptance Criteria
- [ ] Migration runs cleanly; every existing (user, room) ends with at least one "General" bucket; every existing log has `bucket_id`.
- [ ] After migration, `savings_logs.bucket_id` is `NOT NULL`.
- [ ] Profile page renders `<BucketEditor>` for the active room with current buckets + sum indicator.
- [ ] Adding a bucket beyond 10 fails (DB trigger rejects; UI shows the error).
- [ ] Save button is disabled when sum exceeds goal target.
- [ ] Saving valid changes persists buckets; UI reflects updates.
- [ ] Deleting a bucket with logs is blocked with a clear message.
- [ ] Log composers (Quick + Manual) show `<BucketSelector>` and pass `bucket_id` on insert.
- [ ] localStorage remembers last-used bucket per room.
- [ ] LogItem displays the bucket name as a small chip.
- [ ] Leaderboard percent is unchanged (still uses goal target / log sum) — buckets don't change overall ranking math.
- [ ] RLS prevents logging into another user's bucket.
- [ ] `npx tsc --noEmit` + `npm run build` clean.

## Edge Cases / Risks
- **Renaming a bucket vs creating new one**: BucketRow tracks original `id`; renaming is an UPDATE, not delete+insert. Save logic must keep ids stable.
- **Deleting a bucket with logs**: blocking is the safest first cut. Future enhancement: "reassign N logs to: [other bucket ▼]" before delete.
- **Goal target changes downstream of buckets**: handled by red sum indicator + forced rebalance. Test scenario: edit goal from 50k → 40k while buckets sum to 38k → indicator goes amber (12k → 2k unallocated). Edit goal 40k → 30k → indicator turns red (over by 8k) → save blocked until buckets reduced.
- **Concurrency**: two tabs editing buckets simultaneously could clobber each other. Acceptable for v1; last write wins.
- **Bucket selector + room switch**: selector resets to first bucket of new room; localStorage lookup keys on `roomId`.
- **Tiny perf**: log queries now do a join to fetch `bucket_name`. Use Supabase nested select `buckets(name)` like profiles join. Cap shouldn't matter at our scale.
- **Migration timing**: must run AFTER Task 18's room migration (room_id required on logs/goals). Numeric ordering (`0003_*`) handles that.

## Out of Scope
- Reordering buckets (drag handle). v1 uses creation order; can add later.
- Bucket templates ("Trip preset", "Wedding preset").
- Per-bucket streaks or comparisons.
- Reassigning logs between buckets after creation.
- Bucket-level goals (e.g., "complete Transportation by August"). Date constraints stay at the room/goal level.
- Splitting a single log across multiple buckets.
