/**
 * RoomsLoader — mounts inside RoomProvider to kick off the initial room fetch.
 * Renders nothing; acts purely as a side-effect runner.
 */
import { useRooms } from '../../hooks/useRooms';

export function RoomsLoader() {
  useRooms(); // side-effect: fetches rooms and populates RoomContext
  return null;
}
