import { useReactions } from '../../hooks/useReactions';
import { useAuth } from '../../hooks/useAuth';
import { EMOJI_MAP, EMOJI_KEYS } from '../../lib/reactions';
import type { EmojiKey, ReactionPing } from '../../lib/reactions';

interface Props {
  logId: string;
  logUserId: string;
  onSendPing: (ping: ReactionPing) => void;
}

export function ReactionBar({ logId, logUserId, onSendPing }: Props) {
  const { user } = useAuth();
  const { counts, myReactions, toggle } = useReactions(logId);

  async function handleTap(emoji: EmojiKey) {
    await toggle(emoji);
    if (user && !myReactions.has(emoji)) {
      onSendPing({ logId, fromUserId: user.id, emoji, sentAt: Date.now() });
    }
  }

  // Only show reactions on partner's logs
  if (!user || user.id === logUserId) return null;

  return (
    <div className="flex gap-2 mt-1">
      {EMOJI_KEYS.map(key => (
        <button
          key={key}
          onClick={() => handleTap(key)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
            myReactions.has(key)
              ? 'bg-terracotta border-terracotta text-white'
              : 'bg-surface border-border text-ink-muted'
          }`}
        >
          <span>{EMOJI_MAP[key]}</span>
          {counts[key] > 0 && <span>{counts[key]}</span>}
        </button>
      ))}
    </div>
  );
}
