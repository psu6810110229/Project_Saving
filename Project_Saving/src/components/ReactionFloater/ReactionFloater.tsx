import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useReactionBroadcast } from '../../hooks/useReactionBroadcast';
import { EMOJI_MAP } from '../../lib/reactions';
import type { ReactionPing } from '../../lib/reactions';

interface ActivePing extends ReactionPing {
  id: string;
  x: number;
}

const MAX_FLOATERS = 6;

interface Props {
  onPing: (ping: ReactionPing) => void;
}

export function ReactionFloater({ onPing }: Props) {
  const { user } = useAuth();
  const [floaters, setFloaters] = useState<ActivePing[]>([]);

  useReactionBroadcast(ping => {
    if (ping.fromUserId === user?.id) return; // no self-confetti
    onPing(ping);

    const floater: ActivePing = {
      ...ping,
      id: crypto.randomUUID(),
      x: 20 + Math.random() * 60, // random horizontal %
    };

    setFloaters(prev => [...prev.slice(-(MAX_FLOATERS - 1)), floater]);
    setTimeout(() => {
      setFloaters(prev => prev.filter(f => f.id !== floater.id));
    }, 1400);
  });

  if (floaters.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {floaters.map(f => (
        <span
          key={f.id}
          className="absolute text-2xl animate-bounce"
          style={{
            left: `${f.x}%`,
            bottom: '20%',
            animation: 'floatUp 1.4s ease-out forwards',
          }}
        >
          {EMOJI_MAP[f.emoji]}
        </span>
      ))}
    </div>
  );
}
