import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { EmojiKey } from '../lib/reactions';
import { EMOJI_KEYS } from '../lib/reactions';

type Counts = Record<EmojiKey, number>;

export function useReactions(logId: string) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>({ fire: 0, heart: 0, clap: 0 });
  const [myReactions, setMyReactions] = useState<Set<EmojiKey>>(new Set());
  const throttle = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!logId) return;

    supabase
      .from('reactions')
      .select('emoji, user_id')
      .eq('log_id', logId)
      .then(({ data }) => {
        const c: Counts = { fire: 0, heart: 0, clap: 0 };
        const mine = new Set<EmojiKey>();
        (data ?? []).forEach(row => {
          const key = row.emoji as EmojiKey;
          if (EMOJI_KEYS.includes(key)) {
            c[key] = (c[key] ?? 0) + 1;
            if (row.user_id === user?.id) mine.add(key);
          }
        });
        setCounts(c);
        setMyReactions(mine);
      });
  }, [logId, user?.id]);

  async function toggle(emoji: EmojiKey) {
    if (!user) return;

    // Throttle: 1 action per emoji per 500ms
    const key = `${logId}:${emoji}`;
    const now = Date.now();
    if (throttle.current[key] && now - throttle.current[key] < 500) return;
    throttle.current[key] = now;

    const isMine = myReactions.has(emoji);

    // Optimistic update
    setCounts(prev => ({ ...prev, [emoji]: Math.max(0, prev[emoji] + (isMine ? -1 : 1)) }));
    setMyReactions(prev => {
      const next = new Set(prev);
      isMine ? next.delete(emoji) : next.add(emoji);
      return next;
    });

    if (isMine) {
      await supabase
        .from('reactions')
        .delete()
        .eq('log_id', logId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
    } else {
      const { error } = await supabase
        .from('reactions')
        .insert({ log_id: logId, user_id: user.id, emoji });
      // Ignore unique-violation (23505) — idempotent
      if (error && !error.message.includes('duplicate')) {
        // Roll back on unexpected error
        setCounts(prev => ({ ...prev, [emoji]: Math.max(0, prev[emoji] - 1) }));
        setMyReactions(prev => { const next = new Set(prev); next.delete(emoji); return next; });
      }
    }
  }

  return { counts, myReactions, toggle };
}
