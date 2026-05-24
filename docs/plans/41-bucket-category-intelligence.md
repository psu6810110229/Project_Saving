# 41 - Bucket Category Intelligence Foundation

## Goal

Make bucket category data strong enough to power future smart bucket features, without changing the user's existing interaction model.

Non-negotiable UX contracts:

- Tap bucket card = open deposit flow.
- Drag bucket card = open transfer flow.
- Dashboard must not gain a new large insight card.
- Saving Plan remains the source of truth for how much the user should save.
- Smart bucket logic may suggest, but must never auto-move money, auto-edit targets, auto-edit saving plans, or auto-reorder buckets.

This feature is a foundation slice, not a full AI coach. It adds semantic category data, migration safety for old buckets, a small intent engine, a manual next-bucket override, completed-bucket soft lock, and smarter transfer defaults.

## Execution Rules

Implement this plan as separate tasks, one by one.

- Do not batch tasks into one commit.
- After each task:
  - run `npm run build`
  - run `npm run lint`
  - manually smoke-test the changed flow
  - commit before starting the next task
- Commit format:
  - `feat(bucket-intel): 41.1 normalize bucket categories`
  - `feat(bucket-intel): 41.2 migrate existing bucket categories`
  - continue with the matching task number
- Do not fix unrelated issues in the same commit. Record them under Follow-up Findings.
- Keep UI copy in `src/i18n/locales/en.ts` and `src/i18n/locales/th.ts`. Do not hardcode user-visible copy inside components.
- Keep all money movement through existing transfer/deposit APIs. Do not create negative `savings_logs`.

## Current Repo Facts To Preserve

- `public.buckets.category` exists today and is mostly used as icon/display metadata.
- Current category values include `travel`, `flight`, `accom`, `dining`, `transport`, `activities`, `gear`, `home`, `other`.
- `Dashboard.tsx`, `AddMoney.tsx`, and `ManageProject.tsx` each define their own bucket icon/category option arrays. These must be replaced by a shared source.
- Dashboard owns the bucket gesture contract:
  - `BucketRow` is the visual card.
  - `BucketDragCard` wraps cards for drag-to-transfer.
  - `BucketSheet` is the deposit bottom sheet.
  - `BucketTransferSheet` is the transfer bottom sheet.
- `bucketSaved(bucketId, logs, transfers)` already includes deposits plus incoming transfers minus outgoing transfers. Use it for intent and done calculations.

## Task 41.1 - Normalize Bucket Categories

### Files / modules

Create:

- `src/lib/bucketCategories.ts`
- `src/components/BucketCategoryIcon/BucketCategoryIcon.tsx`

Update:

- `src/types/index.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/AddMoney.tsx`
- `src/pages/ManageProject.tsx`
- `src/pages/MemberDetail.tsx`
- previews that import bucket category options

### Types

Replace `BucketCategory` with:

```ts
export type BucketCategory =
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

Add:

```ts
export type BucketCategorySource = 'user' | 'migration' | 'inferred';

export interface Bucket {
  // existing fields unchanged
  category?: BucketCategory;
  category_source?: BucketCategorySource;
  category_confidence?: number;
  category_reviewed_at?: string | null;
}

export interface BucketDraft {
  // existing fields unchanged
  category?: BucketCategory;
  category_source?: BucketCategorySource;
  category_confidence?: number;
  category_reviewed_at?: string | null;
}
```

### Shared metadata

`src/lib/bucketCategories.ts` must export:

```ts
export const BUCKET_CATEGORY_ORDER: BucketCategory[] = [
  'flight',
  'stay',
  'transport',
  'food',
  'activities',
  'shopping',
  'buffer',
  'home',
  'other',
];

export type BucketEssentiality =
  | 'must_have'
  | 'important'
  | 'optional'
  | 'safety'
  | 'project_specific'
  | 'unknown';

export type BucketFlexibility =
  | 'low'
  | 'medium'
  | 'high'
  | 'protected'
  | 'unknown';

