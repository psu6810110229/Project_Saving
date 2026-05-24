# 41 - Bucket Category Intelligence Foundation

## Summary

Build the bucket overhaul foundation without changing existing muscle memory:

- Tap bucket still opens deposit.
- Drag bucket still opens transfer.
- Category becomes semantic data, not just icon display.
- Existing buckets are migrated safely.
- Smart bucket behavior starts small: `ตอนนี้`, `ถัดไป`, `ครบแล้ว`, soft done-lock, and manual next bucket override.
- No smart notifications in this slice.

## Execution Rules

Implement this plan as separate tasks, one by one.

- Do not batch all work into one commit.
- After each task:
  - run `npm run build`
  - run `npm run lint`
  - manually smoke-test the changed flow
  - commit before starting the next task
- Commit format:
  - `feat(bucket-intel): 41.1 normalize bucket categories`
  - `feat(bucket-intel): 41.2 migrate existing buckets`
  - continue with the matching task number
- If a task reveals unrelated bugs, record them in this doc under Follow-up Findings. Do not fix unrelated issues in the same commit.

## Task 41.1 - Normalize Bucket Categories

Create one shared category system used by Dashboard, Add Money, Manage Project, bucket cards, deposit sheet, and transfer sheet.

New canonical categories:

```ts
type BucketCategory =
  | 'flight'
  | 'stay'
  | 'transport'
  | 'food'
  | 'activities'
  | 'shopping'
  | 'buffer'
  | 'home'
  | 'other';
```

Add shared category metadata:

- label keys
- default bucket name
- icon mapping
- essentiality: `must_have | important | optional | safety | unknown`
- flexibility: `low | medium | high | protected | unknown`
- default priority number

Replace duplicated local icon arrays with the shared registry.

Acceptance:

- Every bucket category picker shows the same options.
- `transport`, `shopping`, `buffer`, and `other` are available everywhere.
- Icons are derived from category, not separately chosen.

## Task 41.2 - Migrate Existing Buckets

Add migration `0062_bucket_category_intelligence.sql`.

Migration behavior:

- Add `category_source text not null default 'user'`.
- Add `category_confidence smallint not null default 100`.
- Add `category_reviewed_at timestamptz`.
- Update old categories:
  - `accom -> stay`
  - `dining -> food`
  - `gear -> shopping`
  - `flight -> flight`
  - `transport -> transport`
  - `home -> home`
  - `travel -> inferred by name, otherwise other`
- Add updated check constraint for the new canonical category set.
- Existing bucket ids, positions, logs, transfers, and balances must not change.

Low-confidence rows:

- ambiguous names become `other`
- `category_source = 'migration'`
- confidence below 70
- `category_reviewed_at = null`

Acceptance:

- Existing users keep all buckets.
- No bucket disappears.
- Old logs still point to the same bucket ids.
- Low-confidence migrated buckets do not power aggressive smart suggestions.

## Task 41.3 - Category Review UI

Add a gentle review path, not an interrupting modal.

Location:

- Bucket management area only.

Behavior:

- Show a compact prompt when user has unreviewed migrated/low-confidence categories:
  `ตรวจหมวดหมู่เป้าหมายย่อย เพื่อให้คำแนะนำแม่นขึ้น`
- Open a bottom sheet or modal listing buckets with category selectors.
- Saving marks reviewed buckets:
  - `category_source = 'user'`
  - `category_confidence = 100`
  - `category_reviewed_at = now()`

Acceptance:

- User can ignore review and continue using the app.
- User can correct old bucket categories.
- Corrected categories update icons everywhere.

## Task 41.4 - Bucket Intent Settings + Events

Add server-backed storage for manual next bucket and lightweight learning events.

Create `bucket_intent_settings`:

- `user_id`
- `room_id`
- `manual_next_bucket_id`
- `manual_next_set_at`
- unique `(user_id, room_id)`
- self-only RLS

Create `bucket_intent_events`:

- `user_id`
- `room_id`
- `bucket_id`
- `event_key`
- `payload jsonb`
- `created_at`
- self-only RLS

Initial event keys:

```ts
'category_reviewed'
'next_bucket_selected'
'next_bucket_cleared'
'done_lock_overridden'
'deposit_bucket_changed_from_default'
'transfer_suggested'
'transfer_completed'
```

Acceptance:

- User can save a manual next bucket.
- Events are append-only.
- RLS prevents access to another user's settings/events.

## Task 41.5 - Bucket Intent Engine

Add pure helper `computeBucketIntent()`.

Inputs:

- own active buckets
- logs
- transfers
- category metadata
- manual next setting

Outputs:

```ts
{
  focusBucketId: string | null;
  nextBucketId: string | null;
  doneBucketIds: Set<string>;
  confidence: {
    focus: number;
    next: number;
  };
  source: 'manual' | 'behavior' | 'category_order' | 'none';
}
```

Rules:

- `done` if saved >= target.
- Only one `focus`.
- Only one `next`.
- Manual next wins unless bucket is done/archived/missing.
- Show focus only if confidence >= 65.
- Show next only if confidence >= 70, unless manual.
- If unsure, return null and stay quiet.

Acceptance:

- No duplicate focus/next statuses.
- Completed bucket is never suggested as next.
- Low-confidence `other` buckets do not dominate suggestions.

## Task 41.6 - Dashboard Bucket Status

Update bucket cards without adding a new dashboard card.

Dashboard bucket statuses:

- `ตอนนี้` for focus bucket
- `ถัดไป` for next bucket
- `ครบแล้ว` for completed buckets
- no badge for normal planned buckets

Rules:

- At most one `ตอนนี้`.
- At most one `ถัดไป`.
- Many `ครบแล้ว` allowed.
- Status badge should replace or sit where the percent currently is, without increasing card height.

Add a compact row under the bucket header only when useful:

```text
ถัดไป: ค่าโรงแรม · เปลี่ยน
```

`เปลี่ยน` opens manual next bucket picker.

Acceptance:

- Dashboard remains visually light.
- Tap bucket still opens deposit.
- Drag bucket still opens transfer.
- User can manually choose next bucket.

## Task 41.7 - Done Bucket Soft Lock

Update `BucketSheet` and Add Money flow.

When selected bucket is complete:

- Do not show quick amount/input by default.
- Show compact completed state instead:
  - bucket complete
  - optional next bucket suggestion
  - actions: `ย้ายเงิน`, `เติมเพิ่มอยู่ดี`
- `เติมเพิ่มอยู่ดี` reveals the existing deposit controls.
- Log `done_lock_overridden`.

No net-new height:

- Replace existing controls in completed mode.
- Do not add another section below the current content.

Acceptance:

- Completed bucket is protected from accidental deposits.
- User can still add more intentionally.
- Deposit confirmation still works.
- Sheet does not become taller in default completed state.

## Task 41.8 - Smarter Transfer Defaults

Enhance existing drag-to-transfer sheet.

Behavior:

- If source bucket is complete and saved > target:
  - default amount = saved - target
- If next bucket exists:
  - default destination = next bucket
- Show one short reason line:
  `Hotel ครบแล้ว และค่าน้ำมันเป็นถัดไป`

Do not auto-transfer money.

Acceptance:

- Drag gesture behavior is unchanged.
- Transfer sheet opens with smarter defaults.
- User can change source, destination, and amount before review.
- Transfer RPC behavior stays unchanged.

## Test Plan

Run after every task:

```bash
npm run build
npm run lint
```

Manual scenarios:

- Create bucket from Dashboard.
- Create bucket from Add Money empty state.
- Create/edit bucket from Manage Project.
- Existing bucket category review.
- Dashboard badge display with active, next, done, and ambiguous buckets.
- Tap bucket opens deposit.
- Drag bucket opens transfer.
- Complete bucket opens soft-lock state.
- Override complete bucket and deposit anyway.
- Transfer extra from complete bucket to next bucket.
- Manual next bucket override persists after reload.

Migration scenarios:

- Old `accom`, `dining`, `gear`, `travel`, `other` buckets migrate.
- Ambiguous old bucket stays `other`.
- Logs and transfers still calculate balances correctly.
- Partner cannot read/write another user's intent settings/events.

## Assumptions

- This is a foundation slice, not a full AI coach.
- No new push notifications.
- Saving Plan remains the source of truth for how much the user should save.
- Smart bucket logic only suggests. It never edits plans, moves money, changes targets, or reorders buckets automatically.
- Existing UX contracts remain unchanged: tap = deposit, drag = transfer.

## Follow-up Findings

- *(empty)*
