# Task 22 - Saving Plan And Progress Insights

## 1. Scope And Guardrails

This is an implementation plan only. Do not implement code from this plan until the user confirms the scope.

Task 22 designs Saving Plan + Progress Insights for GO-OUT, a deployed mobile-first shared savings tracker for 2 people. Users manually log deposits into personal buckets. The app does not connect to banks and does not hold real money.

Do not use this task to implement:

- Transfers.
- Withdrawals.
- Attachments.
- Nudges.
- Partner approval workflows.
- Unrelated Plan 20 work.
- Negative `savings_logs`.
- Bucket allocation of Reconcile adjustments.

Task 21 Reconcile MVP is already implemented. Task 21.5 clarified the current semantics:

- Recorded Deposits = positive `savings_logs` assigned to buckets.
- Verified Balance = reconciled balance from Check Balance, including signed `balance_adjustments`.
- Bucket charts and deposit charts currently use Recorded Deposits.
- Reconcile is for confidence in real money, not for bucket allocation.

The central product rule for Task 22 is:

Money progress and saving discipline are separate.

Example card copy should be able to show both truths at the same time:

- Money status: Ahead by THB 500.
- Habit status: No deposit for 10 days.

Do not collapse these into one score.

## 2. Current Repo Observations

Relevant current behavior:

- `src/pages/Dashboard.tsx` shows `BalanceCheckStatus`, `DashboardHero`, deposit charts, bucket progress, partner buckets, recent activity, and `BalanceActivityFeed`.
- `src/pages/AddMoney.tsx` keeps deposits fast. It requires a bucket, inserts a positive `savings_logs` row through `useLogs.insert()`, and does not ask reconciliation questions.
- `src/pages/CheckBalance.tsx` shows Verified Balance, asks for Actual Balance, and creates a checkpoint plus adjustment when balances differ.
- `src/hooks/useLogs.ts` fetches recent room `savings_logs`, subscribes to realtime changes, and inserts optimistic positive deposits with `bucket_id`.
- `src/hooks/useLeaderboard.ts` labels `saved` as Recorded Deposits and calculates streaks from deposit logs.
- `src/hooks/useSavingsTotal.ts`, `bucketSaved()`, `dailyAmountSeries()`, `cumulativeAmountSeries()`, and `cumulativeRaceSeries()` all sum `savings_logs.amount`.
- `src/lib/streak.ts` already uses `Asia/Bangkok` through `APP_TZ` and can be reused for deposit streak insight.
- `src/hooks/useReconcile.ts` fetches the latest checkpoint, sanitized room activity, adjustment sum, and server-authoritative `current_reconciled_balance`.
- `src/lib/reconcile.ts` provides reason labels, signed currency formatting, and simple days-since helpers.
- `BalanceCheckStatus` already tells users that balance checks are separate from deposit charts.

Relevant schema and migration behavior:

- `0001_init.sql` created `goals` and positive-only `savings_logs`.
- `0004_buckets.sql` added personal buckets and `savings_logs.bucket_id`.
- `0006_fix_goals_pk.sql` changed goals to `(user_id, room_id)`.
- `0014_bucket_sum_check.sql` enforces that a user's bucket targets do not exceed that user's room goal.
- `0019_partner_buckets_visibility.sql` lets room co-members read each other's bucket plans, while writes stay owner-scoped.
- `0025_room_goal_sync_rpc.sql` and `0029_harden_room_goal_bucket_floor.sql` make the project goal shared and prevent lowering it below existing bucket targets.
- `0027_reconcile_checkpoints.sql` added `balance_checkpoints`, `balance_adjustments`, `checkpoint_storage_items`, `create_balance_checkpoint`, and sanitized balance activity.
- `0028_harden_current_reconciled_balance.sql` hardened `current_reconciled_balance(p_room_id)` so it returns only the authenticated caller's Verified Balance for a room.

These observations point to a safe Task 22 MVP: keep Saving Plan calculations aligned with Recorded Deposits first, and use Reconcile as a separate confidence signal.

