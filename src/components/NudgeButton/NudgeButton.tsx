import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import { useI18n } from '../../i18n/useI18n';
import { IconBell } from '../Icon/Icon';

interface NudgeButtonProps {
  /** Partner user id (the recipient of the nudge). */
  partnerUserId: string | null | undefined;
  /** Active room id used as the click target on the partner's device. */
  roomId: string | null;
  /** Partner's display name, used in the inline feedback message. */
  partnerName?: string;
}

type NudgeStatus = 'sent' | 'saved_no_push' | 'throttled';

interface NudgeResponse {
  status?: NudgeStatus;
  delivered?: number;
  notification_id?: string | null;
  error?: string;
}

async function messageForInvokeError(
  error: unknown,
  response: Response | undefined,
  copy: ReturnType<typeof useI18n>['copy'],
): Promise<string> {
  if (response?.status === 429) {
    return copy.notifications.nudge.throttled;
  }

  const context = (error as { context?: Response } | null)?.context;
  if (context?.status === 429) {
    return copy.notifications.nudge.throttled;
  }

  void error;
  return copy.notifications.nudge.sendError;
}

/**
 * Compact button that asks the partner to "come back and save".
 * On first tap, prompts for notification permission and registers the
 * current device so the partner can nudge this user back. The actual
 * send is done by the `send-nudge` edge function which:
 *   - validates room membership,
 *   - throttles,
 *   - always creates an in-app `notifications` row for the partner,
 *   - sends Web Push only when the partner's preferences allow it.
 */
export function NudgeButton({ partnerUserId, roomId, partnerName }: NudgeButtonProps) {
  const { ready, subscribed, unsupported, subscribe } = usePushSubscription();
  const { copy } = useI18n();
  const n = copy.notifications.nudge;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!partnerUserId) return null;
  if (unsupported) return null;
  if (!roomId) return null;

  function messageForStatus(response: NudgeResponse): string {
    const partner = partnerName ?? n.fallbackPartner;
    if (import.meta.env.DEV) {
      // Helps trace the "saved but not delivered" mismatch reported in 0.9.6.
      console.debug('[NudgeButton] response', response);
    }
    switch (response.status) {
      case 'sent':
        return n.sent(partner);
      case 'throttled':
        return n.throttledGeneric;
      case 'saved_no_push':
        return response.error ? `${n.savedNoPush(partner)} (${response.error})` : n.savedNoPush(partner);
      default:
        // Unknown status: prefer the success copy when at least one push
        // was accepted, so a missing `status` field never surfaces the
        // misleading "push could not be delivered" message.
        if ((response.delivered ?? 0) > 0) return n.sent(partner);
        return n.savedNoPush(partner);
    }
  }

  async function handleClick() {
    setBusy(true);
    setMessage(null);
    if (!subscribed) {
      const result = await subscribe();
      if (result.error) { setMessage(result.error); setBusy(false); return; }
    }
    const { data, error, response } = await supabase.functions.invoke('send-nudge', {
      body: { to_user_id: partnerUserId, room_id: roomId },
    });
    setBusy(false);
    if (error) { setMessage(await messageForInvokeError(error, response, copy)); return; }
    setMessage(messageForStatus((data ?? {}) as NudgeResponse));
  }

  return (
    <div className="relative flex shrink-0 justify-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || !ready}
        aria-label={n.ariaLabel}
        aria-describedby={message ? 'nudge-button-status' : undefined}
        title={subscribed ? n.titleReady : n.titleNeedsDevice}
        className="grid h-10 w-10 place-items-center rounded-full bg-surface text-brand-500 shadow-soft transition-all duration-200 hover:bg-brand-50 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
      >
        <IconBell size={18} />
      </button>
      {message && (
        <span
          id="nudge-button-status"
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full z-10 mt-2 w-[min(14rem,calc(100vw-2rem))] rounded-lg border border-brand-100 bg-surface px-3 py-2 text-right font-mono text-[11px] leading-snug text-ink-muted shadow-soft"
        >
          {message}
        </span>
      )}
    </div>
  );
}
