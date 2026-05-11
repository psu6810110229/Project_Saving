import { createContext } from 'react';
import type { Room } from '../../types';

export interface RoomContextValue {
  activeRoomId: string | null;
  activeRoom: Room | null;
  setActiveRoomId: (id: string | null) => void;
  rooms: Room[];
  setRooms: (rooms: Room[]) => void;
}

export const RoomContext = createContext<RoomContextValue>({
  activeRoomId: null,
  activeRoom: null,
  setActiveRoomId: () => {},
  rooms: [],
  setRooms: () => {},
});