## 3. Recommended MVP Scope

Recommended MVP:

- Per-user, per-room Saving Plan.
- One active plan per user per room.
- Partner can have a different plan.
- Plan progress uses the user's own Recorded Deposits across all of their buckets.
- Habit insight uses deposit behavior, not total money.
- Dashboard gets one compact insight card with separate Money status and Habit status.
- Plan setup starts simple, with advanced formulas hidden.
- Plan revisions are append-only and effective-dated.
- Pauses are supported in the calculation model, even if the first UI only exposes "Plan paused" after a simple pause control.

Defer from MVP:

- Bucket-level plans.
- Shared room-level plan that forces both partners onto the same rule.
- Scheduled deposit rows.
- Auto-generated `savings_logs`.
- Converting Reconcile differences into bucket deposits.

## 4. Core Concepts

### Planned Balance

Planned Balance is what the user's Saving Plan says they should have recorded by a given date.

It is calculated, not stored as transactions.

### Recorded Deposits

Recorded Deposits are the positive deposit logs in `savings_logs` assigned to buckets.

In Task 22 MVP, money status compares:

`Recorded Deposits - Planned Balance`

This keeps plan progress aligned with bucket progress, deposit charts, streaks, and current Dashboard semantics.

### Verified Balance

Verified Balance is the user's confidence loop from Check Balance:

`Recorded Deposits + signed balance_adjustments`

Verified Balance should remain visible as a separate concept. It should not be silently allocated into buckets or silently counted in Saving Plan progress.

### Habit Status

Habit status is based on deposit behavior:

- Last deposit date.
- Days since last deposit.
- Deposit streak where useful.
- Active / At risk / Stale / Plan paused.

Habit status does not use Verified Balance or plan ahead/behind amount.

## 5. Saving Plan Types

The plan engine should support these rule types. The first UI can expose a small set of presets and hide advanced fields.

### Fixed Daily Amount

Example: save THB 100 per day.

Daily planned amount:

`daily_amount(date) = amount`

Expected cumulative amount:

`sum(daily_amount for each active Bangkok date from effective_from_date through as_of_date)`

### Fixed Weekly Amount

Example: save THB 700 per week.

MVP calculation recommendation: smooth weekly plans into a daily planned curve for progress math:

`daily_amount(date) = weekly_amount / active_days_in_that_Bangkok_week`

Why:

- "Expected Today" remains meaningful every day.
- A large early weekly deposit can show "Covered until" without needing scheduled deposit rows.
- Weekly users are not forced into an accounting-like due-day model.

UI can still show "THB 700/week" and "This week target THB 700".

Future advanced option: strict weekly due day, such as due every Sunday. Defer unless users ask.

### Fixed Monthly Amount

Example: save THB 3,000 per month.

MVP calculation recommendation: smooth monthly plans into a daily planned curve:

`daily_amount(date) = monthly_amount / active_days_in_that_Bangkok_month`

UI can still show "THB 3,000/month" and "This month target THB 3,000".

Future advanced option: strict monthly due day. Defer unless users ask.

### Increasing Daily Amount

Example: day 1 = THB 1, day 2 = THB 2, day 3 = THB 3.

Rule fields:

- `start_amount`, default 1.
- `increment_amount`, default 1.

Daily planned amount:

`daily_amount(active_day_index) = start_amount + ((active_day_index - 1) * increment_amount)`

`active_day_index` counts non-paused Bangkok dates inside the current revision.

### Increasing Daily Amount With Cap

Example: day 1 = THB 1, day 2 = THB 2, cap at THB 180.

Rule fields:

- `start_amount`.
- `increment_amount`.
- `cap_amount`.

Daily planned amount:

`daily_amount(active_day_index) = min(start_amount + ((active_day_index - 1) * increment_amount), cap_amount)`

### Custom End Date Or Day Count

Examples:

- Continue until a custom end date.
- Continue until day 500.

Rule fields:

