# Project_Saving / GO-OUT - AI Project Guide

## Project Summary

GO-OUT is a mobile-first shared savings tracker for 2 people.

Users create or join a project room, manage personal smart buckets, manually log deposits, compare progress with a partner, and manage profile/project settings.

Important product boundary:

- The app does not connect to banks.
- The app does not hold real money.
- Users manually record money stored elsewhere, such as cash, separate bank accounts, envelopes, or other storage.

The original Japan 2027 seed context is demo/default content, not a hard product limit.

Original spec: `project_saving.txt`.

---

## Role And Operating Rules

You are a senior front-end/full-stack engineer pair-programming with a junior developer.

Respond only to what was asked. Do not add features, refactor, restructure, or change architecture unless explicitly requested.

Before editing code:

1. Inspect the current implementation.
2. Reuse existing patterns, hooks, components, helpers, design tokens, and Supabase conventions.
3. Check whether the change affects schema, RLS, realtime behavior, PWA behavior, or shared UI.
4. Keep the change tightly scoped.

After meaningful code changes:

1. Run `npm run build`.
2. Run `npm run lint` when practical.
3. Report what changed, what was checked, and any remaining risks.

---

## Self-Check Before Responding

- Did the user ask for this specifically?
- Is the change scoped to the request?
- Are files placed in the correct folders?
- Are props and shared data shapes typed?
- Did you avoid `any` unless there is a strong reason?
- If schema changed, did you add a new Supabase migration?
- Did you preserve existing user data?
- Did you avoid refactoring unrelated code?
- Did you keep UI language consistent with the current app?

---

## Stack

| Layer | Technology |
| :---- | :---- |
| Frontend | React + TypeScript + Vite |
| Routing | React Router |
| Styling | Tailwind CSS |
| Backend / DB | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime |
| Edge functions | Supabase Functions |
| PWA | vite-plugin-pwa + service worker |
| Deploy | Vercel |

Do not suggest replacing this stack unless the user explicitly asks.

Do not install new libraries without asking first.

---

## Current App Structure

```text
src/
  assets/              images and static app assets
  components/          reusable UI components, one folder per component
  hooks/               custom hooks, prefixed with use
  lib/                 Supabase client and pure helpers
  pages/               route-level screens
  styles/global.css    Tailwind directives and global base styles
  types/index.ts       shared TypeScript interfaces and unions
  App.tsx              route and provider wiring
  main.tsx             React entry
  sw.ts                service worker

supabase/
  migrations/          ordered database migrations
  functions/           Supabase edge functions
  seed-*.sql           optional local/dev seed helpers

docs/
  operational notes, runbooks, and implementation plans

public/
  icons and PWA splash assets
```

Core routes include:

- `/login`
- `/auth/callback`
- `/dashboard`
- `/add`
- `/profile`
- `/manage-project`
- preview routes such as `/atoms`, `/molecules`, `/organisms`

---

## File Placement Rules

- Reusable UI used in multiple places: `src/components/ComponentName/ComponentName.tsx`
- Route-level screens: `src/pages/`
- Hooks: `src/hooks/useSomething.ts`
- Pure helpers and clients: `src/lib/`
- Shared types: `src/types/index.ts`
- Supabase migrations: new numbered files under `supabase/migrations/`
- Supabase functions: `supabase/functions/`
- Public icons/assets: `public/`

Do not create new top-level folders without a clear reason.

---

## Code Rules

- Functional components only.
- Type component props with explicit interfaces.
- Avoid `any`; prefer exact types, unions, or helper interfaces.
- Use the Supabase client only from `src/lib/supabase.ts`.
- App data access should live in focused hooks such as `useRooms`, `useBuckets`, `useLogs`, `useProfile`, or a focused new hook.
- Keep components small enough to understand, but do not split files just to satisfy an arbitrary line count.
- Keep preview/demo screens working when changing shared components.
- Do not edit old migrations casually. Add a new migration instead.

---

## Styling And UX Rules

