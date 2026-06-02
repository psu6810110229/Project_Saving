// Supabase Edge Function: notify-partner-deposit
//
// Task 31 (multi-user notification fan-out). Sends a Web Push to every
// other current room member when a deposit is recorded, in addition to
// the in-app notification rows inserted by the `notify_partner_deposit`
// RPC. Modelled on `send-nudge` (auth + push fan-out) and
// `scheduled-saving-reminders` (push gating + recipient locale).
//
// History:
//   - Original (Task P0-007 in 0.9.7): single-recipient. The RPC
//     returned a single `uuid` (or NULL) and this function pushed to
//     one partner.
//   - Task 31: fans push out across all "other" current room members.
//     The RPC now returns `jsonb`:
//        null            → no other members in the room
//        '[]'::jsonb     → other members existed but every per-recipient
//                          insert collided on dedupe
//        non-empty array → one entry per inserted in-app row:
//          [{ notification_id, recipient_user_id }, ...]
//
// Deployment safety: this function tolerates BOTH the legacy `uuid`
// return shape (pre-migration 0055) and the new `jsonb` shape so it can
// be deployed BEFORE the migration without breaking push delivery. The
// legacy branch reads the recipient id back from the notifications row
// and continues with a single-recipient fan-out, exactly matching the
// pre-fan-out behaviour.
//
// Flow:
//   1. Verify the caller is authenticated and parse `log_id`.
//   2. Call `notify_partner_deposit(p_log_id)` with the caller's JWT.
//      Normalise the response into an array of
//      `{ notification_id, recipient_user_id }` entries, tolerating
//      both the legacy uuid and new jsonb return shapes.
//   3. If the array is empty (`null` or `[]` from RPC), return early
//      with `no_partner` / `duplicate`.
//   4. With the service-role client, batch-load notification rows,
//      preferences, profile language, and push subscriptions for all
//      involved recipients.
//   5. For each recipient, evaluate the push gate, build locale-aware
//      copy from that recipient's notification payload, and send Web
//      Push to each of their devices. Expired endpoints (404/410) are
//      cleaned up per recipient.
//   6. Return a structured summary. The caller treats any non-2xx as a
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
import {
  configureWebPush,
  deliverPushToSubscriptions,
  PUSH_SUBSCRIPTION_SELECT,
  type PushSubscriptionRow,
} from '../_shared/pushDelivery.ts';

interface DepositPushPayload {
  log_id?: string;
}

type DepositPushStatus =
  | 'sent'             // push delivered to >=1 device across all recipients
  | 'saved_no_push'    // in-app saved; push skipped or all attempts failed
  | 'partial'          // at least one recipient delivered, at least one didn't
  | 'no_partner'       // RPC returned null (no other members)
  | 'duplicate';       // RPC returned '[]' (every recipient deduped)

interface RecipientResult {
  recipient_user_id: string;
  notification_id: string;
  delivered: number;
  error?: string;
}

interface DepositPushResult {
  status: DepositPushStatus;
  delivered: number;
  notification_ids: string[];
  recipients: RecipientResult[];
  error?: string;
}

interface NormalisedEntry {
  notification_id: string;
  recipient_user_id: string | null;
}