- `end_date`, nullable.
- `day_count`, nullable.

End behavior:

- If `end_date` is set, planned amount after that Bangkok date is 0.
- If `day_count` is set, planned amount after that many active days is 0.
- If both are set, use the earlier stop.
- If neither is set, default to the user's current room goal end date at the time the revision is created.

## 6. Planned Balance Calculations

All date calculations must use `Asia/Bangkok` local dates, matching the existing streak helper direction.

### Expected Today

`expected_today` is the daily planned amount for the current Bangkok date.

For fixed weekly/monthly plans, this is the smoothed daily portion of the weekly/monthly target. The UI can pair it with the period target:

- Expected Today: THB 100.
- This week: THB 700.

### Expected Cumulative Amount

`expected_cumulative(as_of_date)` is the sum of planned daily amounts over all active dates from the applicable plan revisions, excluding paused dates.

When multiple revisions exist:

- Use the old revision from its `effective_from_date` until the day before the next revision.
- Use the new revision starting on its `effective_from_date`.
- Never recalculate old dates with the newest rule.

### Expected Amount By Week Or Month

Group the same daily planned amounts by Bangkok week or Bangkok month.

For weekly display:

- `week_expected = sum(daily_amount for dates in that week)`
- `week_recorded = sum(savings_logs.amount for deposits in that week)`

For monthly display:

- `month_expected = sum(daily_amount for dates in that month)`
- `month_recorded = sum(savings_logs.amount for deposits in that month)`

This avoids a second definition of the plan curve.

### Remaining Amount

MVP remaining amount should use Recorded Deposits:

`remaining_amount = max(0, plan_target_amount - recorded_deposits_total)`

The plan target amount should be stored on each revision as a snapshot. If the shared room goal changes, create a new plan revision rather than rewriting the past.

### Ahead Or Behind

MVP money status:

`money_delta = recorded_deposits_total - expected_cumulative(today)`

Status:

- `ahead` if `money_delta > 0`.
- `on_track` if `money_delta = 0` after currency rounding.
- `behind` if `money_delta < 0`.

Copy:

- Ahead by THB 500.
- Behind by THB 320.
- On track.

Use the existing `formatCurrency()` style in UI.

### Projected Completion Date

Projected completion date should answer:

"If the user continues according to this plan from tomorrow, when will the plan target be reached?"

Calculation:

1. Start with current Recorded Deposits.
2. Add future planned daily amounts from tomorrow forward.
3. Return the first Bangkok date where projected total reaches `plan_target_amount`.
4. If current Recorded Deposits already meet the target, return today.
5. If no future date reaches target within the plan end or day count, return `null` and show "Needs plan change" or "No projected date yet."

Do not use scheduled deposit rows.

## 7. Credit-Forward Behavior

If a user saves more than expected, this is normal and should feel good.

Credit-forward rule:

`covered_until = latest future Bangkok date where expected_cumulative(date) <= recorded_deposits_total`

Also calculate:

`covered_days = number of active non-paused dates from today through covered_until`

Copy examples:

- Ahead by THB 500.
- Covered until May 28.
- Covered for 6 more saving days.

For increasing daily plans, coverage must use the future increasing amounts, not a flat average. THB 500 ahead covers fewer days later in an increasing plan than it does at the beginning.

Credit-forward must not change Habit status:

- A user can be ahead until May 28 and still have "No deposit for 10 days."
- A user can be behind and still have "Deposited today."

## 8. Habit And Discipline Insight

Habit insight uses deposit behavior only.

Inputs:

- `savings_logs.created_at`.
- `savings_logs.user_id`.
- Current plan cadence.
- Plan pause status.
- Bangkok date.

Core fields:

- `last_deposit_date`
- `days_since_last_deposit`
- `streak`
- `has_deposited_today`
- `habit_status`

Recommended status rules:

- `plan_paused`: active pause covers today.
- `no_deposits_yet`: no recorded deposits for this user in the room.
- `active`: days since last deposit is inside the expected cadence window.
- `at_risk`: user is just outside the expected cadence window.
- `stale`: user is beyond the cadence window and grace period.

Default cadence windows:

- Daily and increasing daily plans: active at 0 days, at risk at 1 day, stale at 2 or more days.
- Weekly plans: active at 0-6 days, at risk at 7-9 days, stale at 10 or more days.
- Monthly plans: active at 0-30 days, at risk at 31-37 days, stale at 38 or more days.

Use existing `calcStreak()` for daily consecutive-deposit streak where it makes sense. Do not use streak as the only habit signal, especially for weekly and monthly plans.

Tone rules:

- Do not shame the user.
- Do not block deposits.
- Do not turn stale habit into a warning gate.
- Prefer calm copy:
  - Last deposit: today.
  - Last deposit: 10 days ago.
  - Habit status: At risk.
  - Habit status: Plan paused.

## 9. Plan Revisions And Pauses

Changing a plan mid-way must not rewrite history.

### Revision Rules

Every plan change creates a new revision with `effective_from_date`.

Past dates use the old revision. Future dates use the new revision.

Examples of changes that create a revision:

- Fixed daily amount changes from THB 100 to THB 150.
- Fixed weekly amount changes from THB 700 to THB 1,000.
- Increasing daily cap changes from THB 180 to THB 200.
- End date changes.
- Day count changes.
- Plan target changes because the room goal changed.

Rules:

- Do not mutate older revision rows except for administrative repair.
- Do not backdate a revision before existing later revisions unless an explicit repair workflow exists.
- Default `effective_from_date` should be today in Bangkok.
- Future-dated revisions can be allowed later, but MVP can keep them hidden.

### Pauses

Pauses represent time when the plan is intentionally not accumulating expected savings.

Pause behavior:

- During a pause, planned daily amount is 0.
- Paused dates do not count toward `active_day_index` for increasing daily plans.
- Habit status should show `Plan paused`, while still showing Last deposit if useful.
- Deposits are still allowed during a pause.
- Reconcile still works during a pause.

Resume behavior:

- A pause with `end_date = null` is open-ended.
- Resuming sets `end_date` to the day before resume date or creates a closed pause range.

## 10. Reconcile Interaction

Planned Balance is separate from Verified Balance.

Task 22 MVP rule:

- Saving Plan money status uses Recorded Deposits.
- Reconcile Verified Balance remains a separate confidence signal.
- Reconcile adjustments are not allocated into buckets.
- Reconcile adjustments are not counted as Saving Plan progress unless a future feature explicitly resolves them into recorded deposits.

Trade-offs:

- Pro: Saving Plan matches bucket progress, deposit charts, leaderboard, and habit calculations.
- Pro: A total-level adjustment does not pretend to know which bucket should receive the money.
- Pro: Deposit flow remains unchanged and fast.
- Con: If Actual Balance is higher because the user forgot to log a deposit, Saving Plan may show behind while Verified Balance shows enough real money.
- Con: Users may need clear copy that "Verified Balance difference is not assigned to buckets."

Recommended UI copy when both concepts appear near each other:

- Saving Plan uses Recorded Deposits.
- Verified Balance includes Check Balance adjustments.
- Unallocated Check Balance differences are not included in bucket progress.

## 11. Reconcile Difference Resolution

This section decides what happens after Check Balance when Actual Balance differs from Recorded Deposits.

### Options Considered

Option 1: Keep the difference as total-level Verified Balance only.

- This is what Task 21 already supports.
- It creates a checkpoint and signed `balance_adjustments` row.
- It does not change `savings_logs`.
- It does not change bucket progress.
- It does not change Saving Plan progress.

Option 2: Convert the difference into a recorded deposit.

- This would make bucket charts and Saving Plan progress include the amount.
- It requires a bucket choice.
- It must avoid double-counting, because the difference may already exist as a positive `balance_adjustments` row.
- A safe version would need adjustment resolution fields such as `resolved_by_log_id`, `resolved_at`, or voiding support.

