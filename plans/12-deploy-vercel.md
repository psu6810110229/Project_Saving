# Task 12 — Deploy to Vercel

## Goal
Production deployment from `main` with proper env vars, SPA routing, and a verified end-to-end smoke test.

## Files Created / Edited
- `vercel.json` — SPA rewrite + headers.
- README section: deployment & env vars.
- `.github/` — none (Vercel handles CI on its own).

## vercel.json
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

## Vercel Project Setup
1. Import repo from GitHub (after pushing `main` for the first time).
2. Framework preset: **Vite**.
3. Build command: `npm run build`.
4. Output: `dist`.
5. Install command: `npm install`.
6. Environment variables (all environments):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Production branch: `main`.

## Supabase Side
- Add the Vercel production URL AND any preview URL pattern to Supabase Auth → "Redirect URLs":
  - `https://<project>.vercel.app/auth/callback`
  - `https://<project>-*.vercel.app/auth/callback` (previews — optional)
- Add the same to "Site URL".

## Branch Strategy on First Deploy
- Per CLAUDE.md, day-to-day commits go to `dev`. For the first deploy, open a PR `dev → main`, get approval, merge.
- Future: same flow per feature batch.

## Smoke Test Checklist (run on production URL)
1. Login with magic link → check email arrives → click → land authenticated.
2. Set a goal in Settings → reload → values persist.
3. Quick-log +500 → appears immediately in feed.
4. Open the same URL on a second device with the partner account → new logs appear without refresh (realtime works in prod).
5. Tap a reaction → other device sees floater.
6. Streak shows correct count.
7. Battle dashboard reflects both totals.
8. Add to home screen on a phone → launches standalone.
9. Hard reload after a redeploy → service worker picks up new bundle.
10. Lighthouse mobile audit on prod URL: PWA ≥ 90, Performance ≥ 80.

## Edge Cases / Risks
- Forgetting env vars → build succeeds but runtime crashes on `Missing Supabase env vars`. Mitigation: verify vars are set BEFORE first deploy.
- SPA routing: without the rewrite, hitting `/auth/callback` directly returns 404 from Vercel.
- Service worker caching the old build — `vercel.json` `must-revalidate` on `/sw.js` prevents this.
- Magic link redirect mismatch → "URL not allowed" error in auth. Always update Supabase redirect URL list when domain changes.
- Free tier limits: Vercel hobby + Supabase free are sufficient for two users; document limits in README to avoid surprises later.

## Acceptance Criteria
- [ ] Production URL loads in < 2s on 4G.
- [ ] All 10 smoke-test items pass.
- [ ] No console errors on first load or after navigation.
- [ ] Lighthouse PWA ≥ 90 on the deployed URL.
- [ ] No secrets in the deployed bundle (verify by searching `dist/` for the service-role key — must NOT be present; only anon key is OK).
- [ ] README documents how to set env vars and redeploy.
