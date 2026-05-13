# Task 20 - Alpha Test Follow-Up Implementation Plan

## Goal
Turn the alpha test findings into a structured implementation roadmap for the next app release.

This file is a plan only. Do not implement code from this plan until the user explicitly asks for implementation.

Target release version for the future implementation: `0.7.0`.

Current app version observed in `package.json`: `0.6.1`.

Primary product goals:
- Make bucket management complete: remove, rename, change target, transfer money, and withdraw mistaken deposits.
- Make shared project goals truly shared between both room members.
- Improve upload performance, profile image editing, attachment viewing, streaks, nudges, haptics, and graph readability.
- Consolidate scattered project settings into `Manage Project`.
- Add a release-update popup that keeps PWA users aware of new features and forces fresh app assets.

Project rules from `CLAUDE.md` that matter most:
- Keep changes scoped to the requested features.
- Follow the existing React, TypeScript, Vite, Tailwind, Supabase, and PWA stack.
- Do not install libraries without asking first.
- Add new Supabase migrations instead of editing old migrations.
- Keep data access in existing hooks or focused new hooks.
- Reuse existing components and design tokens before inventing new UI patterns.
- Avoid `any`; type shared shapes in `src/types/index.ts`.
- No emoji in this plan or in the planned feature-update popup content. Use existing icon components or SVG assets if visual symbols are needed.

## Current Findings From Code Review

Existing pieces that should be extended:
- Buckets already exist in `public.buckets`, `useBuckets`, `BucketGrid`, `BucketRowExpandable`, and Profile's bucket modal.
- `useBuckets.saveBuckets()` supports inserts and updates, but the UI only creates buckets and does not expose rename, target edit, or delete.
- Bucket deletion is already blocked when logs exist. Future remove UI must add a confirmation step before calling the existing deletion path.
- Deposits are append-only through `useLogs.insert()`. There is no transaction type for withdraw or transfer.
- Project goal editing lives in `src/pages/ManageProject.tsx`, but `useGoal.save()` updates only the current user's `goals` row.
- Dashboard player progress uses `useLeaderboard()`, which fetches each member's personal goal row. This explains the creator goal update desync.
- `NudgeButton`, `usePushSubscription`, `supabase/functions/send-nudge`, and migration `0022_push_subscriptions.sql` already exist, but the flow needs product hardening and deployment verification.
- `useStreak()` and `calcStreak()` exist, and `useLeaderboard()` computes streaks, but the streak is not surfaced as a useful user-facing loop.
- `AvatarUpload` uploads the original file directly to Supabase Storage. There is no crop UI or resize/compress step.
- `SlipAttachField` accepts an image file, but `AddMoney` currently saves a placeholder `attached:file-name` marker instead of uploading a viewable image URL.
- `ActivityFeed` can open a slip modal, but `ActivityHistoryModal` does not pass slip open handlers, and partners cannot view placeholder-only attachments.
- `MomentumChart`, `SavingRaceChart`, and `ComparisonTrendChart` have no visible y-axis labels.
- Daily Savings Trend is fixed to the latest seven days and has no CTA to review past weeks.
- Daily Savings Trend weekday labels can drift from the real Bangkok calendar date. Example bug report: on Wednesday, May 13, 2026, the chart showed `T` as if the current day were Tuesday.
- PWA is configured with `registerType: 'autoUpdate'`, `registerSW({ immediate: true })`, `self.skipWaiting()`, and `clientsClaim()`, but there is no release popup or explicit app-refresh UX.

## Workstream 1 - Bucket Management Completion

### User Stories
- As a user, I can delete a bucket I no longer need.
- As a user, I must confirm every bucket delete action before it happens.
- As a user, I can rename a bucket without losing its deposit history.
- As a user, I can change a bucket target amount.
- As a user, I can move money from one bucket to another after choosing the wrong bucket.
- As a user, I can withdraw money from a bucket when I entered the wrong amount.

### Data Model Plan
Use the existing `savings_logs` table as the source of truth, but make deposit correction explicit.

