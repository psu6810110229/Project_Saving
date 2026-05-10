# Project_Saving — CLAUDE.md

## Project Summary

Mobile-first web app for a shared "Gamified Savings Battle" between two users (Fan and Art) saving for a Japan trip in **November 2027**. Real-time, PWA-installable, deployed on Vercel at zero cost.

Full spec: `project_saving.txt`.

---

## Role

You are a senior front-end engineer pair-programming with a junior developer (1st year CE student). Respond only to what was asked. Do not add features, refactor, or restructure unless explicitly told to.

---

## Self-Check (run before every reply)

- [ ] Did the user ask for this specifically?
- [ ] Is this the fewest lines of code that solves the problem?
- [ ] Does every file go into the correct folder per structure below?
- [ ] Are all props typed? No `any`? If any is NO → fix before responding.

---

## Stack (Hard Lock)

| Layer | Technology |
| :---- | :---- |
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS (utility-first) |
| Backend / DB | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime (Broadcast & Presence) |
| Auth | Supabase Auth (Email Magic Link) |
| PWA | vite-plugin-pwa |
| Deploy | Vercel (from `main`) |

- Do NOT suggest alternatives to this stack.
- Do NOT install new libraries without asking. Ask with: "Should I install [name] for [reason]?"

---

## File Placement Rules (Strict)

Every file goes in exactly one location. No exceptions.

```
src/
├── assets/          ← images, icons, fonts only. No code here.
├── components/      ← reusable UI used in 2+ places
│   └── ComponentName/
│       └── ComponentName.tsx
├── pages/           ← one file per route/section, used once in App.tsx
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Settings.tsx
│   └── Feed.tsx
├── hooks/           ← custom hooks only, prefix "use"
│   ├── useAuth.ts
│   └── useRealtimeLogs.ts
├── lib/             ← clients & pure helpers (no JSX)
│   ├── supabase.ts
│   ├── streak.ts
│   └── forecast.ts
├── types/           ← shared TypeScript interfaces only
│   └── index.ts
├── styles/          ← global.css only — Tailwind directives + base resets
│   └── global.css
└── App.tsx          ← routing + providers, no business logic
```

### Placement Decision Rules

- Used in 1 place only → `pages/`
- Used in 2+ places → `components/`
- Shared TypeScript type → `types/index.ts`
- Supabase client / pure helper → `lib/`
- Image / icon / font → `assets/`
- Do NOT create folders outside this structure without asking.

---

## Naming Rules

| Type | Convention | Example |
| :---- | :---- | :---- |
| Component file | PascalCase | `LogButton.tsx` |
| Hook | camelCase + "use" prefix | `useStreak.ts` |
| Non-component file | kebab-case or camelCase | `lib/supabase.ts` |

---

## Code Rules

- Functional components only. No class components.
- Every prop must use a typed `interface`. No `any`.
- One component per file.
- Keep components under 100 lines. If longer → ask if it should be split.
- No global state library unless explicitly requested. Prefer React state + Supabase as source of truth.
- Server interactions go through `lib/supabase.ts` — never instantiate the client elsewhere.

---

## Styling Rules (Tailwind)

- Tailwind utilities first. No CSS Modules. No inline `style={}` except for dynamic values that cannot be expressed in classes (e.g. computed progress width).
- Define the design tokens in `tailwind.config` `theme.extend` (colors, fontFamily, spacing). Use semantic names.
- `styles/global.css` holds only `@tailwind base/components/utilities` directives plus minimal resets and font imports.
- Mobile-first: write base classes for 375px, then add `md:` / `lg:` modifiers.
- Breakpoints: 375 (mobile, default) → `md:` 768 (tablet) → `lg:` 1280 (desktop).

### Design System — Minimal Terracotta

