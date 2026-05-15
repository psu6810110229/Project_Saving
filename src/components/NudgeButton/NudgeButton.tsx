import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import { IconHeart } from '../Icon/Icon';

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

const THROTTLED_MESSAGE = 'You already nudged recently. Try again in a few minutes.';

async function messageForInvokeError(error: unknown, response?: Response): Promise<string> {
  if (response?.status === 429) {
    return THROTTLED_MESSAGE;
  }

  const context = (error as { context?: Response } | null)?.context;
  if (context?.status === 429) {
    return THROTTLED_MESSAGE;
  }

  return (error as { message?: string } | null)?.message ?? 'Could not send nudge. Try again in a moment.';
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!partnerUserId) return null;
  if (unsupported) return null;
  if (!roomId) return null;

  function messageForStatus(response: NudgeResponse): string {
    const partner = partnerName ?? 'your partner';
    switch (response.status) {
      case 'sent':
        return `Nudge sent to ${partner}.`;
      case 'throttled':
        return response.error ?? 'Slow down - try again in a few minutes.';
      case 'saved_no_push':
        return response.error
          ? `${response.error} Notification saved.`
          : `Notification saved for ${partner}. Push could not be delivered.`;
      default:
        return response.error ?? `Nudge sent to ${partner}.`;
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
    if (error) { setMessage(await messageForInvokeError(error, response)); return; }
    setMessage(messageForStatus((data ?? {}) as NudgeResponse));
  }

  return (
    <div className="relative flex shrink-0 justify-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || !ready}
        aria-label="Nudge partner"
        aria-describedby={message ? 'nudge-button-status' : undefined}
        title={subscribed ? 'Nudge partner' : 'Enable notifications to nudge partner'}
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-pill border border-brand-100 bg-brand-50 px-3 text-xs font-bold tracking-wide text-brand-800 shadow-soft transition-all duration-200 hover:bg-brand-100 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
      >
        <IconHeart size={15} />
        <span>{busy ? 'Sending' : 'Nudge'}</span>
      </button>
      {message && (
        <span
          id="nudge-button-status"
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full z-10 mt-2 w-[min(14rem,calc(100vw-2rem))] rounded-lg bg-surface px-3 py-2 text-right font-mono text-[11px] leading-snug text-ink-muted shadow-soft"
        >
          {message}
        </span>
      )}
    </div>
  );
}