Add migration `supabase/migrations/0025_log_adjustments.sql`:
- Keep existing positive deposit rows unchanged.
- Allow negative `amount` values in `savings_logs` for withdrawals and transfer-out rows, if current constraints allow it. If a positive-only check exists, replace it with a bounded non-zero check.
- Add optional columns:
  - `kind text not null default 'deposit'`
  - `related_log_id uuid null references public.savings_logs(id) on delete set null`
  - `transfer_group_id uuid null`
  - `created_by uuid null references auth.users(id) on delete set null`
- Add check constraint for `kind in ('deposit', 'withdrawal', 'transfer_out', 'transfer_in', 'adjustment')`.
- Add index on `(room_id, user_id, bucket_id, created_at desc)`.
- Add index on `transfer_group_id`.
- Update insert RLS so users can insert adjustment rows only for their own user id and buckets they own.

Preferred transfer representation:
- Transfer creates two rows in one RPC:
  - `transfer_out`: negative amount from source bucket.
  - `transfer_in`: positive amount into destination bucket.
- Both rows share the same `transfer_group_id`.
- Both rows keep the same `user_id` and `room_id`.
- The UI should display this as one transfer event where practical.

Preferred withdrawal representation:
- Withdrawal creates one `withdrawal` row with a negative amount.
- The bucket saved amount becomes deposits plus transfer-ins minus withdrawals and transfer-outs.
- Do not delete or mutate original deposit rows for audit clarity.

Add security-definer RPCs:
- `public.transfer_bucket_amount(p_from_bucket_id uuid, p_to_bucket_id uuid, p_amount numeric, p_note text default null)`
- `public.withdraw_bucket_amount(p_bucket_id uuid, p_amount numeric, p_note text default null)`

RPC validation:
- Caller must own both buckets.
- Buckets must be in the same room.
- Amount must be greater than 0.
- Source bucket available saved amount must be enough for transfer or withdrawal.
- Insert rows atomically.

### UI Plan
Create `src/components/BucketManager/BucketManager.tsx` or extend a focused project-management component under `src/components/`.

Bucket manager should support:
- Inline bucket name editing.
- Inline bucket target editing.
- Delete button per bucket using `IconTrash` or SVG icon, not text-only if an icon exists.
- Delete confirmation through existing `ConfirmModal`.
- Block deletion when bucket has logs, unless future implementation adds log reassignment.
- Show saved amount, target amount, and remaining amount for each bucket.
- Show validation when total bucket targets exceed the user's goal.

Create correction actions:
- `Transfer Money` modal:
  - Source bucket select.
  - Destination bucket select.
  - Amount input.
  - Optional note.
  - Confirmation copy showing source and destination.
- `Withdraw Money` modal:
  - Bucket select.
  - Amount input.
  - Optional note.
  - Confirmation copy explaining it records a correction, not a cash payout.

Update existing screens:
- `src/pages/ManageProject.tsx`: host the full bucket manager after consolidation.
- `src/pages/Profile.tsx`: remove the standalone Manage Buckets item after consolidation.
- `src/pages/Dashboard.tsx`: keep quick deposit bucket expansion, but show transfer/withdraw only in Manage Project to avoid crowding Dashboard.
- `src/lib/buckets.ts`: ensure `bucketSaved()` handles negative rows correctly. Current sum already works if negative amounts are allowed.
- `src/hooks/useBuckets.ts`: add update/delete support if the UI needs more granular operations, or keep `saveBuckets()` for batch edits.
- `src/hooks/useLogs.ts`: add typed helper methods for transfer and withdrawal, likely backed by RPC calls.

### Acceptance Criteria
- Bucket delete button exists in the bucket manager.
- Every bucket delete attempt opens a confirmation modal.
- Deleting a bucket with existing logs is blocked with a clear message.
- Renaming a bucket updates the same bucket id and keeps all old logs attached.
- Changing a bucket target updates progress everywhere.
- Transfer moves money between buckets without changing total saved for the user.
- Withdrawal reduces the selected bucket and the user's total saved.
- Transfer and withdrawal appear in activity history with understandable labels.
- RLS blocks transferring from or withdrawing from a partner's bucket.

