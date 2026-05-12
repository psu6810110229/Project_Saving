# VAPID Runbook — Nudge / Web Push Setup

This document describes the one-time setup required to enable the
"Nudge partner" button (Phase 6.8). The feature uses standard Web
Push with VAPID authentication. You generate the keypair once and
store it in three places: the Supabase Edge Function secrets, the
Vercel project env vars (public half only), and your password manager
(both halves).

## 1. Generate the VAPID keypair

You'll need Node.js installed locally. Run **once**:

```bash
npx -y web-push generate-vapid-keys --json
```

This prints something like:

```json
{
  "publicKey": "BIm…<base64url 87 chars>",
  "privateKey": "RYn…<base64url 43 chars>"
}
```

Store both halves in your password manager (e.g. 1Password) under
`Project_Saving / VAPID`. **Do not commit either value to the repo.**
The public key is safe to embed in client bundles (it's the whole
point of VAPID) but the private key must never leave server-side
storage.

## 2. Set Edge Function secrets

The `send-nudge` function (`supabase/functions/send-nudge/index.ts`)
reads three custom env vars at runtime. Set them on your Supabase
project:

```bash
# requires Supabase CLI: https://supabase.com/docs/guides/cli
supabase secrets set \
  VAPID_PUBLIC_KEY="BIm…<your public key>" \
  VAPID_PRIVATE_KEY="RYn…<your private key>" \
  VAPID_SUBJECT="mailto:you@example.com"

# Deploy the function (no auth required for now — the function itself
# validates the JWT and looks up the caller via getUser):
supabase functions deploy send-nudge --no-verify-jwt
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
are injected automatically by Supabase — do not set them manually.

`VAPID_SUBJECT` should be a `mailto:` URL or a public HTTPS URL of a
page describing the application. Push services use it to contact you
about abuse / quota issues; it is required by the spec.

## 3. Expose the public key to the client

The browser needs the public key to compute a valid subscription. Add
it to the Vercel project environment variables:

| Key | Value | Scope |
|-----|-------|-------|
| `VITE_VAPID_PUBLIC_KEY` | `BIm…<your public key>` | Production + Preview |

After saving, redeploy. The Vite build embeds the value into the
client bundle via `import.meta.env.VITE_VAPID_PUBLIC_KEY`. Without
this env var the Nudge button hides itself (the hook reports
`unsupported`).

## 4. Apply migration 0022

In the Supabase SQL editor, run
`supabase/migrations/0022_push_subscriptions.sql`. This creates:

- `public.push_subscriptions` — one row per (user, device) pair.
- `public.nudges` — audit log + throttle source (5-minute cooldown).

Both tables have RLS enabled with insert/select policies scoped to
the calling user; the edge function reads partner endpoints with the
service-role key.

## 5. Smoke test

1. As fran on Chrome desktop, open the Dashboard. The "Enable & Nudge"
   button should appear at the top. Tap it → grant notification
   permission. The button label flips to "Nudge partner".
2. As very_sad on a separate browser/profile, do the same. Two devices
   are now subscribed.
3. Back as fran, tap "Nudge partner". The button shows
   "Nudge sent to very sad." within 1–2 seconds, and very_sad's
   browser/phone receives a system notification titled
   "fran patcharapon sent a nudge".
4. Tap the notification → it focuses or opens the dashboard URL.
5. Hit the button again within 5 minutes → the function responds with
   the throttle message; nothing is sent.

## 6. Rotating keys

If the private key is ever exposed, rotate:

1. Run `npx web-push generate-vapid-keys --json` again.
2. Update both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` via
   `supabase secrets set …`.
3. Update `VITE_VAPID_PUBLIC_KEY` in Vercel and redeploy.
4. Truncate `public.push_subscriptions` — every existing subscription
   was bound to the old public key and will now return `410 Gone` on
   the first send. The edge function deletes 410'd rows automatically,
   so you can also let the table drain naturally, but a manual TRUNCATE
   is faster for two users.
5. Every user re-enables nudges from the Dashboard button on their
   next session.

## 7. Disabling the feature

To turn off Nudge globally without removing code:

- Remove `VITE_VAPID_PUBLIC_KEY` from Vercel and redeploy. The button
  hides automatically.
- Optionally remove `VAPID_PUBLIC_KEY` from Supabase secrets so the
  edge function can't be invoked even directly.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Button shows "Push not supported in this browser." | iOS Safari < 16.4 or a browser without `PushManager`. |
| Permission prompt does not appear. | The user previously denied notifications; reset in browser site settings. |
| `delivered: 0, error: "Partner has no devices enrolled for nudges yet."` | Partner hasn't tapped the button on any of their devices. |
| `410 Gone` in function logs | Subscription expired; row is auto-deleted on the next failed send. |
