import { useRoom } from '../RoomContext/RoomContext';

export function RoomSwitcher() {
  const { rooms, activeRoomId, setActiveRoomId } = useRoom();

  if (rooms.length <= 1) {
    return (
      <span className="text-sm font-medium text-ink truncate max-w-[140px]">
        {rooms[0]?.name ?? '—'}
      </span>
    );
  }

  return (
    <select
      value={activeRoomId ?? ''}
      onChange={e => setActiveRoomId(e.target.value)}
      className="bg-surface border border-border rounded-lg px-2 py-1 text-sm text-ink outline-none focus:border-terracotta max-w-[160px] truncate"
    >
      {rooms.map(r => (
        <option key={r.id} value={r.id}>{r.name}</option>
      ))}
    </select>
  );
}
