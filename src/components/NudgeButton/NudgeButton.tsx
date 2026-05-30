import { useState } from 'react';
import { useSendNudge } from '../../hooks/useSendNudge';
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
  const { copy } = useI18n();
  const { ready, subscribed, unsupported, sendNudge } = useSendNudge();
  const n = copy.notifications.nudge;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!partnerUserId) return null;
  if (unsupported) return null;
  if (!roomId) return null;

  async function handleClick() {
    setBusy(true);
    setMessage(null);
    const result = await sendNudge({
      partnerUserId,
      roomId,
      partnerName,
    });
    setBusy(false);
    setMessage(result.message);
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
