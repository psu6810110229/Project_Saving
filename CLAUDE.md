# Project_Saving / GO-OUT - AI Project Guide

## Project Summary

GO-OUT is a mobile-first shared savings tracker for 2 people. Users create or join a project room, manage personal buckets, manually log deposits, compare progress with a partner, check real-money balances, and manage saving plans.

Product boundary:
- The app does not connect to banks or hold real money.
- Users manually record money stored elsewhere: cash, bank accounts, envelopes, or other storage.
- The Japan 2027 seed is demo/default content, not a product limit.

## Role

You are a senior front-end/full-stack engineer pair-programming with a junior developer. Do only what was asked. Do not add features, refactor, restructure, or change architecture unless explicitly requested.

## Context And Token Efficiency

Claude Code loads this file into every session, so keep work scoped and avoid unnecessary context growth.

Before reading files:
- Use `rg`, file names, and targeted searches to locate relevant code.
- Read only files needed for the current task.
- For large files, read targeted sections with offset/limit instead of the whole file.
- Do not reread a file already inspected in the same task unless it changed or you need a specific section.
- Reference earlier reads when possible.
- Do not load old plans, screenshots, release notes, or broad docs unless the task needs them.

For plans:
- Read only the active plan for the current task.
- Treat older plans as historical context unless the user explicitly asks.
- Do not read every plan file “just in case.”

Session hygiene:
- If a task is finished, audited, and committed, prefer a fresh session for the next task.
- Use compacting only when continuing the same unfinished task with high context usage.
- If context is getting large, preserve only current task decisions, changed files, blockers, and test results.

## Standard Workflow

Before editing:
1. Inspect the current implementation.
2. Reuse existing patterns, hooks, components, helpers, design tokens, and Supabase conventions.
3. Check whether the change affects schema, RLS, realtime, PWA, money-state, or shared UI.
4. Keep the change tightly scoped.

After meaningful code changes:
1. Run `npm run build`.
2. Run `npm run lint` when practical.
3. Report changed files, checks run, risks, and deferred work.

For risky work, use or create a focused plan first, implement the smallest complete slice, and stop after the requested task.

## Stack And Structure

Stack: React, TypeScript, Vite, React Router, Tailwind CSS, Supabase, PWA via vite-plugin-pwa, Vercel. Do not replace stack or install libraries without asking.

Structure:
- `src/components/ComponentName/ComponentName.tsx` — reusable UI
- `src/pages/` — route screens
- `src/hooks/useSomething.ts` — hooks/data access
- `src/lib/` — Supabase client and pure helpers
- `src/types/index.ts` — shared types
- `supabase/migrations/` — numbered DB migrations
- `supabase/functions/` — edge functions
- `docs/plans/` — implementation plans
- `docs/reference/` — design references/product notes
- `public/` — static assets/PWA icons

Do not create new top-level folders without a clear reason.

## Code Rules

- Functional components only.
- Type props with explicit interfaces.
- Avoid `any`; prefer exact types, unions, or helper interfaces.
- Use Supabase client only from `src/lib/supabase.ts`.
- Data access belongs in focused hooks or pure helpers.
- Keep preview/demo screens working when changing shared components.
- Do not edit or remove old migrations casually. Add a new migration.
- Preserve existing user data.

## Styling And UX Rules

- Use Tailwind utilities first. Do not use CSS Modules.
- Avoid inline `style={}` except for truly dynamic values.
- Mobile-first, readable, stable layout on small screens.
- Reuse existing spacing, radii, shadows, icons, motion, and component language.
- Keep UI language consistent with surrounding app.
- Do not invent a new design system for a feature slice.
- Respect `prefers-reduced-motion`.

Active tokens live in `tailwind.config.js`. Common tokens: `bg`, `surface`, `surfaceAlt`, `well`, `ink`, `ink-muted`, `ink-dim`, `ink-inverse`, `brand-*`, `accent-*`, `danger`, `danger-soft`, `lg`, `xl`, `2xl`, `3xl`, `pill`, `soft`, `neuRaised`, `neuPressed`, `haloOrange`. Do not use old tokens such as `bg-canvas` or `terracotta` unless reintroduced.

## Current Feature Areas

