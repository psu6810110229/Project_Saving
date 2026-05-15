// Supabase Edge Function: send-nudge
//
// Hardened in Task 23.2. The function is now the canonical event
// source for `nudge_received` notifications. It:
//   1. Verifies the caller is authenticated and not nudging themselves.
//   2. Requires `room_id` and validates both sender and recipient are
//      current members of that room (room_members lookup).
//   3. Throttles per (from_user, to_user, room_id) at 5 minutes —
//      throttled requests do NOT create a notification or a nudge
//      audit row.
//   4. Inserts a row into `public.nudges` to anchor the dedupe key.
//   5. Creates an in-app `notifications` row for the recipient,
//      regardless of push outcome. This row is the source of truth
//      for the in-app Notification Center.
//   6. Loads the recipient's notification preferences and decides
//      whether push is allowed: master_enabled AND nudges_enabled
//      AND push_enabled.
//   7. If allowed, sends Web Push to every active subscription with
//      a sanitized payload that includes notification_id, url,
//      fallback_url. Expired endpoints (404/410) are cleaned up.
//   8. Returns a structured response with `status`, `delivered`,
//      `notification_id`, and `error` so the sender UI can show
//      clear feedback.
//
// Required Edge Function secrets:
//   - SUPABASE_URL                 (auto-injected)
//   - SUPABASE_ANON_KEY            (auto-injected)
//   - SUPABASE_SERVICE_ROLE_KEY    (service-role key)
//   - VAPID_PUBLIC_KEY             (matches client VITE_VAPID_PUBLIC_KEY)
//   - VAPID_PRIVATE_KEY
//   - VAPID_SUBJECT                (e.g. "mailto:fran@example.com")
//
// See docs/vapid-runbook.md for VAPID setup.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'https://esm.sh/web-push@3.6.7';

interface NudgePayload {
  to_user_id: string;
  room_id?: string | null;
  message?: string;
}

type NudgeStatus =
  | 'sent'             // push delivered to >=1 device
  | 'saved_no_push'    // notification saved; push skipped (prefs off, no subs, or all failed)
  | 'throttled';       // recent nudge exists; nothing created

interface NudgeResult {
  status: NudgeStatus;
  delivered: number;
  notification_id: string | null;
  error?: string;
}

