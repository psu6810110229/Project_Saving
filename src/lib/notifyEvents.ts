import { supabase } from './supabase';

/**
 * Thin wrappers around the partner-activity notification RPCs added
 * in migration 0040. Each helper is non-throwing on purpose: the
 * caller is always a critical action (deposit, balance check, plan
 * change, goal update, room join/leave) and a notification failure
 * must never surface as a user-facing error.
 *
 * The pattern is: run the core action first, then call the matching
 * helper. Drop the awaited promise with `void` so a slow/failed RPC
 * never delays the UI. Errors are logged at `console.warn` so they
 * still show up during local debugging without bubbling up.
 */

function logFailure(event: string, error: unknown): void {
  if (typeof console !== 'undefined') {
    console.warn(`[notifyEvents] ${event} failed`, error);
  }
}

async function call(rpc: string, args: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await supabase.rpc(rpc, args);
    if (error) logFailure(rpc, error);
  } catch (err) {
    logFailure(rpc, err);
  }
}

/**
 * Partner-deposit notifications go through the `notify-partner-deposit`
 * edge function so the partner also gets a Web Push (not just the
 * in-app row). The edge function itself invokes the same
 * `notify_partner_deposit` RPC, so the in-app behavior is preserved
 * even if push delivery fails inside the function. If the function
 * call itself fails (network error, function not deployed, cold-start
 * timeout), we fall back to calling the RPC directly so the in-app
 * notification still lands. Both paths swallow errors — the deposit
 * save must not be blocked by notification failures.
 */
export function notifyPartnerDeposit(logId: string): void {
  void (async () => {
    try {
      const { error } = await supabase.functions.invoke('notify-partner-deposit', {
        body: { log_id: logId },
      });
      if (!error) return;
      logFailure('notify-partner-deposit', error);
    } catch (err) {
      logFailure('notify-partner-deposit', err);
    }
    // Fallback: at least insert the in-app notification row so the
    // partner still sees the deposit in their Notification Center even
    // when the edge function is unreachable.
    await call('notify_partner_deposit', { p_log_id: logId });
  })();
}

export function notifyBalanceChecked(checkpointId: string): void {
  void call('notify_balance_checked', { p_checkpoint_id: checkpointId });
}

export function notifyPlanCreated(revisionId: string): void {
  void call('notify_plan_created', { p_revision_id: revisionId });
}

export function notifyPlanChanged(revisionId: string): void {
  void call('notify_plan_changed', { p_revision_id: revisionId });
}

export function notifyPlanPaused(pauseId: string): void {
  void call('notify_plan_paused', { p_pause_id: pauseId });
}

export function notifyPlanResumed(pauseId: string): void {
  void call('notify_plan_resumed', { p_pause_id: pauseId });
}

export function notifyGoalChanged(roomId: string): void {
  void call('notify_goal_changed', { p_room_id: roomId });
}

export function notifyGoalChangeRequest(roomId: string, message: string): void {
  void call('notify_goal_change_request', { p_room_id: roomId, p_message: message });
}

export function notifyRoomJoined(roomId: string): void {
  void call('notify_room_joined', { p_room_id: roomId });
}

/**
 * IMPORTANT: must be awaited and called BEFORE the room_members row
 * is deleted. Otherwise _other_room_member() can no longer resolve
 * the actor's partner. Errors still resolve quietly so a notification
 * failure doesn't strand the leaver.
 */
export async function notifyRoomLeft(roomId: string): Promise<void> {
  await call('notify_room_left', { p_room_id: roomId });
}

export function notifyBucketAdded(bucketId: string): void {
  void call('notify_bucket_added', { p_bucket_id: bucketId });
}

export function notifyBucketUpdated(bucketId: string): void {
  void call('notify_bucket_updated', { p_bucket_id: bucketId });
}

/**
 * Server-side dispatch for the four smart-event threshold checks
 * (bucket goal reached, overtaking, streak milestone, project goal
 * reached). Each check is dedupe-guarded inside the RPC so calling
 * this on every successful deposit is safe.
 */
export function evaluateSmartEventsAfterDeposit(logId: string): void {
  void call('evaluate_smart_events_after_deposit', { p_log_id: logId });
}