- Use Tailwind utilities first.
- Do not use CSS Modules.
- Avoid inline `style={}` except for truly dynamic values.
- Keep layouts mobile-first.
- Reuse the existing component system, spacing, radii, shadows, icons, and motion language.
- Keep text readable and avoid layout shifts on small screens.
- Keep UI language consistent with the current app. Do not switch a feature to Thai or English unless the surrounding UI already uses that language.
- Do not invent a new design system for a feature slice.

Active Tailwind tokens live in `tailwind.config.js`.

Core tokens include:

- Background/surfaces: `bg`, `surface`, `surfaceAlt`, `well`
- Text: `ink`, `ink-muted`, `ink-dim`, `ink-inverse`
- Brand: `brand-50` through `brand-900`
- Accents: `accent-gold`, `accent-leaf`, `accent-slate`, `accent-teal`
- Danger: `danger`, `danger-soft`
- Radii: `lg`, `xl`, `2xl`, `3xl`, `pill`
- Shadows: `soft`, `neuRaised`, `neuPressed`, `haloOrange`

Do not use old tokens such as `bg-canvas` or `terracotta` unless they are reintroduced.

---

## Current Feature Areas

| Area | Current Behavior |
| :---- | :---- |
| Auth | Supabase login and auth callback via protected routes. |
| Projects / Rooms | Users create, join, archive, restore, switch, and leave savings projects according to current room rules. Invite codes connect partners. |
| Goals | Room goal sync is handled through `update_room_goal` so both partners share project target/date state. |
| Smart Buckets | Users create, rename, retarget, and delete their own buckets when allowed. Partner buckets are visible read-only. |
| Deposits | `/add` supports quick amounts, manual amount entry, bucket selection, confirmation, haptics, and slip markers. Deposits must remain fast. |
| Manage Project | Central place for shared goal editing, quick amounts, bucket management, archive, leave, and project-level saving settings. |
| Profile | Lighter account/profile area. Do not re-add standalone bucket or quick amount management unless requested. |
| Dashboard | Shows project progress, player comparison, bucket progress, partner buckets, charts, and recent activity. |
| Activity / Reactions | Logs and reactions use hooks and Supabase realtime helpers. Activity is currently deposit-oriented. |
| Push Nudges | Partner nudges use `NudgeButton`, push subscriptions, and the `send-nudge` Supabase function. |
| PWA | Icons, splash assets, service worker, release popup, and installable app support are present. |

---

## Active Money-State Decisions

These are current architectural guardrails.

- `savings_logs` remains positive-only for now.
- Do not allow negative `savings_logs`.
- Do not change the `savings_logs.amount > 0` constraint unless the user explicitly approves a new ledger model.
- Do not implement withdrawal-first flows.
- Do not implement bucket transfers before the Reconcile model is implemented and verified.
- Do not hard-delete meaningful financial history.
- Prefer checkpoint, adjustment, void, archive, or corrective records over mutating old financial records.
- Personal buckets are managed by their owner.
- Partner approval should not be required for normal personal-bucket actions.
- Use activity transparency instead of frequent approval prompts.
- Reserve approval for destructive, shared, or high-risk actions.

Active Reconcile plan:

- Use `docs/plans/21-reconcile-and-correction-plan.md` as the active plan for Reconcile / Check Balance work.
- Treat `docs/plans/20-alpha-test-follow-up-plan.md` as historical context after item 5.
- Implement Reconcile before transfers, withdrawals, saving-plan engines, or approval workflows.

---

## Reconcile / Check Balance Guidance

The app has three separate balance concepts:

1. Planned balance: what a future saving plan says the user should have.
2. App ledger balance: what the app currently records.
3. Actual verified balance: what the user confirms they really have after checking cash/account/storage.

For the first Reconcile MVP, focus only on actual verified balance vs app ledger balance.

User-facing flow should be lightweight:

1. Show App Balance.
2. Ask for Actual Balance.
3. If equal, save a checkpoint and finish.
4. If different, show Difference, ask one reason, then save checkpoint plus adjustment.

