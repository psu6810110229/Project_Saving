// Supabase Edge Function: scheduled-saving-reminders
//
// Task 23.3. Designed to be triggered by a cron (Supabase Scheduled
// Functions when available, or Vercel Cron hitting this URL). The
// function:
//   1. Authenticates the caller via a shared secret (`CRON_SECRET`)
//      from either `Authorization: Bearer <secret>` or
//      `X-Cron-Secret: <secret>`.
//      In non-local environments, `CRON_SECRET` is required. If it's
//      missing or mismatched, the function exits before reminder RPCs.
//   2. Invokes `public.enqueue_saving_plan_reminders()` with the
//      service role. The RPC owns ALL eligibility logic (active
//      plan, latest revision, end-date, pauses, deposit-in-cadence
//      check, user preferences, Bangkok-day/week/month dedupe). It
//      returns one row per newly inserted notification.
//   3. For each new notification, checks `push_enabled` on the
//      recipient's notification_preferences (the RPC already enforces
//      master_enabled + saving_reminders_enabled) and sends Web Push
//      to every active subscription. Expired endpoints (404/410)
//      are deleted. Notification creation has already succeeded; a
//      push failure does not roll back the in-app row.
//   4. Returns a summary so a manual run can be eyeballed.
//
// Required Edge Function secrets (in addition to the standard
// SUPABASE_* keys):
//   - VAPID_PUBLIC_KEY
//   - VAPID_PRIVATE_KEY
//   - VAPID_SUBJECT
//   - CRON_SECRET            (required outside local/dev)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'https://esm.sh/web-push@3.6.7';

interface EnqueuedRow {
  notification_id: string;
  recipient_user_id: string;
  plan_id: string;
  room_id: string | null;
  cadence: string;
  period_key: string;
}

interface RemindersSummary {
  created: number;
  push_attempted: number;
  push_delivered: number;
  push_skipped_no_prefs: number;
  push_skipped_no_devices: number;
  cleanup_notifications_deleted: number;
  cleanup_delivery_attempts_deleted: number;
  errors: string[];
}

interface AttemptInsert {
  notification_id: string;
  recipient_user_id: string;
  push_subscription_id: string | null;
  channel: 'push';
  status: 'sent' | 'failed' | 'expired';
  error_code: string | null;
  error_message: string | null;
}

