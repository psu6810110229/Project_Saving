import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoom } from '../components/RoomContext/RoomContext';
import { useRooms } from '../hooks/useRooms';
import { RoomCard } from '../components/RoomCard/RoomCard';
import { CreateRoomModal } from '../components/CreateRoomModal/CreateRoomModal';
import { JoinRoomModal } from '../components/JoinRoomModal/JoinRoomModal';
import type { Room } from '../types';

export function GoalPage() {
  const { rooms, setRooms, setActiveRoomId } = useRoom();
  const { loading, refetch } = useRooms();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  function handleCreated(room: Room) {
    setRooms([...rooms.filter(r => r.id !== room.id), room]);
    setCreateOpen(false);
    navigate('/battle');
  }

  function handleJoined(room: Room) {
    setRooms([...rooms.filter(r => r.id !== room.id), room]);
    setJoinOpen(false);
    navigate('/battle');
  }

  function handleLeave(roomId: string) {
    const updated = rooms.filter(r => r.id !== roomId);
    setRooms(updated);
    if (updated.length > 0) setActiveRoomId(updated[0].id);
    else setActiveRoomId(null);
    refetch();
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-sm mx-auto px-4 pt-6 flex flex-col gap-5">

        <h1 className="text-xl text-ink font-semibold">Your battle rooms</h1>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-surface border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 text-center">
            <span className="text-4xl"></span>
            <p className="text-ink font-semibold">No rooms yet</p>
            <p className="text-sm text-ink-muted">Create a room to start a savings battle, or join one with an invite code.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rooms.map(room => (
              <RoomCard
                key={room.id}
                room={room}
                memberCount={2} // member count shown from leaderboard entries in real use
                onLeave={handleLeave}
              />
            ))}
          </div>
        )}

        {/* CTAs */}
        <div className="flex gap-3">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex-1 bg-terracotta text-white rounded-xl py-3 text-sm font-bold shadow-sm hover:shadow-md active:scale-95 transition-all"
          >
            + Create room
          </button>
          <button
            onClick={() => setJoinOpen(true)}
            className="flex-1 bg-surface border border-border rounded-xl py-3 text-sm font-medium text-ink hover:border-terracotta hover:text-terracotta transition-colors"
          >
            Join with code
          </button>
        </div>

      </div>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} onJoined={handleJoined} />
    </div>
  );
}
