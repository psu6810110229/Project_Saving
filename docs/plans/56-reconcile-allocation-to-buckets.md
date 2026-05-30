# 56 — Reconcile Difference → Bucket Allocation

Status: **DRAFT — awaiting approval**
Owner: front-end/full-stack
Next migration: `0078`

## 1. Problem

When a user runs Check Balance and the actual money is **more** than the app
(e.g. actual `14,239`, app `13,000`), the system records a `+1,239`
`balance_adjustment`. The Verified Balance becomes `14,239`, but that `1,239`
is **floating in the adjustment layer — it is not in any bucket**.

```
Verified Balance (appBalance) = Σ savings_logs + Σ balance_adjustments   (current_reconciled_balance, 0028)
bucketTotal                   = Σ savings_logs                            (sum of bucket deposits)
Unallocated difference        = appBalance − bucketTotal = Σ balance_adjustments (net)
```

Today the only feedback is a reminder string in `BalanceCheckStatus.tsx:37`
("อย่าลืมไปหยอดเงินใน bucket ด้วยนะ"). There is **no tool to actually place
that money into buckets**, and with 3 unequal buckets the user does not know
how much to put where.

## 2. Decisions (confirmed with user)

1. **Allocated money does NOT count as a Recorded Deposit.** It must not affect
   Saving Plan progress, streaks, momentum, or appear as a deposit in the
   activity feed. → achieved by **never touching `savings_logs`**.
2. **Over-target allocation is allowed but warned.** A bucket near its target
   shows "เหลือรับได้ X ก่อนถึงเป้า"; allocating past target is permitted
   (consistent with `/add`, which does not block over-target deposits).
3. **UX model = Check Balance card behaves like a holding bucket.** The
   unallocated difference lives on the balance card; the user drags / pours it
   into buckets. **Money can never move from a bucket back to the holding pool**
   (preserves the no-withdrawal rule).
4. **Card surfaces two numbers** — the checked actual balance and the
   still-unallocated difference. **Allocation is a drag-and-drop gesture**
   (drag the unallocated chip onto a bucket), **not a button**. Running the
   Check Balance flow stays a **CTA** (the existing round arrow button).
5. **(Option A — confirmed) Hero/vault = bucket total** (deposits + signed
   allocations), NOT Recorded Deposits. This makes hero = bucket cards =
   Verified Balance (right after a check) so the user never sees three
   conflicting totals. Recorded Deposits stays *inside* the Saving Plan card
   (deposit discipline / streak) and is no longer a competing headline number.
6. **(Shortfall — confirmed) Verified < buckets → "sync down" write-down.**
   When the real balance is *less* than the buckets claim (e.g. spent /
   miscounted), the user trims a bucket to match reality via a **signed
   (negative) allocation**. Framed as "ปรับเป้าให้ตรงกับเงินจริง", never as
   loss/blame. `savings_logs` and streak are untouched (past saving stays
   real). This is the approved **bucket-correction** path (CLAUDE.md gate).

### Shortfall UX (locked)
- **No extra step.** In the Check Balance flow, when actual < app, the final
  "done" panel *becomes* the sync panel — same step count as today.
  Minimal copy (3 lines), a **pre-selected smart bucket** (one-tap confirm),
  and a reassurance line "การออม & streak ยังอยู่ครบ ✓". Done → "เป้าตรงกับเงินจริงแล้ว ✓".
- **Skip ("ไว้ก่อน") → calm card nudge** (neutral tone, not danger):
  "ยอดจริงน้อยกว่าเป้า ฿X · แตะเพื่อปรับให้ตรง" → reopens the sync panel.
- **Smart default bucket:** `buffer` category first, else the bucket with the
  farthest deadline (least urgent). User can change via a dropdown.
- **Auto-spill, silent:** if the shortfall exceeds one bucket's balance, the
  client trims across buckets automatically (one tap), showing only a small
  "ปรับจาก N เป้า" note. Never below a bucket's balance (no negative bucket).
- **Asymmetry is intentional:** gain = playful drag-in on the dashboard;
  shortfall = calm guided sync in the flow (no "drag money to trash" gesture,
  which would read as throwing money away).

## 3. Money-state model — why a dedicated `balance_allocations` table

Introduce an append-only ledger `balance_allocations` (mirror of
`bucket_transfers`). It does **not** touch `savings_logs` and does **not** add
new adjustments. Definitions become:

```
Recorded Deposits (plan/streak/momentum) = Σ savings_logs                 ← UNCHANGED
Verified Balance (current_reconciled_balance) = Σ savings_logs + Σ adjustments  ← UNCHANGED
Bucket displayed balance = Σ savings_logs(b) + transfers_in − transfers_out + Σ allocations(b)
bucketTotal = Σ savings_logs + Σ allocations           (transfers net to zero across buckets)
Unallocated pool = Verified Balance − bucketTotal = Σ adjustments − Σ allocations
```

