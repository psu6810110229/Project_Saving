import { useContext } from 'react';
import { RoomContext } from '../components/RoomContext/RoomContextValue';

export function useRoom() {
  return useContext(RoomContext);
}
