// Supabase Edge Function: notify-partner-deposit
//
// Task P0-007 (0.9.7 bugfix pass). Sends a Web Push to the partner
// every time a deposit is recorded, in addition to the existing in-app
// notification. Modelled on `send-nudge` (auth + push fan-out) and
// `scheduled-saving-reminders` (push gating + recipient locale).
//
// Flow:
//   1. Verify the caller is authenticated and parse `log_id`.
//   2. Call `notify_partner_deposit(p_log_id)` with the caller's JWT.
//      The RPC validates that the caller owns the log, resolves the
//      partner, gates on the recipient's
//      `master_enabled + partner_activity_enabled` preferences, and
//      inserts the in-app notification row with `ON CONFLICT (recipient,
//      dedupe_key) DO NOTHING`. The returned notification id is null
//      when:
//        a) the room has no partner yet,
//        b) the recipient disabled master / partner-activity,
//        c) the dedupe key already exists for this log + recipient.
//      In all three cases there is nothing to push, so we return early.
//   3. With the service-role client (still scoped to a single recipient
//      whose id came back from the RPC), look up the saved notification
//      row, the recipient's `push_enabled` preference, and the
//      recipient's `ui_language` for Thai copy selection.
//   4. If `push_enabled` is true and the recipient has at least one
//      active subscription, send Web Push to each device. Expired
//      endpoints (404/410) are cleaned up like in `send-nudge`.
//   5. Return a structured summary. The caller treats any non-2xx as a
//      "log + continue" event — the deposit save must never depend on
//      this function succeeding.
//
// Required Edge Function secrets:
//   - SUPABASE_URL                 (auto-injected)
//   - SUPABASE_ANON_KEY            (auto-injected)
//   - SUPABASE_SERVICE_ROLE_KEY    (service-role key)
//   - VAPID_PUBLIC_KEY             (matches VITE_VAPID_PUBLIC_KEY)
//   - VAPID_PRIVATE_KEY
//   - VAPID_SUBJECT                (e.g. "mailto:fran@example.com")
//
// See docs/vapid-runbook.md for VAPID setup.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'https://esm.sh/web-push@3.6.7';

interface DepositPushPayload {
  log_id?: string;
}

type DepositPushStatus =
  | 'sent'             // push delivered to >=1 device
  | 'saved_no_push'    // in-app saved; push skipped or all failed
  | 'no_partner'       // RPC returned null (no partner or dedupe)
  | 'duplicate';       // alias for no_partner when dedupe collided

interface DepositPushResult {
  status: DepositPushStatus;
  delivered: number;
  notification_id: string | null;
  error?: string;
}

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

