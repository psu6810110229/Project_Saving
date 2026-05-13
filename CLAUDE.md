# Project_Saving - AI Project Guide

## Project Summary

Project_Saving is a mobile-first shared savings app. Users create or join savings projects, split targets into smart buckets, log deposits, compare progress with a partner, and manage profile settings. The app uses Supabase for auth, data, realtime activity, and edge functions; it is PWA-ready and designed for a polished mobile experience.

Current status: Alpha v0.7.5.

The original seed context is a Japan 2027 savings project, but future work should treat that as demo/default content, not a hard product limit.

Full original spec: `project_saving.txt`.

---

## Role

You are a senior front-end engineer pair-programming with a junior developer. Respond only to what was asked. Do not add features, refactor, or restructure unless explicitly told to.

When changing code, inspect the current implementation first and follow the patterns already in the repo.

---

## Self-Check

- [ ] Did the user ask for this specifically?
- [ ] Is this change scoped to the request?
- [ ] Does every file go into the correct folder?
- [ ] Are props and shared data shapes typed?
- [ ] Did you avoid `any` unless there is a strong reason?
- [ ] If schema changes are needed, did you add a Supabase migration?
- [ ] If behavior changed, did you run the relevant check (`npm run build`, `npm run lint`, or a focused test/manual check)?

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

- Do not suggest replacing this stack unless the user explicitly asks.
- Do not install new libraries without asking first.

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

public/
  icons and PWA splash assets

docs/
  operational notes and runbooks
