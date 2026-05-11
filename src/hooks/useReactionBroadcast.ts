import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { ReactionPing } from '../lib/reactions';

type PingHandler = (ping: ReactionPing) => void;

export function useReactionBroadcast(onPing: PingHandler) {
  const handlerRef = useRef(onPing);

  useEffect(() => {
    handlerRef.current = onPing;
  }, [onPing]);

  useEffect(() => {
    const channel = supabase
      .channel('reactions:room')
      .on('broadcast', { event: 'ping' }, ({ payload }) => {
        handlerRef.current(payload as ReactionPing);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  function sendPing(ping: ReactionPing) {
    supabase.channel('reactions:room').send({
      type: 'broadcast',
      event: 'ping',
      payload: ping,
    });
  }

  return { sendPing };
}
