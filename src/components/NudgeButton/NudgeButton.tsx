import { useState } from 'react';
import { Button } from '../Button/Button';
import { supabase } from '../../lib/supabase';
import { usePushSubscription } from '../../hooks/usePushSubscription';

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
        return response.error ?? 'Slow down — try again in a few minutes.';
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
    <div className="flex flex-col items-end gap-1">
      <Button variant="action" onClick={handleClick} disabled={busy || !ready}>
        {busy ? 'Sending…' : subscribed ? 'Nudge partner' : 'Enable & Nudge'}
      </Button>
      {message && <span className="font-mono text-[11px] text-ink-muted max-w-[12rem] text-right">{message}</span>}
    </div>
  );
}