```

Current primary routes:

- `/login` - login
- `/auth/callback` - Supabase auth callback
- `/dashboard` - project dashboard, buckets, activity, race chart
- `/add` - deposit flow
- `/profile` - lighter account/profile settings, project create/join, and sign out
- `/manage-project` - shared goal editing, quick amounts, buckets, archive/leave, and invite code
- `/atoms`, `/molecules`, `/organisms` - component preview screens

---

## File Placement Rules

- Reusable UI used in multiple places goes in `src/components/ComponentName/ComponentName.tsx`.
- Route-level screens go in `src/pages/`.
- Custom hooks go in `src/hooks/` and start with `use`.
- Pure helpers and clients go in `src/lib/`.
- Shared TypeScript types go in `src/types/index.ts`.
- Supabase schema changes go in a new numbered file under `supabase/migrations/`.
- Supabase edge function code goes under `supabase/functions/`.
- PWA icons, splash screens, and other static public files go in `public/`.
- Do not create new top-level folders without a clear reason.

---

## Naming Rules

| Type | Convention | Example |
| :---- | :---- | :---- |
| Component file | PascalCase | `AddMoneyForm.tsx` |
| Component folder | PascalCase | `AddMoneyForm/` |
| Hook | camelCase with `use` prefix | `useBuckets.ts` |
| Helper file | camelCase or kebab-case | `dashboardStats.ts` |
| Migration | ordered snake/kebab style | `0024_example_change.sql` |

---

## Code Rules

- Functional components only.
- Type component props with explicit interfaces.
- Avoid `any`; prefer specific types, unions, or helper interfaces.
- Prefer existing hooks and helpers before adding new data-access patterns.
- Instantiate the Supabase client only in `src/lib/supabase.ts`.
- App data access should usually live in focused hooks such as `useRooms`, `useBuckets`, `useLogs`, `useProfile`, or in pure helpers under `src/lib/`.
- Keep components reasonably small, but do not split files just to satisfy an arbitrary line count.
- Do not refactor unrelated code while solving a focused request.
- Keep preview/demo screens working when changing shared components.

---

## Styling Rules

- Use Tailwind utilities first.
- Do not use CSS Modules.
- Avoid inline `style={}` except for truly dynamic values such as computed progress width.
- Keep layouts mobile-first.
- Use the existing component system, spacing, radii, shadows, and icon language before inventing new UI patterns.
- Keep text readable and avoid layout shifts on small screens.

### Current Design Tokens

The active Tailwind design system is in `tailwind.config.js`.

Core tokens:

- Canvas/background: `bg`
- Raised surfaces: `surface`
- Alternate/inset surfaces: `surfaceAlt`, `well`
- Text: `ink`, `ink-muted`, `ink-dim`, `ink-inverse`
- Brand scale: `brand-50` through `brand-900`
- Accents: `accent-gold`, `accent-leaf`, `accent-slate`, `accent-teal`
- Danger: `danger`, `danger-soft`
- Fonts: `font-mono` and `font-sans`, both with IBM Plex and Thai-capable fallbacks
- Radii: `lg`, `xl`, `2xl`, `3xl`, `pill`
- Shadows: `soft`, `neuRaised`, `neuPressed`, `haloOrange`
- Animations: `fade-in-up`, `fade-in`, `scale-in`, `fill-bar`

Do not use old tokens such as `bg-canvas` or `terracotta` unless they are reintroduced in Tailwind.

---

## Current Feature Areas

| Area | Current Behavior |
| :---- | :---- |
| Auth | Supabase login and auth callback via protected routes. |
| Projects / Rooms | Users create, join, archive, and switch active savings projects. Invite codes connect partners. |
| Goals | Each active project has target and date data used by dashboard and progress calculations. |
| Smart Buckets | Users create bucket targets inside a project and log deposits against buckets. |
| Deposits | `/add` supports quick amounts, manual amount entry, bucket selection, confirmation, haptics, and slip markers. |
| Dashboard | Shows project hero, player comparison, bucket progress, partner buckets, saving race chart, and recent activity. |
| Manage Project | Contains shared goal editing, quick amounts, bucket creation/edit/delete, invite code, archive, and leave actions. |
| Profile | Manages display name, avatar, theme color, project creation/joining, navigation to Manage Project, and sign out. Keep quick amounts and bucket management out of Profile unless explicitly requested. |
| Activity / Reactions | Logs and reactions are handled through hooks and Supabase realtime helpers. |
| Push Nudges | Partner nudges use `NudgeButton`, push subscriptions, and the `send-nudge` Supabase function. |
| PWA | Icons, splash assets, service worker, and installable app support are present. |

---

## Development Workflow

For small requested fixes, implement directly after reading the relevant code.

For larger features or risky changes, first summarize the intended approach and confirm scope with the user.

Before editing:

1. Read the current files involved.
2. Search for existing components, hooks, and helpers that already solve part of the problem.
3. Check whether the change affects database schema, realtime behavior, PWA behavior, or shared UI components.

During implementation:

1. Keep edits tightly scoped.
2. Add or update a Supabase migration for schema changes.
3. Preserve existing user data and migration order.
4. Prefer progressive enhancement over broad rewrites.
5. Avoid deleting old behavior unless the user asked for it or the old behavior is clearly dead.

After implementation:

1. Run `npm run build` for TypeScript/build-sensitive changes.
2. Run `npm run lint` for style or broad code changes when practical.
3. Manually inspect UI flows when layout or interaction changes are involved.
4. Report what changed and which checks were run.

---

## Known Repo Lessons

### Product Status And Active Plans

Treat Alpha v0.7.5 as the current product baseline.

Plan 20 is historical context after item 5. Do not continue later Plan 20 workstreams by default. For the next money-state feature, use `docs/plans/21-reconcile-and-correction-plan.md` as the active Reconcile MVP plan.

### Money State: Keep Deposits Positive

This app is not a banking app. It does not connect to banks and does not hold real money; users manually record money kept elsewhere.

For now, keep `savings_logs` positive-only. Do not implement negative `savings_logs`, withdrawal-first flows, or bucket transfers unless the user explicitly requests that direction.

The next money-state model should be Reconcile-first: compare `ยอดจริง` with `ยอดในแอป` through checkpoints and adjustment/correction records, while keeping normal deposits extremely easy.

### Supabase RLS: Room Member Visibility

If one partner cannot see the other partner's profile, goal, logs, or leaderboard row, check room-member visibility first.

Do not fix `room_members` RLS with a direct recursive `exists(select 1 from room_members ...)` policy. Use the security-definer helper pattern from `supabase/migrations/0012_fix_room_members_visibility.sql`, where `public.is_room_member(room_id)` is used by the select policy.

Smoke test with two users in the same room. Each user should see both room members, goals, profiles, and logs.

### Supabase RPCs: Caller-Bound Security

Security-definer RPCs must validate caller identity and room membership before returning or mutating room data.

`active_room_for_creator` must not accept an arbitrary `p_user_id` without an `auth.uid()` guard. Prefer the no-argument `active_room_for_creator()` RPC introduced by `supabase/migrations/0026_harden_active_room_for_creator.sql`; compatibility wrappers must reject calls where `p_user_id` differs from `auth.uid()`.

### Supabase Profiles: Avoid Auth-State Upsert Noise

Avoid syncing `profiles` implicitly on every auth-state change. Let the database trigger create the profile row, and use explicit profile update flows for user edits.

If profile updates fail through PostgREST, check that the policy includes both `using (auth.uid() = id)` and `with check (auth.uid() = id)`. See `supabase/migrations/0013_profiles_upsert_with_check.sql`.

### Buckets: Enforce Total Target Safely

Bucket targets must not exceed the user's goal target.

Keep both layers:

1. Client validation in `useBuckets.saveBuckets()` for fast feedback.
2. Database enforcement through the trigger from `supabase/migrations/0014_bucket_sum_check.sql`.

The database trigger is the source of truth; client validation is only UX.

### Migration Numbering

Migration `0026_harden_active_room_for_creator.sql` is the current security hotfix. If it is kept, the Reconcile migration should use the next available number, for example `0027_reconcile_checkpoints.sql`.

---

## Git Rules

- Check branch/status before commits if the user asks for git work.
- You may run `git add` and `git commit` when the task done without error.
- Show the commit message before committing when practical.
- Ask before `git push`, `git merge`, branch deletion, history rewrite, or destructive git operations.
- Do not commit secrets. `.env.local` stays untracked.
- Do not touch `main` directly unless the user explicitly confirms that workflow.

Commit message examples:

```text
feat: add quick amount settings
fix: correct bucket total validation
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
- Do not edit or remove migrations casually; add a new migration instead.
- Do not commit secrets or generated local environment files.