// Locale-aware push copy. The in-app row keeps the English title/body
// inserted by the RPC; P2-004 will localize the in-app row separately.
// Here we only override the push payload so a Thai user immediately
// sees Thai on their lock screen.
function buildPushCopy(
  language: string | null | undefined,
  actorName: string,
  amount: number,
  bucketName: string | null,
): { title: string; body: string } {
  const safeActor = actorName.trim().length > 0 ? actorName.trim() : 'Your partner';
  const formattedAmount = Number.isFinite(amount)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(amount))
    : String(amount);
  const trimmedBucket = bucketName?.trim() || null;

  if (language === 'th') {
    const thaiActor = actorName.trim().length > 0 ? actorName.trim() : 'คู่ของคุณ';
    const bucketSuffix = trimmedBucket
      ? `สำหรับ ${trimmedBucket}`
      : '';
    return {
      title: `${thaiActor} เพิ่มเงินออม`,
      body: `บันทึก ฿${formattedAmount}${bucketSuffix ? ' ' + bucketSuffix : ''} แล้ว`,
    };
  }

  return {
    title: `${safeActor} added savings`,
    body: trimmedBucket
      ? `฿${formattedAmount} was recorded for ${trimmedBucket}.`
      : `฿${formattedAmount} was recorded.`,
  };
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

  // 1. Caller identity. The RPC in step 2 also enforces auth via
  //    `auth.uid()`, but we authenticate explicitly here so the
  //    function returns a clean 401 on missing/invalid tokens instead
  //    of leaking RPC error text.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse(req, { error: 'Invalid auth' }, 401);
  }

  const body = (await req.json().catch(() => null)) as DepositPushPayload | null;
  if (!body || !body.log_id) {
    return jsonResponse(req, { error: 'log_id required' }, 400);
  }
  const logId = body.log_id;

  // 2. Insert the in-app notification by invoking the RPC AS the user
  //    so the RPC's `auth.uid()` ownership check passes. The RPC also
  //    handles partner resolution, preference gating, and dedupe.
  const { data: notificationId, error: rpcError } = await callerClient
    .rpc('notify_partner_deposit', { p_log_id: logId });
  if (rpcError) {
    return jsonResponse(req, { error: `notify_partner_deposit: ${rpcError.message}` }, 400);
  }
  if (!notificationId || typeof notificationId !== 'string') {
    // RPC returned NULL — no partner, prefs disabled, or dedupe hit.
    const result: DepositPushResult = {
      status: 'no_partner',
      delivered: 0,
      notification_id: null,
    };
    return jsonResponse(req, result);
  }

  // 3. Pull recipient context with the service-role client (the saved
  //    row, recipient prefs, recipient profile language, and active
  //    push subscriptions).
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: notifRow, error: notifFetchError } = await admin
    .from('notifications')
    .select('id, recipient_user_id, room_id, payload, dedupe_key')
    .eq('id', notificationId)
    .maybeSingle();
  if (notifFetchError || !notifRow) {
    return jsonResponse(req, {
      status: 'saved_no_push',
      delivered: 0,
      notification_id: notificationId,
      error: 'Saved in-app notification but could not load it for push.',
    } satisfies DepositPushResult);
  }

  const recipientId = notifRow.recipient_user_id as string;

  const { data: prefs } = await admin
    .from('notification_preferences')
    .select('master_enabled, push_enabled, partner_activity_enabled')
    .eq('user_id', recipientId)
    .maybeSingle();
  // Mirror the 0037 defaults when no row exists (master=true,
  // partner_activity=true, push=false). The RPC already gated the
  // in-app row on master + partner_activity, so re-checking here is
  // belt-and-braces for push only.
  const masterEnabled = prefs?.master_enabled ?? true;
  const partnerEnabled = prefs?.partner_activity_enabled ?? true;
  const pushEnabled = prefs?.push_enabled ?? false;
  const pushAllowed = Boolean(masterEnabled && partnerEnabled && pushEnabled);

  if (!pushAllowed) {
    const result: DepositPushResult = {
      status: 'saved_no_push',
      delivered: 0,
      notification_id: notificationId,
      error: 'Recipient has push notifications off.',
    };
    return jsonResponse(req, result);
  }

  const { data: profileRow } = await admin
    .from('profiles')
    .select('ui_language')
    .eq('id', recipientId)
    .maybeSingle();
  const recipientLanguage = (profileRow?.ui_language as string | null | undefined) ?? 'en';

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .eq('user_id', recipientId);

  if (!subs || subs.length === 0) {
    const result: DepositPushResult = {
      status: 'saved_no_push',
      delivered: 0,
      notification_id: notificationId,
      error: 'Recipient has no enrolled devices.',
    };
    return jsonResponse(req, result);
  }

  // 4. Build payload + send. Locale-aware copy is derived from the
  //    payload the RPC stored, not from any client-supplied data.
  const payload = (notifRow.payload ?? {}) as Record<string, unknown>;
  const actorName = typeof payload.actor_name === 'string' ? payload.actor_name : 'Your partner';
  const amount = typeof payload.amount === 'number'
    ? payload.amount
    : Number(payload.amount ?? 0);
  const bucketName = typeof payload.bucket_name === 'string' ? payload.bucket_name : null;
  const { title, body: bodyText } = buildPushCopy(recipientLanguage, actorName, amount, bucketName);

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const safeUrl = sanitizeRoute(TARGET_ROUTE);
  const safeFallback = sanitizeRoute(FALLBACK_ROUTE);
  const pushPayload = JSON.stringify({
    notification_id: notificationId,
    event_key: 'partner_deposited',
    title,
    body: bodyText,
    url: safeUrl,
    fallback_url: safeFallback,
    tag: `partner_deposited:${logId}`,
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
        recipient_user_id: recipientId,
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
          recipient_user_id: recipientId,
          push_subscription_id: sub.id,
          channel: 'push',
          status: 'expired',
          error_code: String(status),
          error_message: null,
        });
      } else {
        attempts.push({
          notification_id: notificationId,
          recipient_user_id: recipientId,
          push_subscription_id: sub.id,
          channel: 'push',
          status: 'failed',
          error_code: status ? String(status) : null,
          error_message: message,
        });
      }
    }
  }));

  if (attempts.length > 0) {
    await admin.from('notification_delivery_attempts').insert(attempts);
  }

  // Sender does not get a self-push: the RPC resolved the recipient as
  // the OTHER room member, so the actor is never the recipient and the
  // push fan-out above only targets the partner's subscriptions.
  const result: DepositPushResult = {
    status: delivered > 0 ? 'sent' : 'saved_no_push',
    delivered,
    notification_id: notificationId,
    ...(delivered === 0 ? { error: 'Push could not be delivered. Notification was saved.' } : {}),
  };

  return jsonResponse(req, result);
});