Rules:

- Deposit flow must remain unchanged and fast.
- Do not show a long form first.
- Ask for a reason only when balances differ.
- Optional storage split must stay secondary/collapsed.
- Partner may see sanitized activity summary only.
- Do not expose private notes or storage details to partner by default.
- Do not merge Reconcile activity into the deposit feed unless event typing is clearly safe.

If the app UI is English, use English labels such as:

- Check Balance
- App Balance
- Actual Balance
- Difference
- Forgot to log
- Recorded too much
- Miscounted
- Spent/used already
- Opening balance
- Other

If the surrounding UI is Thai, use the Thai labels from plan 21.

---

## Supabase / RLS Lessons

### Room Member Visibility

If one partner cannot see the other partner's profile, goal, logs, or leaderboard row, check room-member visibility first.

Do not fix `room_members` RLS with a direct recursive `exists(select 1 from room_members ...)` policy. Use the security-definer helper pattern from `supabase/migrations/0012_fix_room_members_visibility.sql`, where `public.is_room_member(room_id)` is used by the select policy.

Smoke test with two users in the same room. Each user should see both room members, goals, profiles, and logs.

### Security-Definer RPCs

Security-definer RPCs must validate caller identity and room membership.

`active_room_for_creator` must not accept arbitrary `p_user_id` without an `auth.uid()` guard.

Prefer the no-argument `active_room_for_creator()` RPC. The old `active_room_for_creator(p_user_id uuid)` wrapper must reject `p_user_id <> auth.uid()`.

If `0026_harden_active_room_for_creator.sql` exists, the next Reconcile migration must use the next migration number.

### Profiles

Avoid syncing `profiles` implicitly on every auth-state change. Let the database trigger create the profile row, and use explicit profile update flows for user edits.

If profile updates fail through PostgREST, check that the policy includes both `using (auth.uid() = id)` and `with check (auth.uid() = id)`.

### Buckets

Bucket targets must not exceed the user's goal target.

Keep both layers:

1. Client validation in `useBuckets.saveBuckets()` for fast feedback.
2. Database enforcement through the trigger from `supabase/migrations/0014_bucket_sum_check.sql`.

When future corrections/adjustments exist, do not use net saved amount alone to decide whether a bucket has history. Use log/history count or explicit history checks.

### Financial Policies

Before adding new financial-history tables, verify deployed policies for old broad `savings_logs` read/update/delete access.

Prefer:

- room-member read
- owner-only insert
- no direct client update/delete of meaningful financial history
- RPCs for sensitive writes

---

## Development Workflow

For small fixes, implement directly after reading the relevant code.

For larger or risky changes:

1. Explore the existing code.
2. Create or read the implementation plan.
3. Confirm scope.
4. Implement the smallest complete slice.
5. Verify with build/lint/manual smoke checks.

Do not continue into adjacent roadmap items unless the user explicitly asks.

---

## Git Rules

- Check branch/status before commits if the user asks for git work.
- You may run `git add` and `git commit` when the user asks for a commit.
- Show the commit message before committing when practical.
- Ask before `git push`, `git merge`, branch deletion, history rewrite, or destructive git operations.
- Do not commit secrets. `.env.local` stays untracked.
- Do not touch `main` directly unless the user explicitly confirms that workflow.

Commit message examples:

```text
feat: add quick amount settings
fix: harden active room RPC
chore: update project guide
```

---

## What AI Assistants Must Not Do

- Do not install packages without asking.
- Do not change the stack without explicit instruction.
- Do not refactor unrelated code.
- Do not create new top-level folders casually.
- Do not use `any` as a shortcut.
- Do not write CSS Modules.
- Do not bypass `src/lib/supabase.ts` for client creation.
- Do not edit or remove migrations casually.
- Do not commit secrets or generated local environment files.
- Do not implement negative `savings_logs` or withdrawal-first flows unless explicitly approved.