## Workstream 2 - Shared Room Goal Sync

### Problem
The room goal currently behaves like a personal goal row. When the creator updates the goal in Manage Project, only the creator's `goals` row updates. The partner keeps the old target, so Dashboard progress bars and comparisons can disagree.

### Implementation Plan
Prefer the smallest schema-compatible fix first: keep `goals` per member, but update all room member goal rows when the room global goal changes.

Add migration `supabase/migrations/0026_room_goal_sync_rpc.sql`:
- Add RPC `public.update_room_goal(p_room_id uuid, p_target_amount numeric, p_end_date date)`.
- RPC validation:
  - Caller must be a member of the room.
  - Prefer creator-only writes for now because Manage Project currently treats creator as admin.
  - Target amount must be greater than 0.
  - End date must be present.
- RPC behavior:
  - Update `rooms.end_date`.
  - Upsert one `goals` row for every current `room_members.user_id` in that room.
  - Set the same `target_amount`, `end_date`, and `updated_at` for all members.
  - Preserve each member's `start_date` when it exists; use current date for missing rows.

Update code:
- `src/hooks/useGoal.ts`: add `saveRoomGoal()` or update existing save contract only where appropriate.
- `src/pages/ManageProject.tsx`: call the room-level RPC instead of `updateRoom()` plus personal `saveGoal()`.
- `src/hooks/useLeaderboard.ts`: after goal updates, refetch goals for all room members or subscribe to goal changes.
- `src/components/DashboardHero/DashboardHero.tsx`: continue receiving normalized targets from parent.

### Acceptance Criteria
- Creator changes project target once.
- Creator dashboard and partner dashboard both show the new target.
- Head-to-head rows use the same target for both users after the update.
- Total vault target updates consistently.
- Joining a room after the update bootstraps the latest target.
- No user can accidentally keep a stale target after refresh.

## Workstream 3 - Manage Project Consolidation

### Goal
Merge `Quick Amounts` and `Manage Buckets` into `Manage Project`, so Profile becomes lighter and project-level settings live together.

### UI Structure
Update `src/pages/ManageProject.tsx` into sections:
- Project Basics:
  - Invite code.
  - Project name if rename is desired in the same release.
  - End date.
  - Global target amount.
- Saving Controls:
  - Quick Amounts editor.
  - Bucket manager with rename, target edit, delete, transfer, and withdraw.
- Room Actions:
  - Create another project.
  - Leave Project.
  - Archive Project, creator only if still needed.

Update `src/pages/Profile.tsx`:
- Remove separate `Manage Buckets` and `Quick Amounts` settings rows.
- Keep `Edit Profile`.
- Keep `Manage Project`.
- Add `Leave Project` CTA close to `Sign Out`, as requested.
- Keep `Sign Out` as the final account-level action.

Potential component extraction:
- Move quick amount editor from Profile modal into `src/components/QuickAmountsEditor/QuickAmountsEditor.tsx`.
- Move bucket management into `src/components/BucketManager/BucketManager.tsx`.
- Keep page-level save wiring in `ManageProject.tsx`.

### Acceptance Criteria
- Users can still edit quick amounts.
- Users can still create and manage buckets.
- Profile no longer shows separate Quick Amounts and Manage Buckets entries.
- Manage Project is the single place for project saving settings.
- Profile has a Leave Project CTA visually close to Sign Out.

## Workstream 4 - Leave Room CTA And Server Rules

### Problem
`useRooms.leaveRoom()` already lets a joiner leave from Manage Project, but the requested CTA belongs on Profile near Sign Out and the creator case needs safe behavior.

### Data And RPC Plan
Add migration `supabase/migrations/0027_leave_room_rpc.sql`:
- Add RPC `public.leave_room(p_room_id uuid)`.
- RPC behavior:
  - If caller is not a room member, reject.
  - If caller is not the creator, delete only caller's `room_members` row.
  - If caller is the creator and another member exists, transfer `rooms.created_by` to the oldest remaining member, then delete caller's membership.
  - If caller is the creator and no other member exists, archive the room and delete caller's membership or return a clear "archive instead" status. Choose the final behavior before implementation.