Allocating `X` into bucket A = insert one `balance_allocations(+X → A)` row.

| Quantity | Before | After +X | Correct? |
|---|---|---|---|
| Verified Balance | 14,239 | 14,239 | ✅ no double count |
| bucketTotal | 13,000 | 13,000 + X | ✅ money enters bucket |
| Unallocated pool | 1,239 | 1,239 − X | ✅ pool shrinks |
| Recorded Deposits (plan) | 13,000 | 13,000 | ✅ untouched |

This is the **"safe double-count prevention"** the CLAUDE.md guardrail requires
before reconcile→bucket allocation is allowed. Because allocations live in their
own table, every existing Recorded-Deposit reader is automatically unaffected —
no need to add a discriminator column to `savings_logs` or edit plan/streak/
momentum/leaderboard queries.

**Invariant enforced by the RPC:** total allocations may never exceed the
positive unallocated pool, i.e. after each allocation `bucketTotal ≤ Verified
Balance` must still hold. Allocation is only offered when the pool is positive.

## 4. Schema — migration `0078_balance_allocations.sql`

```sql
create table public.balance_allocations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  destination_bucket_id uuid not null references public.buckets(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint balance_allocations_client_request_unique
    unique (user_id, room_id, client_request_id)
);
-- indexes: (user_id, room_id, created_at desc), (destination_bucket_id), (room_id, created_at desc)
-- RLS: enable; select own + room-member scoped (mirror bucket_transfers_select_own).
--      NO client insert/update/delete — RPC is the only write path.
```

Extend the canonical balance helper so buckets reflect allocations everywhere
(dashboard, saving plan bucket reads, archive zero-balance check):

```sql
-- bucket_balance(p_bucket_id): add
--   + coalesce((select sum(a.amount) from public.balance_allocations a
--               where a.destination_bucket_id = p_bucket_id), 0)
```

(Re-create `bucket_balance` in 0078; keep transfers terms intact.)

## 5. RPC — `allocate_balance_to_bucket(p_room_id, p_bucket_id, p_amount, p_client_request_id)`

Mirror `transfer_bucket_money` structure exactly:

- `security definer`, `set search_path = public`, grant execute to `authenticated`.
- Validate: auth.uid(); room membership (`is_room_member`); bucket exists, owned
  by caller, `archived_at is null`, same room; `client_request_id` required;
  amount > 0, rounded to 2 dp.
- **Idempotency short-circuit** on `(user_id, client_request_id)` — return the
  existing row (defence-in-depth via unique constraint). Mismatched payload for
  the same id raises `allocation_invalid_request`.
- **Pool check under lock:** lock the bucket row; compute
  `available = current_reconciled_balance(room) − Σ all bucket balances`.
  If `available < amount` → raise `allocation_exceeds_pool`
  (detail: `available=…, requested=…`). This is the hard guard; the UI also
  pre-validates but the server is authoritative.
- Insert `balance_allocations` row + an `activity_events` row with a **distinct
  event_key `balance_allocated`** (NOT a deposit key), payload:
  `{ allocation_id, destination_bucket_id, destination_bucket_name, amount }`.
- Return `{ allocation_id, destination_bucket_id, amount, bucket_balance_after, pool_after, activity_id, reused }`.

Stable HINT tokens on every raise (e.g. `allocation_exceeds_pool`,
`allocation_partner_bucket`, `allocation_bucket_archived`), surfaced to copy in
the frontend slice — same convention as 0059.

## 6. Activity & notifications

- New event_key `balance_allocated` rendered in `BalanceActivityFeed` /
  `useBucketActivityEvents` as "จัดสรรเงินเข้า <bucket> ฿X" (own-only or
  sanitized for partners — confirm visibility policy; keep amounts owner-only if
  reconcile amounts are private, matching existing balance privacy).
- Notifications: **none in v1** (allocation is a personal housekeeping action,
  not partner-relevant). Revisit later if needed.

## 7. Frontend

### 7.1 Data layer
- New hook `useBalanceAllocations(roomId)` **or** extend `useReconcile` with
  `allocate({ bucketId, amount, clientRequestId })` + an `unallocatedPool`
  derived value. Prefer extending `useReconcile` since it already owns
  `appBalance`; add `bucketTotal` input (already available on Dashboard as
  `total`) to derive `unallocatedPool = max(0, appBalance − bucketTotal)`.
- On success, refetch reconcile + buckets so balances update.

### 7.2 Allocation interaction — drag-and-drop primary (confirmed)
Allocation is a **drag-and-drop gesture**, not a button (decision 4):

