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
//   3. For each new notification, checks subscription existence for the
//      recipient (the RPC already enforces master_enabled +
//      saving_reminders_enabled). push_enabled is informational only —
//      subscription existence is the source of truth. Expired endpoints
//      (404/410) are deleted. Notification creation has already succeeded;
//      a push failure does not roll back the in-app row.
//   4. Returns a summary so a manual run can be eyeballed.
//
// Required Edge Function secrets (in addition to the standard
// SUPABASE_* keys):
//   - VAPID_PUBLIC_KEY
//   - VAPID_PRIVATE_KEY
//   - VAPID_SUBJECT
//   - CRON_SECRET            (required outside local/dev)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  configureWebPush,
  deliverPushToSubscriptions,
  PUSH_SUBSCRIPTION_SELECT,
  type AttemptRow,
  type PushSubscriptionRow,
} from '../_shared/pushDelivery.ts';

interface EnqueuedRow {
  notification_id: string;
  recipient_user_id: string;
  plan_id: string;
  room_id: string | null;
  cadence: string;
  period_key: string;
}

interface PlanStartRow {
  notification_id: string;
  recipient_user_id: string;
  plan_id: string;
  room_id: string | null;
  start_date: string;
}

interface RemindersSummary {
  created: number;
  plan_starts_created: number;
  push_attempted: number;
  push_delivered: number;
  push_skipped_no_prefs: number;
  push_skipped_no_devices: number;
  cleanup_notifications_deleted: number;
  cleanup_delivery_attempts_deleted: number;
  errors: string[];
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

  const admin = createClient(supabaseUrl, serviceKey);

  const summary: RemindersSummary = {
    created: 0,
    plan_starts_created: 0,
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

  // 1. Run eligibility + dedupe + insert for the saving-reminder path.
  //    A failure here is fatal: existing reminder behavior must not be
  //    masked by the additive plan-start path.
  const { data: reminderData, error: reminderError } = await admin.rpc('enqueue_saving_plan_reminders');
  if (reminderError) {
    return jsonResponse({ ...summary, error: reminderError.message }, 500);
  }
  const created = (reminderData ?? []) as EnqueuedRow[];
  summary.created = created.length;

  // 1b. Plan-start RPC is additive. Its time gate is independent of the
  //     reminder RPC's, so an error here is logged and non-fatal —
  //     matching the cleanup-RPC pattern above.
  const { data: planStartData, error: planStartError } = await admin.rpc('enqueue_plan_start_notifications');
  if (planStartError) {
    summary.errors.push(`enqueue_plan_start_notifications: ${planStartError.message}`);
  }
  const planStarts = (planStartData ?? []) as PlanStartRow[];
  summary.plan_starts_created = planStarts.length;

  if (created.length === 0 && planStarts.length === 0) {
    console.info('[saving-reminders] enqueue produced no rows (time gate, dedupe, prefs, or no candidates)');
    return jsonResponse(summary);
  }

  console.info(
    `[saving-reminders] enqueue reminders=${created.length} plan_starts=${planStarts.length} recipients=${
      new Set([
        ...created.map((r) => r.recipient_user_id),
        ...planStarts.map((r) => r.recipient_user_id),
      ]).size
    }`,
  );

  configureWebPush();

  const recipientIds = Array.from(new Set([
    ...created.map(row => row.recipient_user_id),
    ...planStarts.map(row => row.recipient_user_id),
  ]));

  // 2. Pull push prefs and subscriptions for the affected recipients
  //    in one round trip each.
  // push_enabled is no longer a gate — subscription existence is the truth.
  // The enqueue RPCs already enforce master_enabled + saving_reminders_enabled,
  // so no additional prefs query is needed here.

  const { data: subRows } = await admin
    .from('push_subscriptions')
    .select(PUSH_SUBSCRIPTION_SELECT)
    .in('user_id', recipientIds);
  const subsFor = new Map<string, PushSubscriptionRow[]>();
  for (const sub of (subRows ?? []) as PushSubscriptionRow[]) {
    const list = subsFor.get(sub.user_id) ?? [];
    list.push(sub);
    subsFor.set(sub.user_id, list);
  }

  // 3. Deliver push for each newly created notification.
  const safeUrl = sanitizeRoute(TARGET_ROUTE);
  const safeFallback = sanitizeRoute(FALLBACK_ROUTE);
  const attempts: AttemptRow[] = [];

  for (const note of created) {
    const subs = subsFor.get(note.recipient_user_id) ?? [];
    if (subs.length === 0) {
      summary.push_skipped_no_devices += 1;
      console.warn(
        `[saving-reminders] skip recipient=${note.recipient_user_id} plan=${note.plan_id} reason=no_devices`,
      );
      attempts.push({
        notification_id: note.notification_id,
        recipient_user_id: note.recipient_user_id,
        push_subscription_id: null,
        channel: 'push',
        status: 'skipped',
        error_code: 'no_device',
        error_message: null,
      });
      continue;
    }

    const payload = {
      notification_id: note.notification_id,
      event_key: 'saving_reminder_due',
      title: 'Saving reminder',
      body: 'A small update keeps your plan current.',
      url: safeUrl,
      fallback_url: safeFallback,
      tag: `saving_reminder:${note.plan_id}:${note.cadence}:${note.period_key}`,
    };

    await deliverPush(note.notification_id, note.recipient_user_id, subs, payload);
  }

  // 3b. Deliver push for each newly created plan-start notification.
  //     Uses the same prefs/subscription maps populated above from the
  //     union of recipients, so a plan-start recipient who is NOT in
  //     the reminder set still gets a push.
  for (const note of planStarts) {
    const subs = subsFor.get(note.recipient_user_id) ?? [];
    if (subs.length === 0) {
      summary.push_skipped_no_devices += 1;
      console.warn(
        `[saving-reminders] skip recipient=${note.recipient_user_id} plan_started=${note.plan_id} reason=no_devices`,
      );
      attempts.push({
        notification_id: note.notification_id,
        recipient_user_id: note.recipient_user_id,
        push_subscription_id: null,
        channel: 'push',
        status: 'skipped',
        error_code: 'no_device',
        error_message: null,
      });
      continue;
    }

    const payload = {
      notification_id: note.notification_id,
      event_key: 'plan_started',
      title: 'Your saving plan starts today',
      body: "Record your first deposit when you're ready.",
      url: safeUrl,
      fallback_url: safeFallback,
      tag: `plan_started:${note.plan_id}:${note.start_date}`,
    };

    await deliverPush(note.notification_id, note.recipient_user_id, subs, payload);
  }

  async function deliverPush(
    notificationId: string,
    recipientUserId: string,
    subs: PushSubscriptionRow[],
    payload: {
      notification_id: string;
      event_key: string;
      title: string;
      body: string;
      url: string;
      fallback_url: string;
      tag: string;
    },
  ): Promise<void> {
    const delivery = await deliverPushToSubscriptions(
      admin,
      recipientUserId,
      notificationId,
      subs,
      payload,
    );

    summary.push_attempted += delivery.attempted;
    summary.push_delivered += delivery.delivered;
    attempts.push(...delivery.attempts);
    summary.errors.push(...delivery.errors);
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