Option 3: Allocate the difference into one or more buckets.

- This gives the best bucket-level truth.
- It requires extra UI and validation.
- It can become a long accounting form inside Check Balance.
- It must avoid double-counting by resolving or voiding the total-level adjustment.

Option 4: Leave it unallocated with clear UI copy.

- This is similar to Option 1, with better product language.
- It makes the difference visible as confidence-only money.
- It avoids slowing Check Balance.

Option 5: Ask the user only when needed, not during every check.

- This is a future enhancement layered on top of Option 1/4.
- It should trigger only when the difference is likely to be a missing deposit or opening balance.

### MVP Decision

For Task 22 MVP, use Option 1 plus Option 4:

Keep Check Balance differences as total-level Verified Balance only, and leave them unallocated with clear UI copy.

Do not automatically convert a Reconcile difference into a `savings_logs` deposit.

Do not allocate a Reconcile difference into buckets.

Do not include Reconcile differences in Saving Plan calculations.

Clear copy:

- This updates Verified Balance only.
- Bucket progress still uses Recorded Deposits.
- Saving Plan still uses Recorded Deposits.

### Future Resolution Prompt

Add an optional future prompt only when needed:

- The latest unallocated adjustment is positive.
- Reason is `forgot_to_log` or `opening_balance`.
- The user's Saving Plan is behind by Recorded Deposits, but Verified Balance suggests they may have enough real money.

Suggested prompt:

"This balance difference is not assigned to a bucket. Record it as a deposit later if you want it to count in buckets and Saving Plan."

Do not ask during:

- Equal balance checks.
- Negative differences.
- Miscounted or spent/used reasons.
- Every dashboard visit.
- Every deposit.

Future conversion rules:

- If converting to one deposit, require a bucket and create a normal positive `savings_logs` row.
- If allocating to multiple buckets, create multiple normal positive `savings_logs` rows.
- In both cases, the old `balance_adjustments` row must be marked resolved or voided so Verified Balance does not double count the same money.
- This requires a future schema extension and is not part of Task 22 MVP.

## 12. UI And UX Plan

Keep the UI English, matching the current app.

Required labels:

- Saving Plan.
- Expected Today.
- Ahead.
- Behind.
- Covered until.
- Last deposit.
- Habit status.
- Plan paused.
- Change plan.

### Dashboard Insight Card

Place a compact Saving Plan card near the top of Dashboard, preferably after Check Balance status and before or near `DashboardHero`.

The card should have two visibly separate zones:

Money status:

- Expected Today.
- Expected so far.
- Recorded Deposits.
- Ahead / Behind / On track.
- Covered until, only when ahead.
- Remaining amount.

Habit status:

- Last deposit.
- Days since last deposit.
- Streak, if useful.
- Active / At risk / Stale / Plan paused.

Example:

Saving Plan

Money status: Ahead by THB 500

Expected Today: THB 100

Covered until: May 28

Habit status: No deposit for 10 days

CTA:

- Change plan.

Do not put long explanations in the card. Use short helper copy only when needed:

- Based on Recorded Deposits.
- Verified Balance stays separate.

### Plan Setup Flow

No long form first.

Recommended first screen:

- Title: Saving Plan.
- Short current goal summary.
- Preset choices:
  - Fixed daily.
  - Fixed weekly.
  - Fixed monthly.
  - Increasing daily.
  - Custom.

After choosing a preset, show only the fields needed:

- Amount.
- Start date, default today.
- End date or day count, default from room goal.

Hide advanced options behind a secondary control:

- Cap amount.
- Increment amount.
- Custom day count.
- Effective date.
- Pause / resume.

### Plan Edit Flow

Use `Change plan` rather than "edit old plan" language.

Copy:

- Changes start from today.
- Past progress will not be rewritten.

If the user changes the rule:

- Create a new revision.
- Show a small comparison:
  - Old plan until today.
  - New plan from today.