- Return a typed status such as `left`, `transferred_owner`, or `archived_and_left`.

Update code:
- `src/hooks/useRooms.ts`: change `leaveRoom()` to call the RPC.
- `src/pages/Profile.tsx`: add Leave Project item above Sign Out with `ConfirmModal`.
- `src/pages/ManageProject.tsx`: reuse the same hook behavior.

### Acceptance Criteria
- Leave Project appears on Profile near Sign Out.
- User must confirm before leaving.
- Joiner can leave and no longer sees the room.
- Creator leaving does not leave an active room with no valid owner.
- Partner keeps access when ownership transfers.

## Workstream 5 - Attachments And Profile Image Optimization

### Profile Image Resize
Add a client-side image utility without new dependencies:
- File: `src/lib/images.ts`.
- Function: `resizeImageFile(file, options)`.
- Use `createImageBitmap` or `HTMLImageElement` plus `canvas`.
- Strip metadata by drawing to canvas.
- Output WebP or JPEG, depending on browser support and transparency needs.
- Avatar target:
  - Square output after crop.
  - 512 x 512 max.
  - Quality around 0.82.
  - Hard cap around 300 KB if possible.

Update:
- `src/components/AvatarUpload/AvatarUpload.tsx`: open crop modal after file selection.
- New `src/components/ImageCropModal/ImageCropModal.tsx`: simple square crop using image preview, drag/zoom controls, and canvas export.
- `src/hooks/useProfile.ts`: upload the processed file, not the original.
- `src/components/Avatar/Avatar.tsx`: add width and height attributes or stable class dimensions are already present; keep object-cover.

No new crop library unless the user approves. Implement simple crop with pointer events and canvas.

### Slip Or File Attachment Resize And Upload
Add Supabase Storage support for deposit attachments:
- Confirm or create storage bucket `slips`.
- Add migration or storage policy instructions for room co-member read access.
- Prefer private bucket plus signed URLs if public slips are too sensitive.
- Store final URL or storage path in `savings_logs.slip_url`.

Update:
- `src/components/SlipAttachField/SlipAttachField.tsx`: preview selected image and show optimized file size.
- `src/pages/AddMoney.tsx`: before inserting log, resize image and upload it.
- `src/hooks/useLogs.ts`: keep `slip_url` as a real viewable URL or storage path.
- `src/components/ActivityFeed/ActivityFeed.tsx`: continue opening image modal.
- `src/components/ActivityHistoryModal/ActivityHistoryModal.tsx`: add the same attachment modal behavior.
- `src/components/ActivityTimelineRow/ActivityTimelineRow.tsx`: make the slip chip tappable for all rows with a viewable attachment.

If non-image files are allowed later:
- Do not resize unsupported file types.
- Enforce size cap and allowed MIME types.
- Show file type icon using SVG or existing icon components.

### Acceptance Criteria
- Avatar upload crops to square before upload.
- Avatar upload stores a resized file, not the original large photo.
- Slip image upload stores a resized file, not only `attached:file-name`.
- Any user in the room can tap an attached image and view it.
- Activity feed and activity history both support attachment viewing.
- Large images do not make the app noticeably slow on mobile.

## Workstream 6 - Dashboard Charts And Competition Filter

### Merge Daily Saving Trend And Saving Race
Create a chart carousel section:
- New component: `src/components/SavingsChartsCarousel/SavingsChartsCarousel.tsx`.
- Use native horizontal scroll with CSS scroll snap.
- Default slide 1: Daily Savings Trend.
- Slide 2: Saving Race.
- User can swipe from right to left to see the next graph.
- Include compact pagination dots or segmented labels using existing design style.
- Do not use a new carousel library.

