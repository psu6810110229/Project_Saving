import { useState } from 'react';
import { useRoom } from '../RoomContext/RoomContext';
import { supabase } from '../../lib/supabase';
import type { Room } from '../../types';

interface Props {
  room: Room;
  memberCount: number;
  onLeave: (roomId: string) => void;
}

export function RoomCard({ room, memberCount, onLeave }: Props) {
  const { activeRoomId, setActiveRoomId } = useRoom();
  const isActive = activeRoomId === room.id;
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const daysLeft = Math.max(
    0,
    Math.round((new Date(room.end_date + 'T00:00:00').getTime() - Date.now()) / 86_400_000),
  );

  function handleCopy() {
    navigator.clipboard.writeText(room.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleLeave() {
    setLeaving(true);
    await supabase.from('room_members').delete().eq('room_id', room.id).eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '');
    setLeaving(false);
    setConfirming(false);
    onLeave(room.id);
  }

  return (
    <div
      className={`
        rounded-xl p-4 flex flex-col gap-3 cursor-pointer
        ${isActive ? 'bg-terracotta/10 border-2 border-terracotta' : 'bg-surface border border-border'}
        transition-all duration-150
      `}
      onClick={() => setActiveRoomId(room.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold text-ink">{room.name}</span>
          <span className="text-xs text-ink-muted">
            {memberCount} member{memberCount !== 1 ? 's' : ''} · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
          </span>
        </div>
        {isActive && (
          <span className="text-xs bg-terracotta text-white px-2 py-0.5 rounded-full font-medium shrink-0">
            Active
          </span>
        )}
      </div>

      {/* Invite code row */}
      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <span className="text-xs text-ink-muted">Code:</span>
        <span className="text-sm font-mono font-semibold text-ink tracking-wider">{room.invite_code}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-terracotta hover:underline ml-auto"
        >
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>

      {/* Leave */}
      <div onClick={e => e.stopPropagation()}>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-ink-muted hover:text-red-500 transition-colors"
          >
            Leave room
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">Are you sure?</span>
            <button onClick={handleLeave} disabled={leaving} className="text-xs text-red-500 font-medium">
              {leaving ? '…' : 'Yes, leave'}
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs text-ink-muted">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