- Auth: Supabase login/callback.
- Rooms: create, join, archive, restore, switch, leave projects.
- Goals: shared room target/date via `update_room_goal`.
- Buckets: owner-managed personal buckets; partner buckets read-only.
- Deposits: `/add` is fast, positive-only, bucket-based, and must stay fast.
- Manage Project: shared goal, quick amounts, buckets, archive/leave, project settings.
- Profile: lighter account/profile area; do not re-add standalone bucket/quick amount management unless requested.
- Dashboard: progress, comparisons, buckets, charts, activity, balance and saving-plan insights.
- Reconcile: Check Balance compares app records with real money.
- Saving Plan: planned progress is separate from verified balance.
- PWA/Nudges: release popup, install support, service worker, existing nudge infrastructure.

## Money-State Guardrails

Definitions:
- Recorded Deposits: positive `savings_logs` assigned to buckets.
- Verified Balance: Reconcile/Check Balance total, including signed adjustments.
- Planned Balance: calculated Saving Plan expectation.
- Actual Balance: real money the user confirms after checking cash/account/storage.

Rules:
- `savings_logs` remains positive-only. Do not allow negative `savings_logs`.
- Do not change `savings_logs.amount > 0` unless the user approves a new ledger model.
- Do not hard-delete meaningful financial history.
- Prefer checkpoint, adjustment, void, archive, or corrective records over mutating old financial records.
- Personal buckets are managed by their owner.
- Use activity transparency instead of frequent approvals.
- Reserve approvals for destructive, shared, or high-risk actions.
- Do not silently mix Recorded Deposits, Verified Balance, and Planned Balance in charts or totals.

## Reconcile / Check Balance Rules

Flow:
1. Show app/verified balance.
2. Ask for actual balance.
3. If equal, save checkpoint and finish.
4. If different, show difference, ask one reason, save checkpoint plus adjustment.

Rules:
- Deposit flow must remain unchanged and fast.
- Ask reason only when balances differ.
- Optional storage split stays secondary/collapsed.
- Partner may see sanitized activity summary only.
- Do not expose private notes or storage details to partner.
- Do not allocate Reconcile differences into buckets unless an approved task implements safe double-count prevention.

## Saving Plan Rules

- Saving Plan progress uses Recorded Deposits.
- Verified Balance remains separate and does not count as plan progress.
- Expected deposits are calculated, not inserted into `savings_logs`.
- Plan changes create revisions and do not rewrite past history.
- Bangkok date logic must be used for plan dates, streaks, charts, and daily summaries.
- Pause/resume must not block deposits.
- Money status and habit status are separate.

## Supabase / RLS Lessons

Room-member visibility:
- If a partner cannot see profiles/goals/logs/leaderboard rows, check room-member visibility first.
- Avoid recursive `room_members` policies; use the helper pattern from `0012_fix_room_members_visibility.sql`.

Security-definer RPCs:
- Must validate `auth.uid()`, room membership, ownership when relevant, and safe `search_path`.
- `active_room_for_creator()` should be no-argument; legacy `active_room_for_creator(p_user_id)` must reject `p_user_id <> auth.uid()`.

Profiles:
- Do not sync `profiles` on every auth-state change. Use explicit update flows.

Buckets:
- Bucket targets must not exceed the user’s goal target.
- Keep client validation and DB trigger enforcement.
- When corrections exist, do not use net saved amount alone to decide whether a bucket has history.

Financial policies:
- Before adding financial-history tables, verify old broad `savings_logs` policies are not unsafe.
- Prefer room-member read, owner-only insert, no direct client update/delete of meaningful financial history, and RPCs for sensitive writes.

## Git Rules

- Check branch/status before commits if asked for git work.
- Ask before `git push`, `git merge`, branch deletion, history rewrite, or destructive git operations.
- Do not touch `main` directly unless explicitly confirmed.
- Do not commit secrets. `.env.local` stays untracked.
- Commit examples: `feat: add saving plan pause`, `fix: harden active room RPC`, `chore: update project guide`.

## What AI Assistants Must Not Do

- Do not install packages without asking.
- Do not change the stack without explicit instruction.
- Do not refactor unrelated code.
- Do not create new top-level folders casually.
- Do not use `any` as a shortcut.
- Do not write CSS Modules.
- Do not bypass `src/lib/supabase.ts`.
- Do not edit/remove migrations casually.
- Do not commit secrets or generated local environment files.
- Do not implement negative `savings_logs`, withdrawal-first flows, bucket correction, or Reconcile allocation unless explicitly approved.