Update:
- `src/components/DashboardHero/DashboardHero.tsx`: remove direct `MomentumChart` rendering or pass it into carousel.
- `src/pages/Dashboard.tsx`: render the combined section once, where the current momentum and competition sections belong.

### Daily Trend Week History And Date Axis Fix
Current bug reports:
- The Daily Savings Trend must show the current calendar week by default, not an unlabelled rolling seven-day window.
- Users need a CTA button to view past weeks that have already passed.
- The x-axis weekday label does not always match the real date.
- The x-axis must use full weekday names such as `Monday`, `Tuesday`, and `Sunday` instead of single-letter labels like `M`, `T`, and `S`.
- Full weekday labels must still fit cleanly in the mobile UI.

Implementation plan:
- Replace `lastSevenDayLabels()` usage for Daily Savings Trend with a week-aware helper.
- Add helper functions in `src/lib/dashboardStats.ts`:
  - `weekDateKeys(weekOffset: number, today?: Date, timezone?: string): string[]`
  - `weekDayLabels(dateKeys: string[], format?: 'long' | 'short'): string[]`
  - `dailyAmountSeriesForWeek(logs, userId, weekOffset, today, timezone)`
- Use `Asia/Bangkok` consistently when calculating the week and matching log dates.
- Define the current week as Monday through Sunday unless the product explicitly chooses another week start.
- Use `weekOffset = 0` for the current week, `-1` for last week, `-2` for two weeks ago, and so on.
- Add local state in the chart carousel or Dashboard parent for `trendWeekOffset`.
- Add CTA controls:
  - `Previous Week` moves to older weeks.
  - `Next Week` moves toward the current week and is disabled when already on the current week.
  - `This Week` appears when viewing a past week and returns to `weekOffset = 0`.
- Show a compact week range label, for example `May 11 - May 17`, above the chart.
- For mobile label fitting, keep full weekday names but render them in a stable layout:
  - Use a slightly taller x-axis label area.
  - Allow weekday labels to wrap to two lines if needed.
  - Prefer horizontal scroll inside the chart slide over shrinking text too aggressively.
  - Verify on 360 px width that labels do not overlap bars, y-axis labels, or adjacent days.
- Keep `SavingRaceChart` independent from week navigation unless the final implementation intentionally shares the selected week.

Files likely touched:
- `src/lib/dashboardStats.ts`
- `src/components/MomentumChart/MomentumChart.tsx`
- `src/components/SavingsChartsCarousel/SavingsChartsCarousel.tsx`
- `src/components/DashboardHero/DashboardHero.tsx`
- `src/pages/Dashboard.tsx`

### Competition Filter Redesign
Current issue: the filter shows bucket options in a way that feels like separated bucket types. Desired behavior: always compare both users on the same chart and let the user manually choose what bucket comparison they want.

Replace `SavingRaceFilter` with a comparison picker:
- New component: `src/components/ComparisonBucketPicker/ComparisonBucketPicker.tsx`.
- Always render both lines in `SavingRaceChart`.
- Provide:
  - Your bucket select.
  - Partner bucket select.
  - All buckets option for each select.
- Persist selected bucket ids per room using `useLocalStorageState`.
- If a selected bucket disappears, reset that side to all buckets.
- Scope label should clearly state both selected scopes.

Update chart series:
- Change `cumulativeRaceSeries(logs, userId, bucketId)` to support separate bucket ids for each user at the call site.
- Do not dedupe both users' buckets into one combined list.
- Keep the chart valid if partner has no buckets.

### Add Y-Axis To Every Graph
Update SVG chart components:
- `src/components/MomentumChart/MomentumChart.tsx`
- `src/components/SavingRaceChart/SavingRaceChart.tsx`
- `src/components/ComparisonTrendChart/ComparisonTrendChart.tsx`

Y-axis requirements:
- Show 0 at the bottom and max value at the top.
- Prefer a middle tick for readability.
- Format values with `formatCurrency()` or compact currency, depending on available width.
- Increase left padding so labels do not overlap chart marks.
- Keep x-axis labels readable on 360 px mobile width.
- Include `aria-label` or `aria-describedby` text with the max value.

