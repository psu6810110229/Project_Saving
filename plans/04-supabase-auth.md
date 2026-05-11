# Task 4 — Supabase Client + Magic Link Auth

## Goal
Add a single Supabase client, an auth context/hook, a login page, and a protected-route wrapper. After this task, only authenticated Fan/Art can reach the app shell.

## Files Created / Edited
- `src/lib/supabase.ts` — single client instance.
- `src/hooks/useAuth.ts` — exposes `{ session, user, profile, loading, signInWithEmail, signOut }`.
- `src/components/AuthProvider/AuthProvider.tsx` — wraps `App` with auth context.
- `src/components/ProtectedRoute/ProtectedRoute.tsx` — redirects unauthenticated users to `/login`.
- `src/pages/Login.tsx` — email input + magic link button + status message.
- `src/pages/AuthCallback.tsx` — handles redirect after magic link click.
- `src/App.tsx` — set up routes: `/login`, `/auth/callback`, `/` (protected placeholder dashboard).
- `src/types/index.ts` — `Profile` interface.

## Dependencies (ask before installing)
- `@supabase/supabase-js`
- `react-router-dom` (for `/login` vs protected `/`)

## src/lib/supabase.ts
```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Missing Supabase env vars');

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
```

## useAuth Hook (sketch)
```ts
interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}
```
- On mount: `supabase.auth.getSession()` → set state, then `supabase.auth.onAuthStateChange` for live updates.
- When `user` changes, fetch `profiles` row by `user.id` once.
- Cleanup subscription on unmount.

## Login Page Flow
1. User enters email → click "Send magic link".
2. Call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/auth/callback' } })`.
3. Show "Check your email" state.
4. After click, magic link returns to `/auth/callback` → `detectSessionInUrl` parses tokens → redirect to `/`.

## Protected Route
- If `loading` → render skeleton/spinner.
- If `!session` → `<Navigate to="/login" replace />`.
- Else render children.

## Profile Type
```ts
interface Profile {
  id: string;
  display_name: string;
  created_at: string;
}
```

## Edge Cases / Risks
- Vite env vars MUST be prefixed `VITE_` — others won't be exposed.
- Magic link redirect must be added to Supabase Auth → Redirect URLs whitelist (both `localhost:5173/auth/callback` and the eventual Vercel URL).
- Email rate-limits on free tier (~3/hour). Use a real inbox during testing, not a throwaway.
- Race condition: `getSession()` resolves before `onAuthStateChange` fires; both should set `loading=false` correctly. Handle by setting `loading=false` only after first event/getSession completes.
- Don't store `session` in localStorage manually — Supabase already does it.

## Acceptance Criteria
- [ ] Visiting `/` while logged out redirects to `/login`.
- [ ] Magic link email arrives, click logs user in.
- [ ] After login, `profile.display_name` is fetched and visible somewhere on dashboard.
- [ ] Refresh keeps user logged in (session persists).
- [ ] `signOut()` returns user to `/login`.
- [ ] No `any` types; `Profile`, session, and context all typed.