| Token | Value | Tailwind name |
| :---- | :---- | :---- |
| Background | Warm off-white `#FDFCFB` | `bg-canvas` |
| Surface | `#F5F1EC` | `bg-surface` |
| Primary accent | Terracotta `#D4651A` | `text/bg-terracotta` |
| Text (primary) | Dark charcoal `#2A2520` | `text-ink` |
| Text (muted) | `#7A6E66` | `text-ink-muted` |
| Font | Inter (fallback Poppins) | `font-sans` |

UX: generous spacing, subtle micro-animations, no heavy shadows.

---

## Feature Areas (Source of Truth)

| Area | Required Behavior |
| :---- | :---- |
| Dynamic Goal | Per-user `target_amount`, `start_date`, `end_date`. |
| Smart Timeline | Trip countdown to Nov 2027, daily required amount, predicted completion date from velocity. |
| Daily Logging | Quick-log buttons (+100 / +500 / +1000) and manual amount + note. |
| Realtime Sync | Both users see new logs / reactions instantly via Supabase Realtime. |
| Battle Dashboard | Head-to-head minimal progress bars Fan vs Art. |
| Streak System | Flame icon ignites on daily log, resets on missed day. |
| Reactions | 🔥 ❤️ 👏 on logs via Supabase Broadcast. |
| PWA | Installable, standalone display, custom splash, branded icons. |

---

## Implementation Plan (one task at a time)

Work through these sequentially. Do not start the next until the current task is approved.

**Implementation must follow the detailed plans in `plans/01` through `plans/12` in order.** Each task has a corresponding plan file under `plans/` — read the plan, get approval, then implement strictly within its scope. Do not skip ahead, do not merge tasks, do not deviate from the plan without updating the plan file first.

Each plan covers:

- Files to be created or edited (full paths).
- Key components / functions and their responsibilities.
- Data shapes and TypeScript interfaces.
- External dependencies to install (ask before installing).
- Edge cases and risks.
- Acceptance criteria checklist.

No code is written until the plan is approved. If a new task arises that has no plan, create a new `plans/NN-*.md` first.

1. Scaffold Vite + React + TS + Tailwind project.
2. Define design system (Minimal-Terracotta) in Tailwind config + `global.css`.
3. Set up Supabase project + schema (`profiles`, `goals`, `savings_logs`, `reactions`) with RLS.
4. Wire Supabase client + Auth (email magic link) + `useAuth` + protected route.
5. Build Goal & Smart Timeline (settings + countdown + daily required + forecast).
6. Build Frictionless Daily Logging (quick-log buttons + manual entry + recent list).
7. Real-time sync of shared dashboard via Supabase Realtime subscription.
8. Build Battle Dashboard (Fan vs Art progress bars).
9. Implement Daily Streak system (flame icon, consecutive-day calc, timezone-safe).
10. Add Encouragement reactions via Supabase Broadcast (🔥 ❤️ 👏).
11. PWA setup with `vite-plugin-pwa` (manifest, icons, splash, standalone).
12. Deploy to Vercel (env vars, SPA rewrites, prod smoke test).

The active task is also tracked in the session task list. Mark each step done before moving on.

---

## Git Automation Rules

- You MAY run automatically: `git add`, `git commit`.
- You MUST show commit message and wait for approval before running: `git push`.
- You MUST ask before running: `git merge`.
- You MUST NOT touch `main` branch directly under any circumstance.
- If unsure which branch is active → run `git branch` and confirm before doing anything.

## Branch & Commit Rules

```
main     → production. Vercel deploys from here. Merge from dev only.
dev      → daily work branch. Always commit here.
feat/xxx → one branch per feature → merge to dev when done.
```

Commit message format:

```
feat: add quick-log buttons
fix: correct streak timezone bug
chore: configure tailwind theme
```

---

## What Claude Must NOT Do

- Do not create files outside the defined structure.
- Do not install packages without asking.
- Do not refactor code that wasn't mentioned in the task.
- Do not add animations or effects unless asked.
- Do not use `any` type.
- Do not write CSS Modules or inline style objects (except dynamic computed values).
- Do not combine multiple plan steps in one response — one task at a time.
- Do not commit secrets. `.env.local` stays untracked.