### Plan Status Near Charts

Charts currently show Recorded Deposits. Keep that.

Add small labels where useful:

- Recorded deposits only.
- Plan line, if added later, is expected progress.

Do not add a plan line to every chart in Phase 1 or 2. Start with the insight card.

## 13. Data Model Plan

Avoid overbuilding. Expected deposits are calculated, not inserted into `savings_logs`.

Recommended MVP tables:

### `public.saving_plans`

Purpose: one plan container per user per room.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `room_id uuid not null references public.rooms(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `timezone text not null default 'Asia/Bangkok'`
- `created_at timestamptz not null default now()`
- `archived_at timestamptz null`

Indexes and constraints:

- unique active plan per `(room_id, user_id)` where `archived_at is null`
- `(room_id, user_id)`

### `public.saving_plan_revisions`

Purpose: append-only effective-dated plan rules.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `plan_id uuid not null references public.saving_plans(id) on delete cascade`
- `room_id uuid not null references public.rooms(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `effective_from_date date not null`
- `rule_type text not null`
- `amount numeric(12,2) null`
- `start_amount numeric(12,2) null`
- `increment_amount numeric(12,2) null`
- `cap_amount numeric(12,2) null`
- `target_amount numeric(12,2) not null`
- `end_date date null`
- `day_count int null`
- `created_at timestamptz not null default now()`
- `created_by uuid not null references auth.users(id)`

Allowed `rule_type` values:

- `fixed_daily`
- `fixed_weekly`
- `fixed_monthly`
- `increasing_daily`
- `increasing_daily_capped`

Validation:

- fixed rules require `amount > 0`
- increasing rules require `start_amount > 0` and `increment_amount >= 0`
- capped rules require `cap_amount > 0`
- `target_amount > 0`
- `day_count is null or day_count > 0`

### `public.saving_plan_pauses`

Purpose: date ranges where expected planned amount is zero.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `plan_id uuid not null references public.saving_plans(id) on delete cascade`
- `room_id uuid not null references public.rooms(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `start_date date not null`
- `end_date date null`
- `reason text null`
- `created_at timestamptz not null default now()`
- `created_by uuid not null references auth.users(id)`

Validation:

- `end_date is null or end_date >= start_date`
- Only one open pause per plan.
- Overlapping pauses should be blocked by RPC or server-side validation.

### About `saving_plan_rules`

Do not create a separate `saving_plan_rules` table in MVP.

The rule lives on each `saving_plan_revisions` row. A separate rules table is useful later only if the product needs shared templates, reusable named formulas, or marketplace-style plan presets.

### Per User, Per Bucket, Or Per Room

MVP should be per user per room.

Reasons:

- Users can have different income rhythms and saving plans.
- Existing buckets are personal.
- Existing goal rows are per user per room, synchronized to a shared room target.
- Partner bucket writes remain owner-scoped.

Bucket-level plans are deferred.

Room-level shared plans are deferred.

### RLS Policies

Recommended read/write policy:

- Owner can select their full plan, revisions, and pauses.
- Room co-member can select non-private plan summary rows if the UI will show partner plan status.
- Owner can insert their own plan and revisions.
- Owner can pause/resume their own plan.
- No direct delete of revisions.
- No partner writes.

If partner-visible rows are needed, avoid private notes in the plan schema or expose partner summaries through a sanitized RPC.

### RPC And Helper Needs

Recommended RPCs:

- `create_saving_plan(p_room_id, rule fields...)`
- `create_saving_plan_revision(p_plan_id, effective_from_date, rule fields...)`
- `pause_saving_plan(p_plan_id, start_date)`
- `resume_saving_plan(p_plan_id, resume_date)`

RPC validation:

- Caller must be authenticated.
- Caller must be a member of the room.
- Caller can write only their own plan.
- Rule fields must match `rule_type`.
- New revision must not rewrite past revisions.
- Pause ranges must not overlap.

Client pure helpers:

- `plannedAmountForDate()`
- `plannedCumulativeThroughDate()`
- `plannedPeriodSummary()`
- `savingPlanMoneyStatus()`
- `coveredUntilDate()`
- `projectedCompletionDate()`
- `habitStatusFromDeposits()`

Do calculations in pure helpers first so they are easy to unit test.

## 14. Edge Cases

### User Saves THB 3,000 On Day 60 When Expected Is THB 1,830

For increasing daily THB 1, THB 2, THB 3:

- Expected through day 60 is THB 1,830.
- Recorded Deposits are THB 3,000.
- Money status: Ahead by THB 1,170.
- Covered until: day 76, because day 76 cumulative is THB 2,926 and day 77 cumulative is THB 3,003.
- Habit status depends only on last deposit date.

### User Saves THB 5,000 Early And Stops Depositing For 10 Days

Show both:

- Money status: Ahead, covered until the calculated date.
- Habit status: No deposit for 10 days, likely Stale for daily/weekly plans.

Do not show a single "good" or "bad" score.

### User Forgets Many Days And Deposits One Catch-Up Amount

The catch-up is one positive deposit log.

- Money status may move from Behind to On track or Ahead.
- Habit status becomes Last deposit: today.
- Daily streak should not be backfilled; it restarts from today unless there are actual consecutive deposit dates.

### User Changes Plan Mid-Way

Create a new revision effective today in Bangkok.

- Past expected amounts use the old revision.
- Future expected amounts use the new revision.
- Historical ahead/behind charts should not change for old dates except if deposits themselves changed.

### User Pauses Plan

During pause:

- Expected Today is THB 0.
- Expected cumulative does not increase.
- Covered-until calculations skip paused days.
- Habit status shows Plan paused.
- Deposits are still allowed.
- Reconcile still works.

### User Reconciles Balance Higher Than Recorded Deposits

Check Balance creates a positive adjustment.

Saving Plan remains based on Recorded Deposits.

UI should explain:

- Verified Balance includes the Check Balance difference.
- Saving Plan and buckets use Recorded Deposits.
- Difference is unallocated unless a future resolution feature converts it safely.

### User Reconciles Balance Lower Than Recorded Deposits

Check Balance creates a negative adjustment.

Saving Plan remains based on Recorded Deposits.

Do not create negative `savings_logs`.

Do not subtract from buckets unless a future bucket correction feature explicitly supports it.

### User Has No Deposits Yet

If plan has started:

- Recorded Deposits: THB 0.
- Expected so far: calculated from plan.
- Money status: Behind by expected amount.
- Habit status: No deposits yet.

If plan starts in the future:

- Expected so far: THB 0.
- Money status: Not started or On track.
- Habit status: No deposits yet.

### User Has Multiple Buckets

MVP sums all of the user's Recorded Deposits across all buckets in the room.

Bucket-level plan allocation is deferred.

Bucket rows and bucket charts continue to use each bucket's own `savings_logs`.

### Partner Has A Different Plan

This is allowed.

Each user has their own plan status. If partner status is shown, it should be read-only and visually separate from the viewer's own card.

Do not force both partners onto one Saving Plan in MVP.

### End Date Changes

Create a new revision with the new end date effective today.

Do not mutate old revisions.

If the room shared goal end date changes, the plan setup should prompt or automatically create a new plan revision for the owner, depending on implementation scope.

### Timezone Asia/Bangkok

All date keys for plan calculation, habit status, pauses, and coverage must use `Asia/Bangkok`.

Do not use UTC slicing for plan day boundaries.

## 15. Implementation Order

### Phase 1: Plan Data Model And Pure Calculation Helpers

- Add a new migration for `saving_plans`, `saving_plan_revisions`, and `saving_plan_pauses`.
- Add RLS and RPCs.
- Add shared TypeScript types.
- Add pure calculation helpers under `src/lib/`.
- Add focused tests for daily, weekly, monthly, increasing, cap, pause, revision, and Bangkok date behavior if the current test setup supports it.
- Do not wire UI yet except optional developer-only helper usage.

### Phase 2: Simple UI Status Card

- Add a Dashboard Saving Plan insight card.
- Show Money status and Habit status as separate sections.
- Use Recorded Deposits for money status.
- Show "Set up Saving Plan" if no plan exists.
- Keep charts unchanged.
- Keep deposit flow unchanged.
- Keep Check Balance unchanged.

### Phase 3: Plan Setup And Edit Flow

- Add a lightweight plan setup/edit route or full-screen flow.
- Start with presets, not a long form.
- Add Change plan.
- Create new revisions rather than editing old history.
- Add pause/resume if the data model is already in place and the UI remains simple.

### Phase 4: Charts And Insights Integration

- Add expected progress overlays only where they help.
- Keep labels clear:
  - Recorded Deposits.
  - Expected progress.
- Add week/month insight summaries.
- Add credit-forward copy such as Covered until.
- Keep Reconcile copy separate.

### Phase 5: Advanced Formulas And Revisions

- Expose cap, increment, day count, and custom end date in advanced options.
- Support future-dated revisions if needed.
- Add cadence-specific advanced settings only after user feedback.
- Consider optional Reconcile difference resolution only after adjustment resolving/voiding is designed.

## 16. Acceptance Criteria

Build and lint:

- `npm run build` passes after implementation.
- `npm run lint` passes when practical, or remaining lint findings are documented and unrelated.

Data behavior:

- No negative rows are inserted into `savings_logs`.
- Expected deposits are calculated, not inserted into `savings_logs`.
- Plan changes create revisions and do not rewrite history.
- Pauses stop expected accumulation without blocking deposits.
- Deposit flow remains unchanged and fast.
- Reconcile remains separate.

Money and habit behavior:

- Money status and Habit status are visibly separate.
- Money status uses Recorded Deposits in MVP.
- Habit status uses deposit behavior, not total money.
- A user who is ahead but has not deposited for 10 days sees both truths clearly.
- Credit-forward shows covered days/date when ahead.

Two-user manual test:

- User A creates a plan.
- User B creates a different plan.
- Each user can see their own status.
- Partner cannot edit the other user's plan.
- Deposits by User A update only User A's plan status.
- Deposits by User B update only User B's plan status.
- Check Balance differences remain in Verified Balance and do not alter Saving Plan progress.

Regression checks:

- `/add` still records positive bucket deposits.
- Dashboard bucket progress still uses Recorded Deposits.
- Deposit charts still use Recorded Deposits.
- Check Balance still creates checkpoints and adjustments as before.
- No transfer, withdrawal, attachment, nudge, or Plan 20 behavior is introduced.

## 17. Defer List

Explicitly defer:

- Transfers.
- Withdrawals.
- Partner approval.
- Auto-generated deposit logs.
- Bank sync.
- Bucket allocation of Reconcile adjustments.
- Converting Reconcile adjustments into deposits.
- Negative `savings_logs`.
- Bucket-level Saving Plans.
- Shared mandatory room-level plan.
- Scheduled deposit transactions.
- Punitive streak or shaming mechanics.

## 18. Open Product Decisions Before Implementation

Confirm before coding:

- Should the first UI expose only daily and increasing daily plans, with weekly/monthly in advanced, or expose all five from day one?
- Should partner be able to see the other user's Saving Plan status by default?
- Should plan target default to the shared room goal target at revision creation?
- Should pausing be part of the first shipped UI or only the first data model?
- Should weekly/monthly plans use the recommended smoothed daily curve, or strict due dates?

Recommended answer for MVP:

- Expose fixed daily, fixed weekly, fixed monthly, and increasing daily from day one.
- Keep cap, custom day count, and custom end date in advanced.
- Let partners see read-only status summary, but not edit.
- Default plan target from the user's current synchronized room goal.
- Include pause/resume only if it stays a one-tap status, otherwise defer UI but keep the model.
- Use smoothed weekly/monthly curves for MVP.

