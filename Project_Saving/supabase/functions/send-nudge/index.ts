// Supabase Edge Function: send-nudge
//
// Triggered by the client (POST with a bearer JWT) when a user taps the
// Nudge button. The function:
//   1. Verifies the caller is authenticated.
//   2. Throttles: rejects if the caller has nudged the same target
//      within the last 5 minutes.
//   3. Looks up all push_subscriptions rows for the target user
//      (service-role read; the table's RLS forbids cross-user SELECT
//      from the client).
//   4. Encrypts and POSTs a Web Push payload to each endpoint using
//      VAPID auth.
//   5. Inserts a row into public.nudges for audit / throttling.
//
// Required Edge Function secrets (set via `supabase secrets set ...`):
//   - SUPABASE_URL                 (auto-injected)
//   - SUPABASE_ANON_KEY            (auto-injected)
//   - SUPABASE_SERVICE_ROLE_KEY    (service-role key)
//   - VAPID_PUBLIC_KEY             (matches client VITE_VAPID_PUBLIC_KEY)
//   - VAPID_PRIVATE_KEY
//   - VAPID_SUBJECT                (e.g. "mailto:fran@example.com")
//
// See docs/vapid-runbook.md for how to generate these and register
// the function with the Supabase project.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'https://esm.sh/web-push@3.6.7';

interface NudgePayload {
  to_user_id: string;
  room_id?: string | null;
  message?: string;
}

const THROTTLE_SECONDS = 300;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@example.com';

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Invalid auth' }), { status: 401 });
  }
  const fromUser = userData.user;

  const body = (await req.json()) as NudgePayload;
  if (!body.to_user_id) {
    return new Response(JSON.stringify({ error: 'to_user_id required' }), { status: 400 });
  }
  if (body.to_user_id === fromUser.id) {
    return new Response(JSON.stringify({ error: 'cannot nudge yourself' }), { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Throttle: 5-minute cooldown per (from, to) pair.
  const sinceIso = new Date(Date.now() - THROTTLE_SECONDS * 1000).toISOString();
  const { data: recent } = await admin
    .from('nudges')
    .select('id, created_at')
    .eq('from_user', fromUser.id)
    .eq('to_user', body.to_user_id)
    .gte('created_at', sinceIso)
    .limit(1);
  if (recent && recent.length > 0) {
    return new Response(
      JSON.stringify({ error: 'Slow down — please wait a few minutes before nudging again.' }),
      { status: 429 },
    );
  }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('user_id', body.to_user_id);

  if (!subs || subs.length === 0) {
    return new Response(
      JSON.stringify({ delivered: 0, error: 'Partner has no devices enrolled for nudges yet.' }),
      { status: 404 },
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const payload = JSON.stringify({
    title: `${fromUser.user_metadata?.full_name ?? 'Your partner'} sent a nudge`,
    body: body.message ?? 'Time to add to the vault!',
    url: '/dashboard',
  });

  let delivered = 0;
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload,
      );
      delivered += 1;
    } catch (error) {
      // 410 = subscription expired. Clean it up so we don't keep retrying.
      const status = typeof error === 'object' && error && 'statusCode' in error
        ? Number((error as { statusCode: number }).statusCode)
        : 0;
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }));

  await admin.from('nudges').insert({
    from_user: fromUser.id,
    to_user: body.to_user_id,
    room_id: body.room_id ?? null,
  });

  return new Response(JSON.stringify({ delivered }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