export interface BucketCategoryMeta {
  id: BucketCategory;
  labelKey: BucketCategory;
  defaultNameKey: BucketCategory;
  essentiality: BucketEssentiality;
  flexibility: BucketFlexibility;
  defaultPriority: number;
  canBeSuggestedNext: boolean;
  canBeMoveSourceSuggestion: boolean;
  protectsBalance: boolean;
}
```

Use this exact metadata:

| id | essentiality | flexibility | priority | next? | move-source? | protected? |
|---|---|---|---:|---|---|---|
| `flight` | `must_have` | `low` | 10 | yes | no | yes |
| `stay` | `must_have` | `low` | 20 | yes | no | yes |
| `transport` | `important` | `medium` | 30 | yes | yes | no |
| `food` | `important` | `medium` | 40 | yes | yes | no |
| `activities` | `optional` | `medium` | 50 | yes | yes | no |
| `shopping` | `optional` | `high` | 60 | yes | yes | no |
| `home` | `project_specific` | `medium` | 70 | yes | yes | no |
| `other` | `unknown` | `unknown` | 80 | yes, low confidence | yes, low confidence | no |
| `buffer` | `safety` | `protected` | 90 | yes | no | yes |

Also export:

```ts
export function normalizeBucketCategory(value: unknown): BucketCategory;
export function categoryConfidence(bucket: Pick<Bucket, 'category_confidence' | 'category'>): number;
export function isLowConfidenceCategory(bucket: Pick<Bucket, 'category' | 'category_confidence' | 'category_source'>): boolean;
```

Legacy normalization:

- `accom -> stay`
- `dining -> food`
- `gear -> shopping`
- `travel -> other`
- unknown -> `other`

### Icons

`BucketCategoryIcon` maps category to icon:

- `flight` -> `IconPlane`
- `stay` -> `IconBed`
- `transport` -> use the best existing transport-like icon; if none exists, use `IconTicket` only temporarily and record a Follow-up Finding to add a transport icon.
- `food` -> `IconFork`
- `activities` -> `IconTicket`
- `shopping` -> use `IconBriefcase` unless a better shopping/bag icon exists.
- `buffer` -> `IconPiggyBank`
- `home` -> `IconHome`
- `other` -> `IconBriefcase`

Do not manually duplicate icon mapping in pages after this task.

### i18n keys

Update `copy.bucket.categoryLabels`:

```ts
flight
stay
transport
food
activities
shopping
buffer
home
other
```

Add `copy.bucket.defaultNames` with the same keys.

English default names:

- Flight
- Hotel
- Transport
- Food
- Activities
- Shopping
- Buffer
- Home
- Other

Thai default names:

- ค่าเครื่อง
- ค่าโรงแรม
- ค่าเดินทาง
- ค่าอาหาร
- ค่ากิจกรรม
- ช้อปปิ้ง
- เงินสำรอง
- บ้าน
- อื่น ๆ

### Acceptance

- All create/edit bucket category pickers use the same category order and same icon mapping.
- `transport`, `shopping`, `buffer`, and `other` are available everywhere.
- A bucket's icon is always derived from `category`.
- `npm run build` and `npm run lint` pass.

## Task 41.2 - Migrate Existing Bucket Categories

### Migration

Create `supabase/migrations/0062_bucket_category_intelligence.sql`.

Order matters:

1. Add metadata columns.
2. Drop old `buckets_category_check`.
3. Normalize/migrate data.
4. Add new check constraints.

Add columns:

```sql
alter table public.buckets
  add column if not exists category_source text not null default 'user',
  add column if not exists category_confidence smallint not null default 100,
  add column if not exists category_reviewed_at timestamptz;
