# Task 28 - Sprint 1: Intelligence Pass Implementation Plan

## Goal
Layer three small intelligence features on top of the post-alpha
0.9.7 base: a smart pre-filled deposit amount, milestone celebration
moments at fixed progress thresholds, and a small streak freeze
budget so the streak survives a missed day.

> This file is a plan only. Do not implement until the user
> explicitly approves a specific feature in this plan.

## Target Release

- Current version observed in `package.json`: `0.9.7`.
- **Proposed target version**: `0.10.0`.
- Reasoning (one sentence): every feature in this sprint is additive
  and backwards-compatible (no schema rewrites, no negative
  `savings_logs`, no change to the deposit contract), so a minor
  bump from `0.9.x` is a more honest signal than `1.0.0-beta.1`,
  which would imply a general-availability commitment we are not
  ready to make. The user may override.

---

## Execution Rules (strict)

1. Implement features in this **fixed order**:
   1. **SPRINT1-001 Smart Default Amount** (client-only).
   2. **SPRINT1-002 Milestone Celebrations** (small new table,
      computed-on-read).
   3. **SPRINT1-003 Streak Freeze** (schema + computed-state
      changes).
2. **Rationale for the order:** ordered from lowest schema risk
   (Smart Default = pure client) to highest (Streak Freeze =
   schema + computed-state changes). Land safe wins first so a
   bad Streak Freeze migration does not force a rollback of the
   other two features.
3. **Stop after each feature.** Run `npm run build` and
   `npm run lint`, wait for the user to verify the slice on a
   device, and do not start the next feature until the user
   explicitly approves it.
4. One feature = one branch = one commit set. Commit message
   format: `feat(sprint-1): SPRINT1-00X <short name>`. Do not mix
   features in a single commit.
5. **No adjacent fixes.** If you notice an unrelated bug while
   implementing a Sprint 1 feature, add a short note to the
   "Follow-up findings" section at the bottom of this file. Do
   not fix it in the same branch.
6. **Token discipline:** read only the files listed under the
   active feature's "Affected files". Do not re-read plans 01-27.
   Do not load design references, atomic preview pages, or older
   plan files unless a specific constraint must be verified.
7. Update only the active feature's `Status` and
   `Verification notes` in this doc; do not rewrite untouched
   sections.
8. Project rules from `CLAUDE.md` apply in full — see *Standard
   Workflow*, *Code Rules*, *Styling And UX Rules*,
   *Money-State Guardrails*, and *What AI Assistants Must Not
   Do*.

---

## Cross-Feature Hard Constraints

These apply to every feature in this sprint.

- **No new npm packages.** Any animation, sparkle, or
  highlight effect must reuse `framer-motion` (already a dep)
  and existing motion primitives in `src/lib/motion.ts`, or
  pure CSS/Tailwind. No confetti library, no canvas-confetti,
  no lottie.
- **No CSS Modules.** Tailwind utilities only, using tokens
  from `tailwind.config.js` (`bg`, `surface`, `surfaceAlt`,
  `ink`, `ink-muted`, `brand-*`, `accent-*`, `danger`, `lg`,
  `xl`, `2xl`, `pill`, `soft`, `neuRaised`, `neuPressed`,
  `haloOrange`, etc.). No `bg-canvas`, no `terracotta`.
- **No `any` type.** Type all new shared shapes; add them to
  `src/types/index.ts` when they cross hook/component
  boundaries.
- **No emoji** in plan text, UI copy, notifications, commit
  messages, push titles, or push bodies.
- **`prefers-reduced-motion`** must be respected by every new
  animation. Reuse the existing pattern (Framer Motion's
  `useReducedMotion` or media-query check) used elsewhere in
  the app.
- All Supabase writes go through the existing patterns:
  security-definer RPCs for sensitive writes, otherwise
  `src/lib/supabase.ts` via existing hooks.
- **`savings_logs` remains positive-only.** None of these
  three features may introduce negative rows, withdrawal-first
  flows, or bucket-correction allocations.
- **No new top-level folders.** All new components go under
  `src/components/<ComponentName>/<ComponentName>.tsx`, hooks
  under `src/hooks/`, helpers under `src/lib/`, migrations
  under `supabase/migrations/`.

