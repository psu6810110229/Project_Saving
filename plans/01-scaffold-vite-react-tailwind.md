# Task 1 — Scaffold Vite + React + TS + Tailwind

## Goal
Create the baseline project skeleton inside `Project_Saving/` so every later task has a working dev server, type-check, and Tailwind pipeline.

## Files Created
- `package.json`, `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- `tailwind.config.ts`
- `postcss.config.js`
- `index.html`
- `.gitignore` (must include `node_modules`, `dist`, `.env*`, `.vercel`)
- `.env.local.example` (placeholder for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- `src/main.tsx`
- `src/App.tsx`
- `src/styles/global.css` (only `@tailwind` directives + base resets)
- `src/vite-env.d.ts`
- Empty placeholder folders (with `.gitkeep`):
  - `src/assets/`
  - `src/components/`
  - `src/pages/`
  - `src/hooks/`
  - `src/lib/`
  - `src/types/`

## Commands (to run, in order)
1. `npm create vite@latest . -- --template react-ts`
2. `npm install`
3. `npm install -D tailwindcss postcss autoprefixer`
4. `npx tailwindcss init -p`
5. `npm run dev` (smoke test)

## tailwind.config.ts (initial)
- `content: ['./index.html', './src/**/*.{ts,tsx}']`
- `theme.extend`: empty for now (real tokens come in Task 2).
- No plugins yet.

## src/styles/global.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## src/App.tsx (minimal)
- Returns a single centered `<h1>Project_Saving</h1>` styled with Tailwind utilities, just to confirm Tailwind compiles.

## Dependencies
- Runtime: `react`, `react-dom`
- Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `postcss`, `autoprefixer`, `@types/react`, `@types/react-dom`
- No router, no Supabase yet.

## Edge Cases / Risks
- Vite scaffold refuses non-empty dir → confirm `.` is acceptable; if not, scaffold to a temp folder and copy in.
- Tailwind v4 vs v3 syntax differs; pin v3 (`tailwindcss@^3`) to keep `tailwind.config.ts` workflow stable.
- Windows path with apostrophe (`Fran's Folder`) — quote all CLI paths.
- `.gitignore` MUST exclude `.env.local` before any commit.

## Acceptance Criteria
- [ ] `npm run dev` starts without errors and shows the heading.
- [ ] A Tailwind utility class visibly affects the heading (proves PostCSS pipeline works).
- [ ] `npm run build` succeeds.
- [ ] `tsc --noEmit` (or `npm run build`) reports no type errors.
- [ ] Folder structure matches CLAUDE.md "File Placement Rules" exactly.
- [ ] `.env.local` is gitignored.
- [ ] Initial commit on `dev` branch (not `main`).
