import { useEffect, useState, type ReactNode } from 'react';
import type { Room } from '../../types';
import { RoomContext } from './RoomContextValue';

const STORAGE_KEY = 'activeRoomId';

export function RoomProvider({ children }: { children: ReactNode }) {
  const [activeRoomId, _setActiveRoomId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });
  const [rooms, setRooms] = useState<Room[]>([]);

  // Keep localStorage in sync
  function setActiveRoomId(id: string | null) {
    _setActiveRoomId(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }

  // Auto-select first available room if stored id is gone or nothing selected
  useEffect(() => {
    if (rooms.length === 0) return;
    const stillExists = rooms.some(r => r.id === activeRoomId);
    if (!stillExists) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveRoomId(rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  const activeRoom = rooms.find(r => r.id === activeRoomId) ?? null;

  return (
    <RoomContext.Provider value={{ activeRoomId, activeRoom, setActiveRoomId, rooms, setRooms }}>
      {children}
    </RoomContext.Provider>
  );
}
