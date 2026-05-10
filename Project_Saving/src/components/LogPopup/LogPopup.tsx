import { useState, useMemo } from 'react';
import { Modal } from '../Modal/Modal';
import { LogList } from '../LogList/LogList';
import { useAllLogs } from '../../hooks/useAllLogs';
import type { ReactionPing } from '../../lib/reactions';

interface PlayerOption {
  userId: string;
  displayName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSendPing: (ping: ReactionPing) => void;
  /** Available players for the filter dropdown, derived from leaderboard entries. */
  players: PlayerOption[];
}

export function LogPopup({ open, onClose, onSendPing, players }: Props) {
  const { logs, loading } = useAllLogs();
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [filterUserId, setFilterUserId] = useState<string>('');

  const selectedPlayer = useMemo(
    () => players.find(p => p.userId === filterUserId),
    [players, filterUserId],
  );

  const emptyMessage = filterUserId && selectedPlayer
    ? `No logs from ${selectedPlayer.displayName} yet`
    : 'No logs yet — start saving!';

  return (
    <Modal open={open} onClose={onClose} title="All activity">
      {/* Controls */}
      <div className="flex gap-3 px-5 py-3 border-b border-border bg-canvas shrink-0">
        {/* Sort */}
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="text-xs text-ink-muted uppercase tracking-widest">Sort</label>
          <select
            value={order}
            onChange={e => setOrder(e.target.value as 'desc' | 'asc')}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-terracotta"
          >
            <option value="desc">Latest</option>
            <option value="asc">Oldest</option>
          </select>
        </div>

        {/* Filter */}
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="text-xs text-ink-muted uppercase tracking-widest">Show</label>
          <select
            value={filterUserId}
            onChange={e => setFilterUserId(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-terracotta"
          >
            <option value="">Everyone</option>
            {players.map(p => (
              <option key={p.userId} value={p.userId}>{p.displayName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Log list */}
      <div className="px-4">
        <LogList
          logs={logs}
          loading={loading}
          onSendPing={onSendPing}
          filterUserId={filterUserId || undefined}
          order={order}
          emptyMessage={emptyMessage}
        />
      </div>
    </Modal>
  );
}
