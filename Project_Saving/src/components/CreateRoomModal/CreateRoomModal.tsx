import { useState } from 'react';
import { Modal } from '../Modal/Modal';
import { supabase } from '../../lib/supabase';
import { generateInviteCode } from '../../lib/inviteCode';
import { useRoom } from '../RoomContext/RoomContext';
import type { Room } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (room: Room) => void;
}

function defaultEndDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function CreateRoomModal({ open, onClose, onCreated }: Props) {
  const { setActiveRoomId } = useRoom();
  const [name, setName] = useState('');
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) { setErrorMsg('Room name is required'); setStatus('error'); return; }

    setStatus('saving');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErrorMsg('Not authenticated'); setStatus('error'); return; }

    const code = generateInviteCode();

    // Insert room
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({ name: trimmedName, invite_code: code, end_date: endDate, created_by: user.id })
      .select()
      .single();

    if (roomErr) { setErrorMsg(roomErr.message); setStatus('error'); return; }

    // Insert creator as member
    await supabase.from('room_members').insert({ room_id: room.id, user_id: user.id });

    setCreatedCode(code);
    setActiveRoomId(room.id);
    setStatus('done');
    onCreated(room as Room);
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(createdCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  function handleClose() {
    setName('');
    setEndDate(defaultEndDate());
    setStatus('idle');
    setErrorMsg('');
    setCreatedCode('');
    setCodeCopied(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create a room">
      <div className="px-5 py-4 flex flex-col gap-4">
        {status === 'done' ? (
          <div className="flex flex-col gap-3 items-center text-center py-4">
            <span className="text-3xl">🎉</span>
            <p className="text-base font-semibold text-ink">Room created!</p>
            <p className="text-sm text-ink-muted">Share this code with friends:</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-mono font-bold text-terracotta tracking-widest">{createdCode}</span>
              <button onClick={handleCopyCode} className="text-sm text-terracotta hover:underline">
                {codeCopied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <button
              onClick={handleClose}
              className="mt-2 bg-terracotta text-white rounded-xl px-6 py-3 text-sm font-bold shadow-sm hover:shadow-md active:scale-95 transition-all"
            >
              Go to Battle
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-muted uppercase tracking-widest">Room name</label>
              <input
                type="text"
                maxLength={40}
                required
                placeholder="e.g. 🇯🇵 Japan 2027"
                value={name}
                onChange={e => { setName(e.target.value); setStatus('idle'); }}
                className="bg-surface border-2 border-border rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-terracotta transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-muted uppercase tracking-widest">End date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-surface border-2 border-border rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-terracotta transition-colors"
              />
            </div>
            {status === 'error' && <p className="text-red-500 text-xs">{errorMsg}</p>}
            <button
              type="submit"
              disabled={status === 'saving'}
              className="bg-terracotta text-white rounded-xl py-4 text-base font-bold shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 transition-all"
            >
              {status === 'saving' ? 'Creating…' : 'Create room'}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