---

## SPRINT1-001: Smart Default Amount on /add

- **Status**: not started
- **Priority**: P1
- **Risk**: low (client-only, no schema change)

### Behavioral / psychological rationale
A friction-free default reduces the micro-decision of "how much
should I log this time", which is the single biggest reason a user
abandons a deposit half-way. Pre-filling a habitual amount turns
the action from "decide + type + submit" into "tap + submit", and
preserves the user's existing routine instead of overriding it
with a marketing-style suggestion.

### User stories
- As a returning user, I open `/add`, pick a bucket, and see the
  amount I most often log already filled in, so I can confirm
  with one tap.
- As a new user with fewer than the minimum history threshold,
  I see no pre-fill and the form behaves exactly as today.
- As a user with mixed amounts, I can edit or clear the pre-fill
  with a single tap without any extra "are you sure" prompt.

### Current findings from code review
- `src/components/AddMoneyForm/AddMoneyForm.tsx` is a controlled
  form receiving `amountValue: string`, `selectedQuickAmount:
  number | null`, and the change callbacks from its parent. The
  computed `amount` already prefers `Number(amountValue) ||
  selectedQuickAmount || 0`, so a pre-fill applied via either
  controlled prop will flow through correctly.
- `src/hooks/useLogs.ts` exposes a `logs` array (positive
  `amount`, `bucket_id`, `created_at`) which is sufficient to
  compute a "habitual amount" client-side. No new query is
  needed for the minimum viable version.
- The page that owns the form state lives upstream of
  `AddMoneyForm` (typically `src/pages/AddMoney.tsx` — confirm
  during implementation by a single grep, do not open
  unrelated pages).
- Quick amounts already exist (`QuickAddRow`); the Smart Default
  should pre-select the matching quick-amount chip when the
  computed default equals one of them, so the existing UI
  language is preserved.

### Data model plan
None. This feature is pure client-side derivation.

### Supabase migration filename + intended changes
None.

### RPC additions
None.

### UI plan
- Reuse `src/components/AddMoneyForm/AddMoneyForm.tsx` unchanged
  in shape. The parent passes a pre-filled `amountValue` (and a
  matching `selectedQuickAmount` when the value equals an
  existing quick-amount).
- Add a tiny, dismissible hint label below the amount field
  using the existing `text-ink-muted` token: copy along the
  lines of "Based on your recent saves". No new icon needed;
  text only. The hint disappears as soon as the user edits or
  clears the field.
- No new modal, no new screen.

### Hook changes
- New hook `src/hooks/useSmartDefaultAmount.ts`:
  - Signature: `useSmartDefaultAmount(userId: string |
    undefined, bucketId: string | null, logs: SavingsLog[]):
    { value: number | null; reason: 'mode' | 'recent' | 'none'
    }`.
  - Pulls the user's last N positive deposits for the selected
    bucket (fall back to all buckets when bucket scope is too
    sparse).
  - Computes: if `N >= 3` (**proposed N**), pick the most
    frequent amount (mode); on tie, pick the most recent of
    the tied values; if every amount is distinct, fall back
    to the most recent amount.
  - Returns `{ value: null, reason: 'none' }` when the user has
    fewer than N qualifying logs. The form falls back to today's
    behaviour (empty input).
- No change to `useLogs.ts` itself. The hook consumes the
  already-fetched `logs` array.

### Edge function changes
None.

### Acceptance criteria
- [ ] User with 3 or more historical deposits for the selected
      bucket sees the amount field pre-filled on `/add` after
      bucket selection.
- [ ] When the pre-fill matches one of the user's quick amounts,
      that quick-amount chip is visually selected.
- [ ] A short hint sits under the amount field while the
      pre-fill is in effect; the hint disappears the moment the
      user edits, clears, or taps a different quick amount.