```

Add constraints:

```sql
check (category in ('flight', 'stay', 'transport', 'food', 'activities', 'shopping', 'buffer', 'home', 'other'))
check (category_source in ('user', 'migration', 'inferred'))
check (category_confidence between 0 and 100)
```

### Migration mapping

Direct old-category mapping:

| old | new | source | confidence |
|---|---|---|---:|
| `flight` | `flight` | `migration` | 90 |
| `accom` | `stay` | `migration` | 90 |
| `dining` | `food` | `migration` | 90 |
| `transport` | `transport` | `migration` | 90 |
| `activities` | `activities` | `migration` | 90 |
| `gear` | `shopping` | `migration` | 80 |
| `home` | `home` | `migration` | 90 |

For old `travel` or `other`, infer from `lower(name)` using this precedence:

1. `flight`: `flight`, `plane`, `airline`, `air`, `fly`, `ตั๋วเครื่อง`, `เครื่องบิน`, `ค่าเครื่อง`
2. `stay`: `hotel`, `stay`, `accom`, `airbnb`, `hostel`, `room`, `ที่พัก`, `โรงแรม`
3. `transport`: `transport`, `train`, `taxi`, `bus`, `fuel`, `gas`, `car`, `metro`, `subway`, `เดินทาง`, `รถไฟ`, `แท็กซี่`, `น้ำมัน`, `รถ`
4. `food`: `food`, `meal`, `dining`, `restaurant`, `cafe`, `อาหาร`, `ข้าว`, `กิน`
5. `activities`: `activity`, `activities`, `tour`, `park`, `museum`, `disney`, `ตั๋ว`, `กิจกรรม`, `ทัวร์`, `สวนสนุก`
6. `shopping`: `shop`, `shopping`, `souvenir`, `gift`, `ของฝาก`, `ช้อป`, `ซื้อของ`
7. `buffer`: `buffer`, `emergency`, `reserve`, `safety`, `backup`, `สำรอง`, `ฉุกเฉิน`
8. `home`: `home`, `house`, `บ้าน`
9. otherwise `other`

Name-inferred category:

- `category_source = 'inferred'`
- `category_confidence = 80`
- `category_reviewed_at = null`

Ambiguous fallback:

- `category = 'other'`
- `category_source = 'inferred'`
- `category_confidence = 40`
- `category_reviewed_at = null`

### Acceptance

- No bucket id, position, target, archived state, log row, or transfer row changes.
- Existing buckets remain visible.
- Existing old categories no longer violate the new check constraint.
- `bucketSaved()` still returns the same balances after migration.
- Direct old category mappings do not trigger mandatory review.
- Ambiguous `other` rows can be reviewed later.
- `npm run build` and `npm run lint` pass after type updates.

## Task 41.3 - Category Review UI

### UI location

Add this only to the bucket management area, not the main dashboard feed.

Use existing `BucketManager` as the host. Add a compact prompt above the current bucket list when any bucket has:

```ts
category_confidence < 80 || category_source === 'inferred'
```

Prompt copy keys:

```ts
copy.bucket.categoryReview.title
copy.bucket.categoryReview.body
copy.bucket.categoryReview.cta
copy.bucket.categoryReview.save
copy.bucket.categoryReview.skip
copy.bucket.categoryReview.reviewedSuccess
```

Recommended copy:

- EN title: `Review bucket categories`
- EN body: `A quick check helps future suggestions understand your plan.`
- EN CTA: `Review`
- TH title: `ตรวจหมวดหมู่เป้าหมายย่อย`
- TH body: `เช็กสั้น ๆ เพื่อให้คำแนะนำเข้าใจแผนของคุณมากขึ้น`
- TH CTA: `ตรวจ`

### Component

Create:

- `src/components/BucketCategoryReviewModal/BucketCategoryReviewModal.tsx`

Props:

```ts
interface BucketCategoryReviewModalProps {
  open: boolean;
  buckets: Bucket[];
  onClose: () => void;
  onSave: (updates: { id: string; category: BucketCategory }[]) => Promise<{ error?: string }>;
}
```

Use `Modal`, `CategoryRow`, and `BucketCategoryIcon`. Do not add a new UI framework.

### Persistence

Extend `useBuckets.saveBuckets()` or add a narrow helper `reviewBucketCategories()` in `useBuckets`.

Recommended: add `reviewBucketCategories(updates)` to `useBuckets` so category review does not accidentally rewrite target/name/position.

For each reviewed bucket:

```ts
category = selected category
category_source = 'user'
category_confidence = 100
category_reviewed_at = now()
```

Log `category_reviewed` intent event only after Task 41.4 exists. Until then, leave a TODO in this task and wire it in Task 41.4.

### Acceptance

- User can ignore review and keep using the app.
- User can correct migrated categories.
- Corrected categories immediately update icons everywhere after refetch/local state update.
- Review does not change bucket name, target, position, archived state, logs, or transfers.
- `npm run build` and `npm run lint` pass.

## Task 41.4 - Bucket Intent Settings + Events

### Migration

Create `supabase/migrations/0063_bucket_intent_settings.sql`.

Create `public.bucket_intent_settings`:

```sql
create table if not exists public.bucket_intent_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  manual_next_bucket_id uuid references public.buckets(id) on delete set null,
  manual_next_set_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, room_id)
);
```

Create `public.bucket_intent_events`:

```sql
create table if not exists public.bucket_intent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  bucket_id uuid references public.buckets(id) on delete set null,
  event_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Allowed event keys:

```ts
'category_reviewed'
'next_bucket_selected'
'next_bucket_cleared'
'done_lock_overridden'
'deposit_bucket_changed_from_default'
'transfer_suggested'
'transfer_completed'
```

RLS:

- Settings select/insert/update/delete: `user_id = auth.uid()` and caller is a member of `room_id`.
- Settings write must also ensure `manual_next_bucket_id` is null OR belongs to the caller, same room, and active.
- Events select/insert: `user_id = auth.uid()` and caller is a member of `room_id`.
- Events update/delete: no client policy.

Add indexes:

```sql
create index if not exists idx_bucket_intent_events_user_room_time
  on public.bucket_intent_events (user_id, room_id, created_at desc);
```

### Hook

Create:

- `src/hooks/useBucketIntentSettings.ts`

API:

```ts
export function useBucketIntentSettings(roomId: string | null): {
  settings: BucketIntentSettings | null;
  loading: boolean;
  error: string | null;
  setManualNextBucket: (bucketId: string | null) => Promise<{ error?: string }>;
  logIntentEvent: (event: {
    eventKey: BucketIntentEventKey;
    bucketId?: string | null;
    payload?: Record<string, unknown>;
  }) => Promise<void>;
};
```

Rules:

- `setManualNextBucket(bucketId)` upserts one settings row.
- Passing `null` clears manual next and writes `manual_next_set_at = null`.
- `logIntentEvent` is fire-and-forget; it must never block deposits/transfers.
- Do not subscribe realtime for v1. Refetch after setting manual next.

### Type additions

Add:

```ts
export type BucketIntentEventKey =
  | 'category_reviewed'
  | 'next_bucket_selected'
  | 'next_bucket_cleared'
  | 'done_lock_overridden'
  | 'deposit_bucket_changed_from_default'
  | 'transfer_suggested'
  | 'transfer_completed';

export interface BucketIntentSettings {
  user_id: string;
  room_id: string;
  manual_next_bucket_id: string | null;
  manual_next_set_at: string | null;
  created_at: string;
  updated_at: string;
}
```

### Event logging points

Wire these exact points:

- `category_reviewed`: after category review save succeeds, one event per reviewed bucket.
- `next_bucket_selected`: after manual next bucket save succeeds.
- `next_bucket_cleared`: after clearing manual next succeeds.
- `done_lock_overridden`: when the user taps `เติมเพิ่มอยู่ดี` / `Add anyway`.
- `deposit_bucket_changed_from_default`: in Add Money only when a computed default/focus bucket was preselected and user chooses a different bucket.
- `transfer_suggested`: once per transfer sheet open when smart defaults/reason are applied.
- `transfer_completed`: after transfer RPC succeeds.

### Acceptance

- Settings persist after reload.
- Manual next can be cleared.
- Events append without blocking user flows.
- RLS blocks another user from reading/writing settings/events.
- `npm run build` and `npm run lint` pass.

## Task 41.5 - Bucket Intent Engine

### File

Create:

- `src/lib/bucketIntent.ts`

### API

```ts
export type BucketIntentStatus = 'focus' | 'next' | 'done';
export type BucketIntentSource = 'manual' | 'behavior' | 'category_order' | 'none';

export interface BucketIntentResult {
  focusBucketId: string | null;
  nextBucketId: string | null;
  doneBucketIds: Set<string>;
  confidence: {
    focus: number;
    next: number;
  };
  source: {
    focus: BucketIntentSource;
    next: BucketIntentSource;
  };
}

export interface BucketIntentInput {
  buckets: Bucket[];
  logs: SavingsLog[];
  transfers?: BucketTransfer[];
  currentUserId?: string;
  settings?: BucketIntentSettings | null;
}

export function computeBucketIntent(input: BucketIntentInput): BucketIntentResult;
```

### Deterministic algorithm

Preparation:

- Active buckets only: `archived_at == null`.
- Done bucket: `target_amount > 0 && bucketSaved(id, logs, transfers) >= target_amount`.
- Own recent deposits: logs where `log.user_id === currentUserId`, `amount > 0`, `bucket_id` matches an active bucket, sorted desc by `created_at`, first 10.

Focus:

- Exclude done buckets.
- If fewer than 2 recent deposits, return no focus.
- Score each candidate:
  - recent deposit count share in last 5 deposits times 60
  - recent amount share in last 10 deposits times 20
  - +10 if the latest deposit went to this bucket
  - +5 if `category_confidence >= 80`
  - -15 if `category_confidence < 70`
  - -20 if category is `other`
- Pick highest score.
- Return focus only if score >= 65.

Next:

- If manual next exists, is active, is not done, and is not the focus bucket:
  - `nextBucketId = manual_next_bucket_id`
  - `confidence.next = 100`
  - `source.next = 'manual'`
- Else:
  - Exclude done and focus buckets.
  - Sort by category `defaultPriority`, then bucket `position`, then `created_at`.
  - Candidate must have `category_confidence >= 70`.
  - Return next only when either focus exists OR at least one bucket is done. This prevents noisy "next" suggestions in very new rooms.
  - `confidence.next = 70`
  - `source.next = 'category_order'`

Low confidence behavior:

- If no rule passes, return nulls and source `none`.
- Never return a done bucket as focus or next.
- Never mutate settings inside this helper.

### Acceptance

- Pure helper has no Supabase imports.
- Same inputs always produce same result.
- At most one focus and one next.
- Done buckets can be many.
- `other` categories do not dominate suggestions.
- `npm run build` and `npm run lint` pass.

## Task 41.6 - Dashboard Bucket Status + Manual Next Picker

### Components

Update:

- `BucketGridItem` adds optional `status`.
- `BucketRow` accepts:

```ts
status?: {
  kind: 'focus' | 'next' | 'done';
  label: string;
};
```

Create:

- `src/components/BucketNextPickerModal/BucketNextPickerModal.tsx`

Props:

```ts
interface BucketNextPickerModalProps {
  open: boolean;
  buckets: { id: string; name: string; category?: BucketCategory; saved: number; target: number }[];
  currentNextBucketId: string | null;
  onSelect: (bucketId: string) => void;
  onClear: () => void;
  onClose: () => void;
}
```

Use existing `Modal`, not a new sheet framework.

### Dashboard wiring

In `Dashboard.tsx`:

- Load `useBucketIntentSettings(activeRoomId)`.
- Compute intent with `computeBucketIntent()`.
- Add status to `bucketItems`:
  - done wins over all
  - focus next
  - next next
- Display at most one compact strip below bucket header when `nextBucketId` exists:

```text
Next: {bucketName} · Change
```

Use copy keys:

```ts
copy.bucketIntent.status.focus
copy.bucketIntent.status.next
copy.bucketIntent.status.done
copy.bucketIntent.nextStrip
copy.bucketIntent.changeNext
copy.bucketIntent.nextPickerTitle
copy.bucketIntent.clearNext
```

English labels:

- Focus now
- Next
- Done

Thai labels:

- ตอนนี้
- ถัดไป
- ครบแล้ว

### Visual rules

- Status badge replaces the current top-right percentage on `BucketRow`.
- If there is no status, keep showing percent as today.
- Do not increase `BucketRow` height or aspect ratio.
- Partner/read-only bucket grids do not show focus/next status. They may show `done` if computed from saved >= target, but no manual next controls.

### Acceptance

- Dashboard stays visually light.
- Tap bucket still opens `BucketSheet`.
- Drag bucket still opens `BucketTransferSheet`.
- Manual next selection persists after reload.
- Clearing manual next returns control to computed next.
- `npm run build` and `npm run lint` pass.

## Task 41.7 - Done Bucket Soft Lock

### BucketSheet

Update `BucketSheet` props:

```ts
bucketId: string;
isComplete?: boolean;
extraAmount?: number;
nextBucketName?: string | null;
onRequestTransferExtra?: (sourceBucketId: string) => void;
onDoneLockOverride?: (bucketId: string) => void;
```

Completed default state:

- Keep `BucketHeader`.
- Replace quick amounts, custom input, projected progress, and trend chart with a compact done state.
- Show:
  - completed message
  - optional next bucket line
  - buttons:
    - `Move extra` if `extraAmount > 0` and `onRequestTransferExtra` exists
    - `Add anyway`
- Tapping `Add anyway` reveals the existing deposit controls inside the same sheet and logs `done_lock_overridden`.

Copy keys:

```ts
copy.addMoney.doneLock.title
copy.addMoney.doneLock.body
copy.addMoney.doneLock.nextBucket
copy.addMoney.doneLock.moveExtra
copy.addMoney.doneLock.addAnyway
```