- The unallocated chip on the Balance card is a **drag source**. Dragging it
  onto a bucket card opens a small amount confirm (default = min(pool,
  remaining-to-target); user can edit up to the full pool). Over-target is
  allowed with a soft warning (decision 2); when capped, show
  "ส่วนที่เหลือ ฿X จะค้างไว้ใน Balance".
- Each drop submits one idempotent `allocate_balance_to_bucket` call (one
  `client_request_id` per drop) → repeatable until the pool reaches 0, which
  naturally covers both "pour all into one" and "distribute across many".
- Reuse the dnd-kit patterns already in `SortableBucketCard` / bucket grid.
- **Accessibility fallback:** a non-DnD path (tap chip → pick bucket → amount)
  for keyboard / reduced-motion / touch users; same underlying RPC.

### 7.3 Balance card (`BalanceCheckStatus.tsx`)
Redesign to surface **two clear numbers** (decision 4):

- **Checked actual balance** (the last `actual_amount`) and **unallocated
  difference** (`unallocatedPool`) as two distinct, labelled figures — replacing
  today's single big `appBalance` + one-line reminder.
- When `unallocatedPool > 0`, the unallocated figure becomes the **draggable
  chip**; otherwise it reads as settled/allocated.
- Keep the round arrow as the **Check Balance CTA** (unchanged behaviour).
- Tighten visual hierarchy so the two numbers don't compete.

## 8. i18n
Add keys under `reconcile`/new `allocate` namespace in `en.ts` + `th.ts`:
pool summary, mode labels, remaining-to-target, over-target warning, success,
errors keyed by RPC HINT tokens.

## 9. Read paths to VERIFY remain unchanged (no edits expected)
- `savingPlan.ts` recordedDeposits / depositDayKeys (Σ savings_logs) — must not
  see allocations. ✅ by construction.
- Leaderboard streaks, momentum, activity *deposit* feed — Σ savings_logs only.
- `current_reconciled_balance` — unchanged; allocations are not adjustments.
Add a quick grep check in the verification step to confirm none of these read
`balance_allocations`.

## 10. Edge cases
- **Pool turns negative later** (a subsequent downward checkpoint): allocation
  button hidden; buckets may exceed Verified Balance — surfaced as the existing
  negative-difference state. We do NOT auto-remove from buckets (no withdrawal).
- **Archive a bucket holding allocated money:** `bucket_balance` now includes
  allocations, so the zero-balance archive guard and `transfer_and_archive`
  both account for it correctly (money moves bucket→bucket, never back to pool).
- **Concurrent allocations / double-submit:** unique `client_request_id` +
  under-lock pool check prevent over-allocation past the pool.
- **Allocate exactly to zero:** pool → 0, reminder/affordance disappears.

## 11. Slices (stop + commit between each)
1. ✅ **0078 migration** (`f238b56`) — `balance_allocations` table + RLS +
   `bucket_balance` extension + `allocate_balance_to_bucket` RPC. **No
   `activity_events` row** — that table is room-member readable and the
   amount would leak a private reconcile difference; the owner-only
   `balance_allocations` table is the audit trail.
2. ✅ **Data layer** (`4542ffe`) — `BalanceAllocation` types,
   `useBalanceAllocations` hook, `bucketSaved` allocation term, `useReconcile`
   `unallocatedPool` + `allocate()`, wired into DataContext.
3. ✅ **Card + DnD + sheet** — `BalanceCheckStatus` redesigned (settled slim /
   surplus two-tier with draggable bar) and **relocated into the bucket
   grid `belowHeader`** (under the "เป้าหมายย่อย" heading, above row 1) so the
   chip and buckets share the existing transfer-mode `DndContext` — short,
   natural drag, no section move. Drop is detected in `handleBucketDragEnd`
   (`active.data.type === 'allocation'`) → opens `AllocateSheet` prefilled.
   Tap fallback opens the same sheet with a bucket picker. Allocations
   threaded into all Dashboard `bucketSaved` calls; i18n en/th.
   **Decision:** per-bucket display includes allocations (so a drop visibly
   fills the bucket); hero/vault `total` stays Recorded Deposits
   (`useSavingsTotal`) so it matches Saving Plan and does not mix Verified in.

4. **Option A + shortfall write-down (closes the money-state loop)** — see §14.
   - 4a: Hero/vault `saved` = bucket total (deposits + signed allocations);
     balance-card settled state must not claim "matched" when buckets overstate.
   - 4b: signed allocations (migration 0079) + `deallocate_balance_from_bucket`
     RPC; `useReconcile` `overAllocated` + `deallocate()`; Check Balance flow
     sync panel; calm card nudge; i18n.

### Remaining
- **Apply migrations 0078 + 0079** to Supabase, then runtime-test end-to-end
  (§12). Until applied, `balance_allocations` queries error at runtime.