- [ ] User with fewer than 3 qualifying deposits sees the amount
      field empty and no hint (today's behaviour, no regression).
- [ ] Switching the selected bucket re-computes the pre-fill
      without a page refresh.
- [ ] Pre-fill never blocks submission, never auto-submits,
      never changes the deposit value silently after submit is
      pressed.
- [ ] No new network request is added to the `/add` page load
      path.
- [ ] `npm run build` and `npm run lint` pass.

### Out of scope
- No bucket-specific or partner-aware smart defaults beyond the
  simple per-bucket history described above.
- No A/B variation, telemetry, or analytics event for accept /
  override.
- No backend persistence of "user's smart default" (it is
  recomputed each session from `logs`).
- No change to `QuickAddRow`, `ProjectedProgressCard`, or
  `SlipAttachField`.

### Verification notes
- *(empty)*

### Follow-up findings
- *(empty)*

---

## SPRINT1-002: Milestone Celebrations at 25 / 50 / 75 / 90 %

- **Status**: shipped
- **Priority**: P1
- **Risk**: medium (small new table + cross-user dedupe)

### Behavioral / psychological rationale
Variable-progress goals stay motivating when they have visible
sub-victories. Surfacing a moment exactly when the room crosses
a fixed threshold (25, 50, 75, 90 percent) converts an abstract
progress bar into a remembered emotional event, which is the
core mechanism behind goal-gradient effect. Capping to four
thresholds prevents celebration fatigue.

### User stories
- As a room member, when the room's total saved crosses a 25 /
  50 / 75 / 90 percent threshold for the first time, I see a
  celebration moment on app entry.
- As a partner of the user whose deposit triggered the
  crossing, I also see the celebration once when I open the
  app, not multiple times.
- As a user reopening the app, I do not see the same milestone
  celebration twice; once acknowledged it stays acknowledged
  for me across devices.

### Current findings from code review
- Room-level progress is already computed for Dashboard;
  derivation lives near `useLeaderboard` / `useGoal` (do not
  open more than is needed to identify the current "totalSaved
  / targetAmount" expression).
- `src/components/OutcomeModal/OutcomeModal.tsx` and
  `src/components/OutcomeModalBody/OutcomeModalBody.tsx`
  already render a centered modal with `IconBubble`, headline,
  body, and a `children` slot for action buttons. They are
  reusable for celebration with a different icon/copy/tone.
- `supabase/functions/notify-partner-deposit/` is the
  established pattern for "do a server-side thing in response
  to a new log" — useful as a reference, but Milestone
  Celebrations should compute the crossing on read, not by
  writing a notification per crossing (avoid duplicating
  notifications across partner devices).
- Existing migrations stop at `0049`. Next migration filename:
  `supabase/migrations/0050_milestone_acknowledgements.sql`.

### Data model plan
A small, room-scoped, per-user acknowledgement table. We
compute the *crossing* by comparing current room totalSaved
against the four thresholds at read time. We persist only the
*acknowledgement* (the user tapped "Got it") so each user sees
each milestone once.

Shape (described, not SQL):
- `milestone_acknowledgements`
  - `id uuid primary key default gen_random_uuid()`
  - `room_id uuid not null references public.rooms(id) on
    delete cascade`
  - `user_id uuid not null references auth.users(id) on delete
    cascade`
  - `threshold smallint not null` (one of 25, 50, 75, 90)
  - `acknowledged_at timestamptz not null default now()`
  - Unique on `(room_id, user_id, threshold)` so re-tapping
    "Got it" is a no-op.

### Supabase migration filename + intended changes
File: `supabase/migrations/0050_milestone_acknowledgements.sql`.

Intended changes:
- Create table `milestone_acknowledgements` with the shape
  above.
- Add check constraint `threshold in (25, 50, 75, 90)`.
- Add index on `(room_id, user_id)` for the read path.
- RLS: enabled.
  - Select policy: caller must be a member of `room_id` (reuse
    the helper pattern from `0012_fix_room_members_visibility.sql`
    rather than a recursive `room_members` policy).
  - Insert policy: `user_id = auth.uid()` AND caller is a
    member of `room_id`.
  - No client update / delete (acknowledgement is
    write-once-per-threshold).

### RPC additions
- `public.acknowledge_milestone(p_room_id uuid, p_threshold
  smallint) returns void`
  - Security definer.
  - Validates `auth.uid()` is a room member.
  - Validates `p_threshold in (25, 50, 75, 90)`.
  - Inserts the row with `on conflict do nothing` (idempotent).
  - Safe `search_path`.

No "create milestone" RPC. The celebration *appears* when:
`(roomTotalSaved / roomTarget * 100) >= threshold` AND there is
no `milestone_acknowledgements` row for `(room_id, auth.uid(),
threshold)`. This means a refund/correction that drops the
room below the threshold does *not* fire a duplicate later
crossing for users who already acknowledged it.

### UI plan
- New component
  `src/components/MilestoneCelebrationModal/MilestoneCelebrationModal.tsx`:
  - Composes `OutcomeModal` with `outcome="success"`,
    threshold-specific copy, an existing icon component (e.g.
    `IconPiggyBank` or another already-imported icon — do
    **not** add a new SVG just for this), and a single primary
    "Got it" button that calls the acknowledge RPC and closes.
  - Wraps the icon bubble in a small framer-motion scale-in
    using `SPRING.outcome` (already used by `OutcomeModal`) and
    a Tailwind ring/halo using the `haloOrange` token. Respects
    `prefers-reduced-motion`.
- Mount inside `AppLayout` (the same shell that gates room
  access) so the modal can appear on any room-bound route, but
  show it at most once per app entry per user per pending
  threshold.
- If multiple thresholds are pending at the same time (e.g. a
  user away for a week returns to find 50 and 75 both crossed),
  show only the highest pending threshold; remaining lower
  thresholds are auto-acknowledged silently on RPC call.

### Hook changes
- New hook `src/hooks/useMilestoneCrossings.ts`:
  - Inputs: `roomId`, `userId`, `totalSaved`, `target`.
  - Loads existing `milestone_acknowledgements` for the
    `(room_id, user_id)` pair on mount and via realtime
    subscription on insert.
  - Returns `{ pendingThreshold: 25 | 50 | 75 | 90 | null;
    acknowledge: () => Promise<void> }`.
  - `pendingThreshold` is the highest threshold the user has
    crossed but not yet acknowledged.
  - `acknowledge` calls the RPC and optimistically updates
    local state.
- Reuse existing room-totals data; do not introduce a new
  full-fetch of `savings_logs` or `goals`.

### Edge function changes
None. Crossing detection is client-computed; acknowledgement is
a single RPC call. We deliberately do not push partner alerts
for milestone crossings in Sprint 1 to avoid the dedupe and
ordering complexity that `notify-partner-deposit` had to solve.

### Acceptance criteria
- [ ] When the room crosses 25 percent for the first time, the
      next time each room member opens the app they see the
      celebration modal exactly once.
- [ ] Tapping "Got it" closes the modal and writes one
      `milestone_acknowledgements` row; reopening the app does
      not show the same threshold again, on any device.
- [ ] Partner sees the same celebration independently of who
      logged the deposit that caused the crossing.
- [ ] If a correction (admin tooling, not in this sprint) ever
      drops the room below an already-acknowledged threshold
      and back above it, no second celebration fires for users
      who already acknowledged.
- [ ] A user who joins a room already past, say, 50 percent
      sees the 50 percent celebration (not 25), because 50 is
      the highest pending threshold from their perspective; the
      25 threshold is silently acknowledged.
- [ ] Modal copy contains no emoji, no marketing copy. Plain
      sentence form, lowercase tokens via the existing copy
      pattern.
- [ ] Modal animation respects `prefers-reduced-motion`.
- [ ] RLS prevents inserting an acknowledgement for a room the
      caller is not a member of (verify with the second
      account).
- [ ] No row is ever written to `savings_logs` as part of a
      milestone celebration.
- [ ] `npm run build` and `npm run lint` pass.

### Out of scope
- No partner push notification for milestone crossings.
- No streak-milestone celebrations (Sprint 1 milestones are
  **room progress only**).
- No per-bucket milestone celebrations.
- No "share with partner" or social action button.
- No retroactive backfill for rooms that already passed
  thresholds before this migration — these rooms see the next
  unacknowledged threshold they cross *after* deploy, plus any
  threshold currently above their saved total.

### Verification notes
- Migration `0050_milestone_acknowledgements.sql` adds the
  `milestone_acknowledgements` table (id / room_id / user_id /
  threshold / acknowledged_at), a unique constraint on
  `(room_id, user_id, threshold)`, the `(room_id, user_id)`
  read index, RLS policies that reuse `public.is_room_member`,
  and the `public.acknowledge_milestone(p_room_id, p_threshold)`
  security-definer RPC with `on conflict do nothing`. No
  client update / delete policies are defined.
- `src/hooks/useMilestoneCrossings.ts` loads the
  `(room_id, user_id)` slice of acknowledgements on mount, keeps
  it in sync via a realtime `INSERT` subscription scoped to the
  current `user_id`, and exposes `pendingThreshold` (the
  highest crossed-but-unacknowledged threshold) plus an
  `acknowledge()` action that silently catches up any lower
  crossed threshold so a fresh join past 50 % does not surface
  a stale 25 % modal later.
- `src/components/MilestoneCelebrationModal/MilestoneCelebrationModal.tsx`
  composes the existing `OutcomeModal` (`outcome="success"`)
  with the existing `IconPiggyBank` inside `IconBubble`
  (`tone="solid"` + `shadow-haloOrange`) and a single `Button`
  CTA. The icon bubble uses a framer-motion scale-in driven by
  `SPRING.outcome` and collapses to a flat fade when
  `useReducedMotion()` is true.
- Mounted via a small `MilestoneCelebration` container in
  `src/pages/AppLayout.tsx` inside `<DataProvider>`. Room
  totals are read from `useSharedData()` — `totalSaved` sums
  `leaderboard.entries[i].saved`, `totalTarget` sums their
  targets and falls back to `goal.target_amount` — so the
  threshold check matches what `TotalVaultCard` already
  displays on the dashboard.
- Locale copy lives under `milestoneCelebration.{title, body,
  cta}` in `src/i18n/locales/en.ts` and `th.ts`. Plain
  sentence form, no emoji. Return types are explicitly widened
  to `string` so the Thai variant satisfies `Messages`.
- New shared types `MilestoneThreshold` (`25 | 50 | 75 | 90`)
  and `MilestoneAcknowledgement` were added to
  `src/types/index.ts`. No `any` introduced.
- `npm run build` passes locally. `npm run lint` passes for
  every file touched by this slice; one pre-existing error
  in `supabase/functions/send-nudge/index.ts` is recorded in
  *Follow-up findings* below.

### Follow-up findings
- `supabase/functions/send-nudge/index.ts:180` has an unused
  `_error` binding that fails `npm run lint`. Predates this
  slice (introduced in `53e3a89`, the `feat(nudge): move
  button to head-to-head card and randomize Thai push body`
  commit). Left untouched per the "no adjacent fixes" sprint
  rule — should be cleaned up in a dedicated fix or alongside
  the next nudge change.

---

## SPRINT1-003: Streak Freeze (grace days)

- **Status**: not started
- **Priority**: P2
- **Risk**: high (changes computed-state semantics for streaks)

### Behavioral / psychological rationale
A streak that breaks the first time a user is busy or sick
trains the user to *expect* the streak to break and stop
investing in it. A small, capped monthly budget of forgivable
missed days lets the streak survive realistic life events
without removing the day-by-day commitment loop. The cap is
small on purpose so the streak still feels earned.

### User stories
- As a user who saved every day for 10 days, then missed one
  day, my streak shows as 11 the next time I save instead of
  resetting to 1, because a freeze was automatically spent.
- As a user, I can see how many freezes I have left this
  Bangkok calendar month.
- As a user who misses a second day in the same month after
  the freeze budget is exhausted, my streak resets to 0 the
  same way it does today.

### Current findings from code review
- `src/hooks/useStreak.ts` returns `{ streak, hasLoggedToday }`
  by passing logs to `calcStreak()` in `src/lib/streak.ts`.
  `calcStreak()` walks from `todayKey` backward day-by-day and
  stops at the first gap. There is no concept of "skip one
  gap".
- Bangkok timezone is already handled correctly via `APP_TZ =
  'Asia/Bangkok'` and `localDateKey()` in `src/lib/streak.ts`.
- `useLeaderboard` also computes streaks; whatever helper this
  feature changes must keep both code paths in sync. Identify
  the second call site via a single grep for `calcStreak` —
  do not open unrelated leaderboard logic until needed.
- No existing table tracks "freeze days used this month";
  monthly budget state has to be persisted somewhere so it
  survives across devices and across the
  midnight-Bangkok-tick logic in `useStreak`.

### Data model plan
Freeze state is **per user**, not per room, because a user has
one streak across the app. Two tables are needed:

1. `streak_freeze_budgets` (configuration row per user)
   - `user_id uuid primary key references auth.users(id) on
     delete cascade`
   - `monthly_budget smallint not null default 2` (the cap; we
     ship with **proposed default 2**)
   - `updated_at timestamptz not null default now()`

2. `streak_freeze_usages` (audit / ledger row each time a
   freeze is automatically spent)
   - `id uuid primary key default gen_random_uuid()`
   - `user_id uuid not null references auth.users(id) on
     delete cascade`
   - `frozen_date date not null` (the Bangkok-calendar date
     that was skipped)
   - `month_key text not null` (e.g. `'2026-05'`, derived
     server-side from `frozen_date` in `Asia/Bangkok`)
   - `created_at timestamptz not null default now()`
   - Unique on `(user_id, frozen_date)` so a date can only be
     frozen once even if multiple deposits land afterwards.

Critically: freeze usage rows **do not modify `savings_logs`**.
They live in their own table; the streak helper consults both
tables when computing.

### Supabase migration filename + intended changes
File: `supabase/migrations/0051_streak_freeze.sql`.

Intended changes:
- Create both tables above with the shapes described.
- Index on `streak_freeze_usages (user_id, month_key)` for the
  per-month count query.
- RLS:
  - `streak_freeze_budgets`: select / update where `user_id =
    auth.uid()`. Insert on first read happens via RPC, not
    direct client insert.
  - `streak_freeze_usages`: select where `user_id = auth.uid()`
    OR caller shares a room with the row owner (reuse the
    same helper pattern from `0012` so partner Leaderboard can
    show "frozen" indicator if we later want it — but we
    **don't expose the partner case in Sprint 1 UI**, RLS just
    leaves the door open).
  - No client insert / update / delete on
    `streak_freeze_usages` (writes go through the RPC below).
- Seed nothing. A user gets their `streak_freeze_budgets` row
  created lazily on first call to the RPC.

### RPC additions
- `public.consume_streak_freezes_if_needed(p_evaluation_date
  date) returns table(frozen_dates date[], remaining_in_month
  smallint)`
  - Security definer, safe `search_path`.
  - Validates `auth.uid()` is set.
  - Ensures a `streak_freeze_budgets` row exists for the user
    (insert default if missing).
  - Looks at the user's recent positive `savings_logs`,
    converts to Bangkok dates, finds the longest current
    chain back from `p_evaluation_date` allowing at most one
    gap day at a time, where each gap day must be:
    1. strictly between two save days,
    2. not already in `streak_freeze_usages`,
    3. within the same calendar month as `p_evaluation_date`,
    4. covered by remaining `monthly_budget -
       count_used_this_month` budget.
  - For every qualifying gap day, insert a row in
    `streak_freeze_usages` (`on conflict do nothing`).
  - Returns the (possibly empty) list of dates that were
    frozen and the remaining monthly budget.
  - This RPC is idempotent: re-calling it on the same date
    only inserts dates not already inserted.

The client calls this RPC once per app entry (and again right
after a successful deposit) before reading streak state.

### UI plan
- Reuse the existing streak surface (likely
  `src/components/StreakCard/StreakCard.tsx` — confirm
  presence; if absent, the plan from `plans/20` already
  proposed adding it, in which case piggyback on whatever
  shipped). Add a small "Freezes left this month: N" line
  beneath the current streak number.
- Add a one-line copy hint when a freeze was auto-spent the
  most recent time: "We covered yesterday for you." The hint
  disappears after the user logs that day.
- No new modal. No new screen. No emoji.
- All new states use existing tokens (`ink-muted` for the
  budget line, `accent-*` only if it matches the existing
  streak card palette).

### Hook changes
- Update `src/hooks/useStreak.ts`:
  - Add a second input source: `frozenDates: Set<string>`
    fetched from `streak_freeze_usages` for the current user.
  - Pass that set into a new helper
    `calcStreakWithFreezes(logs, todayKey, frozenDates)` in
    `src/lib/streak.ts`. Keep `calcStreak()` exported and
    unchanged for any caller that intentionally wants the
    raw chain (verify there is no other consumer relying on
    "raw" semantics; if there is, switch them to the new
    helper after a one-line check).
  - Returned shape extends to `{ streak, hasLoggedToday,
    freezesUsedThisMonth, freezesRemainingThisMonth,
    lastFreezeDate }`.
- New hook `src/hooks/useStreakFreeze.ts`:
  - On mount and on auth/user change, calls
    `consume_streak_freezes_if_needed(today)` once.
  - After each successful deposit (subscribe to the same
    `savings_logs` realtime channel `useLogs` uses, or expose
    a manual trigger), calls the RPC again.
  - Loads `streak_freeze_usages` for the current month so
    `useStreak` can display the budget line.
- Make sure `useLeaderboard` either uses the same
  `calcStreakWithFreezes` helper or explicitly opts out — do
  not let the dashboard streak and the leaderboard streak
  diverge.

### Edge function changes
None. (No nightly cron; the RPC runs on the client's next
app entry. A future scheduled job could pre-freeze for users
who haven't opened the app — explicitly out of scope.)

### Acceptance criteria
- [ ] A user with 10 consecutive save days who misses one day,
      then opens the app, sees their streak as 11 once they
      save again on the next day.
- [ ] The user sees "Freezes left this month: N" where N
      decreases each time a freeze is spent in that calendar
      month (Bangkok).
- [ ] When the monthly budget is exhausted, the next missed
      day breaks the streak exactly the way today's behaviour
      does.
- [ ] No `savings_logs` row is created, mutated, or
      back-dated by the freeze flow — verify by SQL spot-check
      `select count(*) from savings_logs where user_id = ...
      and created_at::date = <frozen date>` returns 0.
- [ ] A user who switches devices keeps the same streak
      because `streak_freeze_usages` is server-side.
- [ ] Two consecutive missed days never auto-freeze (cannot
      "stack" a 2-day gap into the streak with a single
      freeze).
- [ ] `streak_freeze_usages` is unique on
      `(user_id, frozen_date)` — verify duplicate-call
      idempotency by invoking the RPC twice for the same
      evaluation date and confirming only one row is added.
- [ ] Bangkok timezone is used for `frozen_date` and for the
      "calendar month" budget; specifically, a save at
      2026-05-31 23:30 Bangkok belongs to the May budget, not
      June.
- [ ] RLS denies reading another user's freeze rows from a
      direct client query (verify with the second account).
- [ ] Dashboard streak and Leaderboard streak agree for the
      same user.
- [ ] `npm run build` and `npm run lint` pass.

### Out of scope
- No manual "spend a freeze" button. Freezes are automatic
  only.
- No partner-visible "your partner used a freeze" surface.
- No purchasable / earnable freezes.
- No per-streak freeze (the budget is monthly, not per-streak
  length).
- No retroactive backfill of freezes for streaks that broke
  before this migration deployed.
- No reset to old `calcStreak` semantics behind a feature flag
  — the new helper replaces the old behaviour for end users
  (the raw function stays exported only for any tests).

### Verification notes
- *(empty)*

### Follow-up findings
- *(empty)*

---

## Follow-up findings (sprint-wide)

Use this section during implementation to record unrelated bugs
you noticed but explicitly did **not** fix in the active branch.
Each entry: short symptom, affected file path, and (optionally)
a guess at cause. Do not pre-populate.

- *(empty)*

---

## End-of-task report template

Use after each of the three features.

```
Task: SPRINT1-00X <name>
Status: done / blocked
Changed files:
- <file>

Checks:
- npm run build: passed / failed / not run
- npm run lint:  passed / failed / not run

Commit:
- <hash> <message>

Notes:
- <short note only if needed>

Next:
- Stopping. Awaiting explicit approval before starting the next
  SPRINT1 feature.
```