### Acceptance Criteria
- Dashboard shows one combined chart section instead of separate Daily Savings Trend and Saving Race sections.
- First visible chart is Daily Savings Trend.
- Swiping right-to-left reveals Saving Race.
- Daily Savings Trend defaults to the current Bangkok calendar week.
- Daily Savings Trend has CTA controls to view previous weeks and return to the current week.
- On Wednesday, May 13, 2026 in Bangkok time, the current week's Wednesday data appears under `Wednesday`, not `Tuesday`.
- Daily Savings Trend x-axis uses full weekday names: `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, and `Sunday`.
- Full weekday labels fit on mobile without overlapping chart marks or each other.
- Saving Race always compares both users' lines.
- User can manually choose bucket scope for self and partner.
- Every SVG graph has readable y-axis labels.
- No chart labels overlap on mobile.

## Workstream 7 - Streak System Usability

### Current State
Streak calculation exists, but it is not user-facing enough to be useful.

### Product Behavior
Streak definition:
- Count consecutive Bangkok calendar days with at least one deposit by the current user.
- If the user has saved today, the streak includes today.
- If the user has not saved today but saved yesterday, show the streak as active but at risk.
- If the user missed both today and yesterday, streak is 0.

UI plan:
- Add a small streak status to Dashboard, likely near Total Vault or the chart carousel.
- Add streak copy to Add Money success toast.
- Show next action text:
  - "Saved today" when protected.
  - "Save today to keep your streak" when at risk.
  - "Start a streak today" at 0.
- Use icons from the existing icon system or SVG assets. Do not use emoji.

Code plan:
- Reuse `useStreak(user?.id, logs)`.
- Consider moving shared streak display logic to `src/lib/streak.ts`.
- Add component `src/components/StreakCard/StreakCard.tsx`.
- Replace direct `navigator.vibrate()` usage in `BucketRow` with `haptic('milestone')`.

Acceptance criteria:
- User sees their current streak.
- Streak updates immediately after successful deposit.
- Streak resets correctly by Bangkok date.
- No timezone mismatch between `useStreak()` and leaderboard streaks.

## Workstream 8 - Nudge Feature Completion

### Current State
Nudge infrastructure exists but needs end-to-end readiness.

Implementation checks:
- Verify migration `0022_push_subscriptions.sql` has run.
- Verify Supabase function `send-nudge` is deployed.
- Verify secrets:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`
- Verify client env:
  - `VITE_VAPID_PUBLIC_KEY`
- Verify `docs/vapid-runbook.md` is still accurate.

Code fixes likely needed:
- `src/sw.ts` currently references `/pwa-192x192.png`, but public assets include `/icon-192.png`. Update notification icon and badge paths during implementation.
- Add clearer permission states in `NudgeButton`.
- Add cooldown display when the edge function returns HTTP 429.
- Add a small settings row in Manage Project or Profile to enable notifications proactively.
- On successful nudge, show toaster feedback.

Acceptance criteria:
- User can enable notifications from the app.
- User can nudge partner from Dashboard.
- Partner receives a push notification on an enrolled device.
- Tapping notification opens or focuses Dashboard.
- If partner has not enabled nudges, sender sees a clear message.
- Nudge cannot be spammed faster than the configured throttle.

## Workstream 9 - Stronger Haptics

### Goal
Make haptic feedback significantly more noticeable while keeping unsupported browsers safe.

Update `src/lib/haptics.ts`:
- Expand intents:
  - `selection`
  - `success`
  - `milestone`
  - `warning`
  - `error`
- Stronger proposed patterns:
  - selection: 20
  - success: [35, 30, 35]
  - milestone: [45, 45, 70, 45, 90]
  - warning: [55, 40, 55]
  - error: [80, 50, 80]
- Keep feature detection and try/catch.

Update call sites:
- Deposit success: `success`.
- Bucket goal reached: `milestone`.
- Streak milestone: `milestone`.
- Delete/leave confirmation: `warning`.
- Failed save or validation error: `error`, if appropriate.
- Bucket picker or chart slide change: `selection`, if it feels helpful.

