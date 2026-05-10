import { useState } from 'react';
import { Modal } from '../Modal/Modal';
import { supabase } from '../../lib/supabase';
import { useRoom } from '../RoomContext/RoomContext';
import type { Room } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onJoined: (room: Room) => void;
}

export function JoinRoomModal({ open, onClose, onJoined }: Props) {
  const { setActiveRoomId, setRooms, rooms } = useRoom();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'joining' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) { setErrorMsg('Code must be 6 characters'); setStatus('error'); return; }

    setStatus('joining');
    const { data: roomId, error } = await supabase.rpc('join_room_by_code', { code: trimmed });

    if (error || !roomId) {
      setErrorMsg(error?.message ?? 'Room not found — check the code and try again');
      setStatus('error');
      return;
    }

    // Fetch the joined room details
    const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (room) {
      setRooms([...rooms.filter(r => r.id !== room.id), room as Room]);
      setActiveRoomId(room.id);
      onJoined(room as Room);
    }

    handleClose();
  }

  function handleClose() {
    setCode('');
    setStatus('idle');
    setErrorMsg('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Join a room">
      <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-muted uppercase tracking-widest">Invite code</label>
          <input
            type="text"
            maxLength={6}
            required
            placeholder="e.g. A4B7C2"
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setStatus('idle'); }}
            className="bg-surface border-2 border-border rounded-xl px-4 py-3 text-ink text-base font-mono tracking-widest text-center outline-none focus:border-terracotta transition-colors uppercase"
          />
        </div>
        {status === 'error' && <p className="text-red-500 text-xs text-center">{errorMsg}</p>}
        <button
          type="submit"
          disabled={status === 'joining'}
          className="bg-terracotta text-white rounded-xl py-4 text-base font-bold shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 transition-all"
        >
          {status === 'joining' ? 'Joining…' : 'Join room'}
        </button>
      </form>
    </Modal>
  );
}