### Dashboard wiring

When `Move extra` is tapped:

- Close `BucketSheet`.
- Open `BucketTransferSheet`.
- Source = completed bucket.
- Destination = `nextBucketId` if available, otherwise current transfer picker default.
- Initial amount = `saved - target`.
- Reason = completed-to-next reason when next exists.

### AddMoney page

Add the same soft-lock concept, but do not add transfer sheet to AddMoney in v1.

When selected bucket is complete:

- Show completed state before quick amount controls.
- Buttons:
  - `Use next bucket` if `nextBucketId` exists
  - `Add anyway`
- `Use next bucket` changes selected bucket.
- `Add anyway` reveals controls and logs `done_lock_overridden`.

### Acceptance

- Completed bucket no longer shows quick amount controls by default.
- User can still intentionally deposit into completed bucket.
- Sheet/page default completed state is shorter than or equal to the current full deposit controls.
- Confirm deposit modal still appears before actual deposit.
- `npm run build` and `npm run lint` pass.

## Task 41.8 - Smarter Transfer Defaults

### BucketTransferSheet API

Add props:

```ts
initialAmount?: number | null;
suggestionReason?: string | null;
onSuggestionShown?: () => void;
```

Behavior:

- Initial `amountValue` starts from `initialAmount` when valid.
- `suggestionReason` renders once under the sheet title in edit step.
- `onSuggestionShown` fires once per sheet mount when `suggestionReason` or `initialAmount` is present.

Copy keys:

```ts
copy.bucketTransfer.suggestion.completedToNext
copy.bucketTransfer.suggestion.completedExtra
```

Recommended copy:

- EN completed-to-next: `{source} is complete and {destination} is next.`
- EN completed-extra: `{source} is complete. Moving extra keeps the bucket tidy.`
- TH completed-to-next: `{source} ครบแล้ว และ {destination} เป็นถัดไป`
- TH completed-extra: `{source} ครบแล้ว ย้ายส่วนเกินออกได้`

### Dashboard transfer intent

Change transfer intent state from:

```ts
{ sourceId: string; destinationId: string }
```

to:

```ts
{
  sourceId: string;
  destinationId: string | null;
  initialAmount?: number | null;
  suggestionReason?: string | null;
}
```

Drag behavior:

- Preserve dragged source and dragged destination.
- If dragged source is complete and has extra amount, prefill amount with extra.
- If dragged destination is the computed next bucket, use completed-to-next reason.
- Otherwise use completed-extra reason.

Done-lock move-extra behavior:

- Source = completed bucket.
- Destination = computed next bucket when available.
- Initial amount = extra.
- Reason = completed-to-next when next exists, otherwise completed-extra.

Success:

- Log `transfer_completed` after the RPC succeeds.

### Acceptance

- Drag gesture behavior is unchanged.
- Smart defaults never skip review.
- User can change source, destination, and amount before submitting.
- Transfer RPC contract is unchanged.
- `npm run build` and `npm run lint` pass.

## Final Test Plan

Run after every task:

```bash
npm run build
npm run lint
```

Manual flow matrix:

- Create bucket from Dashboard modal.
- Create bucket from Add Money empty state.
- Create and edit bucket from Manage Project.
- Review migrated category and confirm icon updates.
- Dashboard with one focus, one next, many done.
- Dashboard with low confidence/ambiguous buckets shows no noisy next.
- Tap own bucket opens deposit.
- Drag own bucket opens transfer.
- Partner bucket grid remains read-only.
- Complete bucket opens soft-lock state.
- Add anyway still allows deposit after confirm modal.
- Move extra from done bucket opens transfer with prefilled extra amount.
- Manual next bucket persists after reload.
- Clear manual next returns to computed next.

Migration checks:

- Old `accom`, `dining`, `gear`, `travel`, `other` buckets migrate.
- Ambiguous old bucket remains `other` with low confidence.
- Existing logs still reference the same bucket ids.
- `bucketSaved()` values are unchanged before/after migration on a seeded local project.
- RLS blocks access to another user's intent settings and events.

## Follow-up Findings

- `transport` category uses `IconTicket` (same as `activities`) because no dedicated transport icon exists. Add a distinct `IconBus` or `IconCar` to `Icon.tsx` and update `BucketCategoryIcon` mapping.
