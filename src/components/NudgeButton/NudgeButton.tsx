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

/**
 * Compact button that asks the partner to "come back and save".
 * On first tap, prompts for notification permission and registers
 * the current device so the partner can nudge this user back.
 * Calls the `send-nudge` edge function which throttles + dispatches
 * the web-push payload.
 */
export function NudgeButton({ partnerUserId, roomId, partnerName }: NudgeButtonProps) {
  const { ready, subscribed, unsupported, subscribe } = usePushSubscription();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!partnerUserId) return null;
  if (unsupported) return null;

  async function handleClick() {
    setBusy(true);
    setMessage(null);
    if (!subscribed) {
      const result = await subscribe();
      if (result.error) { setMessage(result.error); setBusy(false); return; }
    }
    const { data, error } = await supabase.functions.invoke('send-nudge', {
      body: { to_user_id: partnerUserId, room_id: roomId },
    });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    const delivered = (data as { delivered?: number; error?: string } | null)?.delivered ?? 0;
    if (delivered > 0) setMessage(`Nudge sent to ${partnerName ?? 'your partner'}.`);
    else setMessage((data as { error?: string } | null)?.error ?? 'Partner has not enabled nudges yet.');
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
