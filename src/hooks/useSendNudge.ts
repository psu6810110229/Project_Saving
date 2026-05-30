import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { usePushSubscription } from './usePushSubscription';
import { useI18n } from '../i18n/useI18n';

type NudgeStatus = 'sent' | 'saved_no_push' | 'throttled';

interface NudgeResponse {
  status?: NudgeStatus;
  delivered?: number;
  notification_id?: string | null;
  error?: string;
}

interface SendNudgeArgs {
  partnerUserId: string | null | undefined;
  roomId: string | null;
  partnerName?: string;
}

interface SendNudgeResult {
  ok: boolean;
  message: string;
  status: NudgeStatus | 'error';
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

function messageForStatus(
  response: NudgeResponse,
  copy: ReturnType<typeof useI18n>['copy'],
  partnerName?: string,
): { status: NudgeStatus; message: string } {
  const n = copy.notifications.nudge;
  const partner = partnerName ?? n.fallbackPartner;

  if (import.meta.env.DEV) {
    console.debug('[useSendNudge] response', response);
  }

  switch (response.status) {
    case 'sent':
      return { status: 'sent', message: n.sent(partner) };
    case 'throttled':
      return { status: 'throttled', message: n.throttledGeneric };
    case 'saved_no_push':
      return {
        status: 'saved_no_push',
        message: response.error ? `${n.savedNoPush(partner)} (${response.error})` : n.savedNoPush(partner),
      };
    default:
      if ((response.delivered ?? 0) > 0) {
        return { status: 'sent', message: n.sent(partner) };
      }
      return { status: 'saved_no_push', message: n.savedNoPush(partner) };
  }
}

export function useSendNudge() {
  const { ready, subscribed, unsupported, subscribe } = usePushSubscription();
  const { copy } = useI18n();

  const sendNudge = useCallback(async ({
    partnerUserId,
    roomId,
    partnerName,
  }: SendNudgeArgs): Promise<SendNudgeResult> => {
    if (!partnerUserId || !roomId) {
      return {
        ok: false,
        status: 'error',
        message: copy.notifications.nudge.sendError,
      };
    }

    if (unsupported) {
      return {
        ok: false,
        status: 'error',
        message: copy.notifications.nudge.sendError,
      };
    }

    if (!subscribed) {
      const result = await subscribe();
      if (result.error) {
        return {
          ok: false,
          status: 'error',
          message: result.error,
        };
      }
    }

    const { data, error, response } = await supabase.functions.invoke('send-nudge', {
      body: { to_user_id: partnerUserId, room_id: roomId },
    });

    if (error) {
      return {
        ok: false,
        status: 'error',
        message: await messageForInvokeError(error, response, copy),
      };
    }

    const resolved = messageForStatus((data ?? {}) as NudgeResponse, copy, partnerName);
    return {
      ok: resolved.status !== 'throttled',
      status: resolved.status,
      message: resolved.message,
    };
  }, [copy, subscribe, subscribed, unsupported]);

  return {
    ready,
    subscribed,
    unsupported,
    sendNudge,
  };
}