const THROTTLE_SECONDS = 300;
const TARGET_ROUTE = '/dashboard';
const FALLBACK_ROUTE = '/dashboard';
const ALLOWED_ORIGINS = new Set([
  'https://project-saving-brown.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const CORS_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type';
const CORS_ALLOW_METHODS = 'OPTIONS, POST';
const ALLOWED_PUSH_PREFIXES = [
  '/dashboard',
  '/add',
  '/check-balance',
  '/saving-plan',
  '/manage-project',
  '/notifications',
];

function sanitizeRoute(route: string | null | undefined): string {
  if (!route) return FALLBACK_ROUTE;
  if (!route.startsWith('/')) return FALLBACK_ROUTE;
  if (route.startsWith('//')) return FALLBACK_ROUTE;
  const matched = ALLOWED_PUSH_PREFIXES.some(prefix =>
    route === prefix || route.startsWith(`${prefix}?`) || route.startsWith(`${prefix}/`),
  );
  return matched ? route : FALLBACK_ROUTE;
}

function corsHeadersFor(req: Request): HeadersInit {
  const origin = req.headers.get('Origin');
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : 'https://project-saving-brown.vercel.app';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
    'Vary': 'Origin',
  };
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersFor(req),
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeadersFor(req),
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse(req, { error: 'Missing auth' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@example.com';

  // 1. Caller identity.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse(req, { error: 'Invalid auth' }, 401);
  }
  const fromUser = userData.user;

  const body = (await req.json().catch(() => null)) as NudgePayload | null;
  if (!body || !body.to_user_id) {
    return jsonResponse(req, { error: 'to_user_id required' }, 400);
  }
  if (!body.room_id) {
    return jsonResponse(req, { error: 'room_id required' }, 400);
  }
  if (body.to_user_id === fromUser.id) {
    return jsonResponse(req, { error: 'cannot nudge yourself' }, 400);
  }

  const toUserId = body.to_user_id;
  const roomId = body.room_id;

  const admin = createClient(supabaseUrl, serviceKey);

  // 2. Both sender and recipient must be current members of room_id.
  const { data: members, error: membersError } = await admin
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .in('user_id', [fromUser.id, toUserId]);
  if (membersError) {
    return jsonResponse(req, { error: 'Could not verify room membership.' }, 500);
  }
  const memberIds = new Set((members ?? []).map(row => row.user_id));
  if (!memberIds.has(fromUser.id) || !memberIds.has(toUserId)) {
    return jsonResponse(req, { error: 'Sender and recipient must share the same project.' }, 403);
  }

  // 3. Throttle per (from, to, room).
  const sinceIso = new Date(Date.now() - THROTTLE_SECONDS * 1000).toISOString();
  const { data: recent } = await admin
    .from('nudges')
    .select('id, created_at')
    .eq('from_user', fromUser.id)
    .eq('to_user', toUserId)
    .eq('room_id', roomId)
    .gte('created_at', sinceIso)
    .limit(1);
  if (recent && recent.length > 0) {
    const result: NudgeResult = {
      status: 'throttled',
      delivered: 0,
      notification_id: null,
      error: 'Slow down — please wait a few minutes before nudging again.',
    };
    return jsonResponse(req, result, 429);
  }

  // 4. Insert the nudge audit row first so the notification dedupe
  //    key can pin to a real nudge id.
  const { data: nudgeRow, error: nudgeError } = await admin
    .from('nudges')
    .insert({ from_user: fromUser.id, to_user: toUserId, room_id: roomId })
    .select('id')
    .single();
  if (nudgeError || !nudgeRow) {
    return jsonResponse(req, { error: 'Could not record nudge.' }, 500);
  }
  const nudgeId = nudgeRow.id as string;

  // 5. Resolve sender display name for the notification copy.
  const { data: profileRow } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', fromUser.id)
    .maybeSingle();
  const senderName =
    profileRow?.display_name?.trim()
    || (fromUser.user_metadata?.full_name as string | undefined)
    || 'Your partner';

  const notificationTitle = `${senderName} sent a nudge`;
  const notificationBody = 'They are checking in on the shared goal.';

  // 6. Create the in-app notification row. We always do this on a
  //    successful (non-throttled) nudge so the recipient's center has
  //    a record even if push prefs are off or no devices are enrolled.
  const dedupeKey = `nudge:${nudgeId}:${toUserId}`;
  const { data: notifRow, error: notifError } = await admin
    .from('notifications')
    .insert({
      recipient_user_id: toUserId,
      actor_user_id: fromUser.id,
      room_id: roomId,
      event_key: 'nudge_received',
      category: 'nudge',
      channel_policy: 'push_candidate',
      title: notificationTitle,
      body: notificationBody,
      cta_label: 'Open Dashboard',
      target_route: TARGET_ROUTE,
      target_section: null,
      fallback_route: FALLBACK_ROUTE,
      push_safe: true,
      payload: { sender_id: fromUser.id, sender_name: senderName, nudge_id: nudgeId },
      source_table: 'nudges',
      source_id: nudgeId,
      dedupe_key: dedupeKey,
    })
    .select('id')
    .single();

  if (notifError && notifError.code !== '23505') {
    // 23505 = unique_violation; if dedupe already exists treat as no-op success
    // and continue trying to push to subscribed devices. Anything else is fatal.
    return jsonResponse(req, { error: 'Could not create notification.' }, 500);
  }
  const notificationId = (notifRow?.id as string | undefined) ?? null;

  // 7. Load recipient preferences. Service role bypasses RLS so we can
  //    upsert defaults if the recipient has not opened the settings page
  //    yet — keeps push gating consistent without forcing them to.
  await admin
    .from('notification_preferences')
    .upsert({ user_id: toUserId }, { onConflict: 'user_id', ignoreDuplicates: true });
  const { data: prefs } = await admin
    .from('notification_preferences')
    .select('master_enabled, push_enabled, nudges_enabled')
    .eq('user_id', toUserId)
    .maybeSingle();

  const pushAllowed = Boolean(
    prefs?.master_enabled && prefs?.push_enabled && prefs?.nudges_enabled,
  );

  if (!pushAllowed) {
    const result: NudgeResult = {
      status: 'saved_no_push',
      delivered: 0,
      notification_id: notificationId,
      error: 'Partner has push notifications off.',
    };
    return jsonResponse(req, result);
  }

  // 8. Look up active subscriptions for the recipient.
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .eq('user_id', toUserId);

  if (!subs || subs.length === 0) {
    const result: NudgeResult = {
      status: 'saved_no_push',
      delivered: 0,
      notification_id: notificationId,
      error: 'Partner has no devices enrolled for nudges yet.',
    };
    return jsonResponse(req, result);
  }

  // 9. Send push to every device. Cleanup expired endpoints.
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const safeUrl = sanitizeRoute(TARGET_ROUTE);
  const safeFallback = sanitizeRoute(FALLBACK_ROUTE);
  const pushPayload = JSON.stringify({
    notification_id: notificationId,
    event_key: 'nudge_received',
    title: notificationTitle,
    body: notificationBody,
    url: safeUrl,
    fallback_url: safeFallback,
    tag: `nudge:${nudgeId}`,
  });

  let delivered = 0;
  type AttemptRow = {
    notification_id: string | null;
    recipient_user_id: string;
    push_subscription_id: string | null;
    channel: 'push';
    status: 'sent' | 'failed' | 'expired';
    error_code: string | null;
    error_message: string | null;
  };
  const attempts: AttemptRow[] = [];

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        pushPayload,
      );
      delivered += 1;
      attempts.push({
        notification_id: notificationId,
        recipient_user_id: toUserId,
        push_subscription_id: sub.id,
        channel: 'push',
        status: 'sent',
        error_code: null,
        error_message: null,
      });
    } catch (error) {
      const status = typeof error === 'object' && error && 'statusCode' in error
        ? Number((error as { statusCode: number }).statusCode)
        : 0;
      const message = typeof error === 'object' && error && 'message' in error
        ? String((error as { message: string }).message).slice(0, 500)
        : null;
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        attempts.push({
          notification_id: notificationId,
          recipient_user_id: toUserId,
          push_subscription_id: sub.id,
          channel: 'push',
          status: 'expired',
          error_code: String(status),
          error_message: null,
        });
      } else {
        attempts.push({
          notification_id: notificationId,
          recipient_user_id: toUserId,
          push_subscription_id: sub.id,
          channel: 'push',
          status: 'failed',
          error_code: status ? String(status) : null,
          error_message: message,
        });
      }
    }
  }));

  // 10. Persist push delivery attempts. The table is debug audit
  //     only — clients don't read it. Failures are non-fatal so a
  //     missing row never breaks the sender feedback.
  if (attempts.length > 0) {
    await admin.from('notification_delivery_attempts').insert(attempts);
  }

  const result: NudgeResult = {
    status: delivered > 0 ? 'sent' : 'saved_no_push',
    delivered,
    notification_id: notificationId,
    ...(delivered === 0 ? { error: 'Push could not be delivered. Notification was saved.' } : {}),
  };

  return jsonResponse(req, result);
});