const TARGET_ROUTE = '/saving-plan';
const FALLBACK_ROUTE = '/saving-plan';
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isLocalLikeEnvironment(): boolean {
  const envHint = (
    Deno.env.get('APP_ENV')
    ?? Deno.env.get('ENV')
    ?? Deno.env.get('NODE_ENV')
    ?? Deno.env.get('DENO_ENV')
    ?? ''
  ).toLowerCase();
  if (['local', 'development', 'dev', 'test'].includes(envHint)) {
    return true;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.toLowerCase() ?? '';
  return supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1');
}

function readProvidedSecret(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (auth) {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }
  const cronHeader = req.headers.get('X-Cron-Secret');
  return cronHeader?.trim() || null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const isLocalLike = isLocalLikeEnvironment();
  const expectedSecret = Deno.env.get('CRON_SECRET');
  if (!expectedSecret) {
    if (!isLocalLike) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }
  } else {
    const provided = readProvidedSecret(req);
    if (!provided) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    if (provided !== expectedSecret) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@example.com';

  const admin = createClient(supabaseUrl, serviceKey);

  const summary: RemindersSummary = {
    created: 0,
    push_attempted: 0,
    push_delivered: 0,
    push_skipped_no_prefs: 0,
    push_skipped_no_devices: 0,
    cleanup_notifications_deleted: 0,
    cleanup_delivery_attempts_deleted: 0,
    errors: [],
  };

  // 0. Retention cleanup. Each call is bounded by the date cutoff
  //    inside the RPC, so running every scheduler tick stays cheap
  //    once the backlog clears. Failures are non-fatal — we still
  //    want reminders to fire.
  const { data: notifDeleted, error: cleanupNotifErr } = await admin
    .rpc('cleanup_old_notifications', { p_days_old: 90 });
  if (cleanupNotifErr) {
    summary.errors.push(`cleanup_old_notifications: ${cleanupNotifErr.message}`);
  } else {
    summary.cleanup_notifications_deleted = typeof notifDeleted === 'number'
      ? notifDeleted
      : Number(notifDeleted ?? 0);
  }

  const { data: attemptsDeleted, error: cleanupAttErr } = await admin
    .rpc('cleanup_old_delivery_attempts', { p_days_old: 30 });
  if (cleanupAttErr) {
    summary.errors.push(`cleanup_old_delivery_attempts: ${cleanupAttErr.message}`);
  } else {
    summary.cleanup_delivery_attempts_deleted = typeof attemptsDeleted === 'number'
      ? attemptsDeleted
      : Number(attemptsDeleted ?? 0);
  }

  // 1. Run eligibility + dedupe + insert in a single SQL pass.
  const { data, error } = await admin.rpc('enqueue_saving_plan_reminders');
  if (error) {
    return jsonResponse({ ...summary, error: error.message }, 500);
  }
  const created = (data ?? []) as EnqueuedRow[];
  summary.created = created.length;

  if (created.length === 0) {
    console.info('[saving-reminders] enqueue produced no rows (time gate, dedupe, prefs, or no candidates)');
    return jsonResponse(summary);
  }

  console.info(
    `[saving-reminders] enqueue created=${created.length} recipients=${
      new Set(created.map((r) => r.recipient_user_id)).size
    }`,
  );

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const recipientIds = Array.from(new Set(created.map(row => row.recipient_user_id)));

  // 2. Pull push prefs and subscriptions for the affected recipients
  //    in one round trip each.
  const { data: prefsRows } = await admin
    .from('notification_preferences')
    .select('user_id, push_enabled')
    .in('user_id', recipientIds);
  const pushEnabledFor = new Map<string, boolean>();
  for (const row of (prefsRows ?? []) as { user_id: string; push_enabled: boolean }[]) {
    pushEnabledFor.set(row.user_id, Boolean(row.push_enabled));
  }

  const { data: subRows } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth_key')
    .in('user_id', recipientIds);
  const subsFor = new Map<string, Array<{ id: string; endpoint: string; p256dh: string; auth_key: string }>>();
  for (const sub of (subRows ?? []) as Array<{ id: string; user_id: string; endpoint: string; p256dh: string; auth_key: string }>) {
    if (!subsFor.has(sub.user_id)) subsFor.set(sub.user_id, []);
    subsFor.get(sub.user_id)!.push(sub);
  }

  // 3. Deliver push for each newly created notification.
  const safeUrl = sanitizeRoute(TARGET_ROUTE);
  const safeFallback = sanitizeRoute(FALLBACK_ROUTE);
  const attempts: AttemptInsert[] = [];

  for (const note of created) {
    if (!pushEnabledFor.get(note.recipient_user_id)) {
      summary.push_skipped_no_prefs += 1;
      console.warn(
        `[saving-reminders] skip recipient=${note.recipient_user_id} plan=${note.plan_id} reason=push_disabled`,
      );
      continue;
    }
    const subs = subsFor.get(note.recipient_user_id) ?? [];
    if (subs.length === 0) {
      summary.push_skipped_no_devices += 1;
      console.warn(
        `[saving-reminders] skip recipient=${note.recipient_user_id} plan=${note.plan_id} reason=no_devices`,
      );
      continue;
    }

    const payload = JSON.stringify({
      notification_id: note.notification_id,
      event_key: 'saving_reminder_due',
      title: 'Saving reminder',
      body: 'A small update keeps your plan current.',
      url: safeUrl,
      fallback_url: safeFallback,
      tag: `saving_reminder:${note.plan_id}:${note.cadence}:${note.period_key}`,
    });

    await Promise.all(subs.map(async (sub) => {
      summary.push_attempted += 1;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload,
        );
        summary.push_delivered += 1;
        attempts.push({
          notification_id: note.notification_id,
          recipient_user_id: note.recipient_user_id,
          push_subscription_id: sub.id,
          channel: 'push',
          status: 'sent',
          error_code: null,
          error_message: null,
        });
      } catch (err) {
        const status = typeof err === 'object' && err && 'statusCode' in err
          ? Number((err as { statusCode: number }).statusCode)
          : 0;
        const message = typeof err === 'object' && err && 'message' in err
          ? String((err as { message: string }).message)
          : 'push failed';
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          attempts.push({
            notification_id: note.notification_id,
            recipient_user_id: note.recipient_user_id,
            push_subscription_id: sub.id,
            channel: 'push',
            status: 'expired',
            error_code: String(status),
            error_message: null,
          });
        } else {
          summary.errors.push(`${sub.endpoint.slice(0, 32)}...: ${message}`);
          attempts.push({
            notification_id: note.notification_id,
            recipient_user_id: note.recipient_user_id,
            push_subscription_id: sub.id,
            channel: 'push',
            status: 'failed',
            error_code: status ? String(status) : null,
            error_message: message.slice(0, 500),
          });
        }
      }
    }));
  }

  // 4. Persist delivery attempts in a single batched insert. The
  //    table is debug-grade audit only; failures are non-fatal.
  if (attempts.length > 0) {
    const { error: attemptErr } = await admin
      .from('notification_delivery_attempts')
      .insert(attempts);
    if (attemptErr) {
      summary.errors.push(`delivery_attempts insert: ${attemptErr.message}`);
    }
  }

  return jsonResponse(summary);
});