Acceptance criteria:
- Android devices with vibration support feel a clear difference.
- iOS and unsupported browsers do not error.
- Haptics are not triggered on page load, only user actions.

## Workstream 10 - Encouragement Toasts

### Goal
Show an encouraging toaster message when money is successfully added to a bucket.

Implementation plan:
- Add `src/components/Toast/Toast.tsx` and possibly `src/components/Toast/ToastHost.tsx`.
- Keep implementation small and local if a global provider is not necessary.
- Use existing colors, shadows, fonts, and motion tokens.
- No emoji in toast messages.

Example message pool:
- "Nice save. Your bucket is closer now."
- "Deposit added. Keep the streak alive."
- "Good move. That bucket just got lighter."
- "Saved successfully. Your plan is moving."
- "Bucket updated. One step closer."

Trigger locations:
- `src/pages/AddMoney.tsx` after `insert()` succeeds.
- `BucketRowExpandable` deposit success path on Dashboard.
- Transfer and withdrawal success can use calmer messages, because those are corrections.

Acceptance criteria:
- Successful deposit shows a toast.
- Toast auto-dismisses after a short delay.
- Toast does not block the existing success modal unless both are intentionally kept.
- No emoji appears in toast content.

## Workstream 11 - Release Popup, Versioning, And PWA Freshness

### Version Update
During implementation, update:
- `package.json` version from `0.6.1` to `0.7.0`.
- `package-lock.json` version fields through `npm install --package-lock-only` or equivalent safe package-lock update.
- Keep `src/lib/version.ts` as the source used by UI through Vite define injection.

### Feature Update Popup
Add a release popup on app entry:
- New data file: `src/lib/releaseNotes.ts`.
- New component: `src/components/ReleaseUpdateModal/ReleaseUpdateModal.tsx`.
- Render inside `AppShell` or protected layout so authenticated users see it after entering the app.
- The popup content must be updated every time a feature from this plan is finished.
- Content must not use emoji.
- If an icon is needed, use existing icon components or SVG assets.

Required behavior:
- Show popup when `localStorage.releaseUnderstoodVersion !== appVersion()`.
- The `X` close button dismisses only for the current app session.
- Because `X` is not permanent, the popup shows again on future app entries until the user taps `Understand`.
- The `Understand` button stores the current version in localStorage and stops showing the popup for that version.
- When app version changes, show the popup again.

Suggested release notes for `0.7.0`:
- Bucket rename, target edit, remove confirmation, transfer, and withdrawal.
- Shared room goal sync for both partners.
- Cropped and resized profile images.
- Resized deposit attachments with room-wide viewing.
- Combined savings charts with manual bucket comparison.
- Current-week Daily Savings Trend with previous-week navigation and corrected weekday labels.
- Usable streak status.
- Partner nudges.
- Stronger haptics.
- Deposit encouragement toasts.
- Profile Leave Project CTA.

### PWA Freshness
Current PWA is close to auto-update, but add explicit update handling:
- Update `src/main.tsx` to use `registerSW` callbacks:
  - `onNeedRefresh`
  - `onOfflineReady`
  - `onRegisteredSW`
- When a new service worker is ready, call the update function and reload once safe.
- Keep `self.skipWaiting()` and `clientsClaim()` in `src/sw.ts`.
- Add a version freshness check if needed:
  - Store loaded `appVersion()`.
  - If the app detects a newer version after SW update, reload the page.
- Make sure release popup appears after reload for the new version.

Acceptance criteria:
- New deploy updates PWA users without requiring manual cache clearing.
- Release popup appears for the new version.
- X close is temporary only.
- Understand is persistent per version.
- Version chip shows `v0.7.0` in production.

## Workstream 12 - Testing And Verification Plan

### Automated Checks
Run after implementation:
- `npm run build`
- `npm run lint`

Add focused tests only if a test setup exists or is added with user approval. Do not add a new test framework without asking.