## 14. Slice 4 — Option A + shortfall write-down (design)

### Money model with signed allocations
```
D    = Σ savings_logs            (Recorded Deposits — Saving Plan / streak only)
ADJ  = Σ balance_adjustments     (signed; from reconcile checkpoints)
ALLOC= Σ balance_allocations     (NOW SIGNED: + into a bucket, − write-down)
Verified   = D + ADJ
BucketTotal= D + ALLOC           (= hero/vault under Option A)
pool       = Verified − BucketTotal = ADJ − ALLOC
  pool > 0 → surplus  → allocate INTO a bucket (positive)   [built]
  pool < 0 → shortfall→ trim a bucket (negative allocation) [slice 4]
```
After the user fully reconciles, ALLOC tracks ADJ and pool → 0, so
hero = buckets = Verified. Symmetric and self-consistent.

### 4a — Hero = bucket total (Option A)
- Dashboard: `heroSaved = total + allocationSum` (allocationSum is signed) →
  equals Σ bucketSaved over own buckets. Pass `heroSaved` to `HeroCard saved`.
- `useReconcile`: expose `overAllocated = max(0, ALLOC − ADJ)` alongside
  `unallocatedPool = max(0, ADJ − ALLOC)`. Exactly one is > 0 (or both 0).
- `BalanceCheckStatus` settled state: only show "ตรงกับเป้าหมายย่อย ✓" when
  both pool and overAllocated are ~0. When `overAllocated > 0`, show the calm
  shortfall nudge (neutral tone) that opens the sync panel.

### 4b — Shortfall write-down
**DB — migration 0079:**
- Relax `balance_allocations.amount` check from `> 0` to `<> 0` (drop the
  inline check dynamically, add `check (amount <> 0)`). `bucket_balance`
  already sums allocations, so signed values just work.
- `deallocate_balance_from_bucket(p_room_id, p_bucket_id, p_amount, p_client_request_id)`
  (mirror `allocate_balance_to_bucket`): `security definer`, advisory lock per
  user+room. Validate: amount > 0, bucket owned/active/in-room; **available to
  trim** `= ALLOC − ADJ` (the overAllocated) `≥ amount`; **bucket_balance ≥
  amount** (no negative bucket). Insert a row with `amount = −p_amount`.
  Idempotent on `client_request_id`. Stable HINT tokens
  (`deallocation_exceeds_shortfall`, `deallocation_insufficient_bucket`, …).
  Still **no `activity_events`** (owner-only privacy).

**Client:**
- `useReconcile`: `deallocate({ bucketId, amount, clientRequestId })`;
  refetch on success; `overAllocated` derived value.
- **Check Balance flow** (`CheckBalanceSheet`): when the saved difference is
  negative, the final panel becomes the **sync panel** — pre-selected smart
  bucket (buffer → farthest deadline), one-tap "ปรับให้ตรง", reassurance line,
  "ไว้ก่อน". Auto-spill: client computes per-bucket trim = min(remaining,
  bucket_balance) and calls `deallocate` once per bucket (each idempotent);
  shows "ปรับจาก N เป้า" only when it spills. Success → "เป้าตรงกับเงินจริงแล้ว ✓".
- **Card nudge** (`BalanceCheckStatus`): neutral-tone shortfall row when
  `overAllocated > 0`, tap → reopen the sync panel.
- Thread the signed `allocationSum` into hero; allocations already flow into
  `bucketSaved` / pace.

**i18n:** extend `reconcile.allocate` (or a new `reconcile.sync`) with the
shortfall copy (sync title, "เงินจริงน้อยกว่าที่จด ฿X", confirm "ปรับให้ตรง",
reassurance, card nudge, success, error-hint map).

### Guardrail note
Bucket write-down is the CLAUDE.md-gated "bucket correction" — explicitly
approved for this slice. It never mutates `savings_logs` or past records
(append-only signed allocation), so streak / Saving Plan / financial history
stay intact; only the live bucket balance (real money) moves.

## 12. Verification
- `tsc -b` + scoped eslint (build/lint are red on clean checkout per project
  notes — verify via tsc + targeted eslint).
- SQL: simulate checkpoint(+diff) → allocate partial → allocate rest → assert
  Verified Balance constant, bucketTotal rises, pool hits 0, plan recordedDeposits
  unchanged, over-pool allocation rejected, idempotent retry returns same row.

## 13. Guardrail compliance
- `savings_logs` stays positive-only and untouched. ✅
- No negative savings_logs / withdrawal-first flow. ✅
- No mutation of financial history; append-only ledger. ✅
- Recorded / Verified / Planned never silently mixed. ✅
- Reconcile difference allocation ships **with** safe double-count prevention. ✅
```