const TARGET_ROUTE = '/dashboard';
const FALLBACK_ROUTE = '/dashboard';
const ALLOWED_ORIGINS = new Set([
  'https://project-saving-brown.vercel.app',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
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

/**
 * Normalise the RPC response to a list of inserted entries.
 *
 * Three shapes are accepted to keep the function safe across the
 * pre-migration / post-migration deploy window:
 *
 *   - string (legacy 0040 shape)           → single recipient
 *   - { notification_id: string } (legacy) → single recipient
 *   - null                                 → no other members
 *   - []                                   → fan-out, all deduped
 *   - [{ notification_id, recipient_user_id }, ...] (new 0055 shape)
 *
 * Returns a `null` outer value to signal "no other members" so callers
 * can distinguish it from "[]" (all deduped). Entries whose
 * `recipient_user_id` we don't already know (legacy single-uuid path)
 * have `recipient_user_id: null` and need a lookup against the
 * notifications row before the push step.
 */
function normaliseRpcReturn(value: unknown): NormalisedEntry[] | null {
  if (value === null || value === undefined) return null;

  // Legacy: a bare uuid string.
  if (typeof value === 'string') {
    return [{ notification_id: value, recipient_user_id: null }];
  }

  // Legacy: `{ notification_id }` object (defensive, not currently emitted).
  if (!Array.isArray(value) && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.notification_id === 'string') {
      const recipient = typeof obj.recipient_user_id === 'string'
        ? obj.recipient_user_id
        : null;
      return [{ notification_id: obj.notification_id, recipient_user_id: recipient }];
    }
    return [];
  }

  // New shape: jsonb array.
  if (Array.isArray(value)) {
    const out: NormalisedEntry[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      if (typeof obj.notification_id !== 'string') continue;
      const recipient = typeof obj.recipient_user_id === 'string'
        ? obj.recipient_user_id
        : null;
      out.push({ notification_id: obj.notification_id, recipient_user_id: recipient });
    }
    return out;
  }

  return [];
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

  // 2. Insert in-app notification rows by invoking the RPC AS the user
  //    so the RPC's `auth.uid()` ownership check passes. The RPC also
  //    handles per-recipient preference gating and dedupe.
  const { data: rpcReturn, error: rpcError } = await callerClient
    .rpc('notify_partner_deposit', { p_log_id: logId });
  if (rpcError) {
    return jsonResponse(req, { error: `notify_partner_deposit: ${rpcError.message}` }, 400);
  }

  const normalised = normaliseRpcReturn(rpcReturn);

  // 2a. No other members. The RPC returned NULL (1-person room).
  if (normalised === null) {
    const result: DepositPushResult = {
      status: 'no_partner',
      delivered: 0,
      notification_ids: [],
      recipients: [],
    };
    return jsonResponse(req, result);
  }

  // 2b. Fan-out happened but every recipient was deduped, OR an
  //     unrecognised non-null shape — treat both as "nothing to push".
  if (normalised.length === 0) {
    const result: DepositPushResult = {
      status: 'duplicate',
      delivered: 0,
      notification_ids: [],
      recipients: [],
    };
    return jsonResponse(req, result);
  }

  // 3. Service-role client for the per-recipient fan-out.
  const admin = createClient(supabaseUrl, serviceKey);

  const notificationIds = normalised.map(e => e.notification_id);

  const { data: notifRows, error: notifFetchError } = await admin
    .from('notifications')
    .select('id, recipient_user_id, room_id, payload, dedupe_key')
    .in('id', notificationIds);
  if (notifFetchError || !notifRows || notifRows.length === 0) {
    const result: DepositPushResult = {
      status: 'saved_no_push',
      delivered: 0,
      notification_ids: notificationIds,
      recipients: [],
      error: 'Saved in-app notification(s) but could not load them for push.',
    };
    return jsonResponse(req, result);
  }

  type NotifRow = {
    id: string;
    recipient_user_id: string;
    room_id: string | null;
    payload: Record<string, unknown> | null;
    dedupe_key: string | null;
  };

  const rowsById = new Map<string, NotifRow>();
  for (const row of notifRows as NotifRow[]) {
    rowsById.set(row.id, row);
  }

  // Build the recipient set from the loaded rows (authoritative) +
  // patch any legacy-shape entries that arrived without a known
  // recipient id.
  const recipientIds = new Set<string>();
  for (const row of notifRows as NotifRow[]) {
    recipientIds.add(row.recipient_user_id);
  }

  if (recipientIds.size === 0) {
    const result: DepositPushResult = {
      status: 'saved_no_push',
      delivered: 0,
      notification_ids: notificationIds,
      recipients: [],
      error: 'No recipient ids resolved from notification rows.',
    };
    return jsonResponse(req, result);
  }

  const recipientList = Array.from(recipientIds);

  // 4. Batch-load preferences, profile language, and subscriptions for
  //    every recipient. Each result is keyed by user id so the
  //    per-recipient loop below can index in O(1).
  const [
    { data: prefsRows },
    { data: profileRows },
    { data: subRows },
  ] = await Promise.all([
    admin
      .from('notification_preferences')
      .select('user_id, master_enabled, partner_activity_enabled')
      .in('user_id', recipientList),
    admin
      .from('profiles')
      .select('id, ui_language')
      .in('id', recipientList),
    admin
      .from('push_subscriptions')
      .select(PUSH_SUBSCRIPTION_SELECT)
      .in('user_id', recipientList),
  ]);

  type PrefsRow = {
    user_id: string;
    master_enabled: boolean | null;
    partner_activity_enabled: boolean | null;
  };
  type ProfileRow = { id: string; ui_language: string | null };
  type SubRow = PushSubscriptionRow;

  const prefsById = new Map<string, PrefsRow>();
  for (const p of (prefsRows ?? []) as PrefsRow[]) prefsById.set(p.user_id, p);
  const langById = new Map<string, string>();
  for (const pr of (profileRows ?? []) as ProfileRow[]) {
    langById.set(pr.id, pr.ui_language ?? 'en');
  }
  const subsByUser = new Map<string, SubRow[]>();
  for (const s of (subRows ?? []) as SubRow[]) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  }

  configureWebPush();

  type AttemptRow = {
    notification_id: string | null;
    recipient_user_id: string;
    push_subscription_id: string | null;
    channel: 'push';
    status: 'sent' | 'failed' | 'expired' | 'skipped';
    error_code: string | null;
    error_message: string | null;
  };
  const attempts: AttemptRow[] = [];
  const recipients: RecipientResult[] = [];
  let totalDelivered = 0;

  // 5. For each loaded in-app row, evaluate the push gate for THAT
  //    recipient and push to their enrolled web/native devices.
  await Promise.all((notifRows as NotifRow[]).map(async (row) => {
    const recipientId = row.recipient_user_id;
    const prefs = prefsById.get(recipientId);
    const masterEnabled = prefs?.master_enabled ?? true;
    const partnerEnabled = prefs?.partner_activity_enabled ?? true;
    const pushAllowed = Boolean(masterEnabled && partnerEnabled);

    if (!pushAllowed) {
      attempts.push({
        notification_id: row.id,
        recipient_user_id: recipientId,
        push_subscription_id: null,
        channel: 'push',
        status: 'skipped',
        error_code: 'prefs_off',
        error_message: null,
      });
      recipients.push({
        recipient_user_id: recipientId,
        notification_id: row.id,
        delivered: 0,
        error: 'Recipient has push notifications off.',
      });
      return;
    }

    const subs = subsByUser.get(recipientId) ?? [];
    if (subs.length === 0) {
      attempts.push({
        notification_id: row.id,
        recipient_user_id: recipientId,
        push_subscription_id: null,
        channel: 'push',
        status: 'skipped',
        error_code: 'no_device',
        error_message: null,
      });
      recipients.push({
        recipient_user_id: recipientId,
        notification_id: row.id,
        delivered: 0,
        error: 'Recipient has no enrolled devices.',
      });
      return;
    }

    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const actorName = typeof payload.actor_name === 'string' ? payload.actor_name : 'Your partner';
    const amount = typeof payload.amount === 'number'
      ? payload.amount
      : Number(payload.amount ?? 0);
    const bucketName = typeof payload.bucket_name === 'string' ? payload.bucket_name : null;
    const recipientLanguage = langById.get(recipientId) ?? 'en';
    const { title, body: bodyText } = buildPushCopy(recipientLanguage, actorName, amount, bucketName);

    const safeUrl = sanitizeRoute(TARGET_ROUTE);
    const safeFallback = sanitizeRoute(FALLBACK_ROUTE);
    const pushPayload = {
      notification_id: row.id,
      event_key: 'partner_deposited',
      title,
      body: bodyText,
      url: safeUrl,
      fallback_url: safeFallback,
      tag: `partner_deposited:${logId}`,
    };

    const delivery = await deliverPushToSubscriptions(
      admin,
      recipientId,
      row.id,
      subs,
      pushPayload,
    );
    attempts.push(...delivery.attempts);
    totalDelivered += delivery.delivered;
    recipients.push({
      recipient_user_id: recipientId,
      notification_id: row.id,
      delivered: delivery.delivered,
      ...(delivery.delivered === 0
        ? { error: 'Push could not be delivered. Notification was saved.' }
        : {}),
    });
  }));

  if (attempts.length > 0) {
    await admin.from('notification_delivery_attempts').insert(attempts);
  }

  // 6. Aggregate status across all recipients:
  //    - `sent`           — every recipient delivered at least once
  //    - `partial`        — some delivered, some didn't (>=1 each)
  //    - `saved_no_push`  — no push delivered to anyone
  let status: DepositPushStatus;
  const delivered = recipients.filter(r => r.delivered > 0).length;
  if (delivered === 0) {
    status = 'saved_no_push';
  } else if (delivered === recipients.length) {
    status = 'sent';
  } else {
    status = 'partial';
  }

  const result: DepositPushResult = {
    status,
    delivered: totalDelivered,
    notification_ids: notificationIds,
    recipients,
    ...(totalDelivered === 0
      ? { error: 'Push could not be delivered to any recipient. Notifications were saved.' }
      : {}),
  };

  return jsonResponse(req, result);
});