### Manual Smoke Tests
Use two accounts in the same room.

Bucket tests:
- Create a bucket.
- Rename the bucket.
- Change target.
- Delete empty bucket with confirmation.
- Attempt to delete bucket with logs and confirm it is blocked.
- Transfer money from one bucket to another.
- Withdraw money from a bucket.
- Confirm totals and activity history.

Goal sync tests:
- Creator changes room target.
- Creator dashboard updates.
- Partner dashboard updates after realtime event or refresh.
- Head-to-head uses the same target for both.

Attachment tests:
- Upload large avatar and confirm stored file is resized.
- Crop avatar and confirm circular display looks right.
- Upload slip image.
- Partner taps slip in Activity Feed and Activity History.

Chart tests:
- Daily chart first slide visible.
- Daily chart defaults to the current Bangkok calendar week.
- Previous Week CTA shows the prior week.
- Next Week CTA moves toward the current week and disables at the current week.
- This Week CTA returns from a past week to the current week.
- Full weekday labels match the real dates, including Wednesday, May 13, 2026 mapping to `Wednesday`.
- Full weekday labels fit on mobile without overlap.
- Swipe to Saving Race.
- Manual self and partner bucket selectors work.
- Y-axis labels visible on 360 px mobile and desktop width.

PWA tests:
- Install PWA.
- Deploy version bump.
- Open existing installed PWA.
- Confirm forced refresh or update path.
- Confirm release popup appears.
- Confirm X only dismisses temporarily.
- Confirm Understand persists for that version.

Nudge tests:
- Enable notifications on both users where browser supports it.
- User A nudges User B.
- User B receives notification.
- Tap notification and land on Dashboard.
- Confirm throttle message.

Leave room tests:
- Joiner leaves from Profile.
- Creator remains.
- Creator leaves with partner present and ownership transfers, if that behavior is selected.
- Solo creator leave behavior matches final product decision.

## Suggested Implementation Order

1. Version and release popup foundation.
2. PWA update handling, so future changes reach testers reliably.
3. Shared room goal sync, because it affects dashboard trust.
4. Manage Project consolidation.
5. Bucket rename, target edit, delete confirmation.
6. Bucket transfer and withdrawal RPCs.
7. Attachment upload, resize, and room-wide viewing.
8. Avatar resize and crop.
9. Combined chart carousel, Daily Savings Trend week navigation, corrected weekday labels, and manual comparison filter.
10. Y-axis labels on all charts.
11. Streak UI.
12. Nudge hardening.
13. Stronger haptics.
14. Encouragement toasts.
15. Profile Leave Project CTA and final room-leave RPC behavior.

Reason for this order:
- Release popup and PWA freshness should land early because every later feature must be announced there.
- Goal sync and bucket management fix the most confusing money-state issues first.
- Attachments and charts are user-facing polish but depend less on core money correctness.
- Haptics and toasts should be added after the core flows are stable so they can attach to final success and error paths.

## Open Product Decisions Before Implementation

- Should a creator be allowed to leave a room by transferring ownership to the partner, or should creators only archive projects?
- Should withdrawals reduce the user's total saved, or only correct a bucket while keeping a separate lifetime saved metric?
- Should transfer and withdrawal actions appear in the same activity feed as deposits, or in a separate correction history?
- Should deposit attachments be public URLs or private storage paths with signed URLs?
- Should profile avatar crop be fixed square only, or allow zoom plus rotate?
- Should quick amounts be per user globally, or per project?
- Should bucket target totals be allowed under the global goal, or must they exactly match the global goal before saving?

## Definition Of Done For The Future Release

- App version is updated to `0.7.0`.
- Release popup includes every completed feature from this plan.
- Installed PWA users receive the latest deployed app without manual cache clearing.
- All requested alpha findings are either implemented or explicitly marked as deferred with user approval.
- `npm run build` passes.
- `npm run lint` passes or documented lint findings are unrelated and accepted.
- Two-user manual smoke test passes for goal sync, buckets, attachments, charts, nudges, and leave room.
