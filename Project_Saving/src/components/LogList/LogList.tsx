import type { ReactNode } from 'react';
import { localDateLabel } from '../../lib/format';
import { LogItem } from '../LogItem/LogItem';
import type { SavingsLog } from '../../types';
import type { ReactionPing } from '../../lib/reactions';

interface Props {
  logs: SavingsLog[];
  loading: boolean;
  onSendPing: (ping: ReactionPing) => void;
  /** Optional node rendered below the last group (e.g. "See all" button). */
  footer?: ReactNode;
  /** When set, only logs from this user_id are shown. */
  filterUserId?: string;
  /** Sort order. Default 'desc' (newest first). */
  order?: 'desc' | 'asc';
  /** Empty-state message when filter returns no logs. */
  emptyMessage?: string;
}

export function LogList({
  logs,
  loading,
  onSendPing,
  footer,
  filterUserId,
  order = 'desc',
  emptyMessage = 'No logs yet — start saving!',
}: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-6 h-6 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
      </div>
    );
  }

  // Apply filter
  const filtered = filterUserId ? logs.filter(l => l.user_id === filterUserId) : logs;

  // Sort by timestamp
  const sorted = [...filtered].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return order === 'desc' ? bTime - aTime : aTime - bTime;
  });

  if (sorted.length === 0) {
    return (
      <>
        <p className="text-sm text-ink-muted text-center py-6">{emptyMessage}</p>
        {footer && <div className="pb-4">{footer}</div>}
      </>
    );
  }

  // Build date groups preserving sort order
  const groupMap = new Map<string, SavingsLog[]>();
  for (const log of sorted) {
    const label = localDateLabel(log.created_at);
    if (!groupMap.has(label)) groupMap.set(label, []);
    groupMap.get(label)!.push(log);
  }

  return (
    <div className="flex flex-col">
      {Array.from(groupMap.entries()).map(([label, items]) => (
        <div key={label}>
          <p className="text-xs text-ink-dim uppercase tracking-widest py-2">{label}</p>
          <div className="divide-y divide-border">
            {items.map(log => (
              <LogItem key={log.id} log={log} onSendPing={onSendPing} />
            ))}
          </div>
        </div>
      ))}
      {footer && (
        <div className="border-t border-border py-3 flex justify-center">
          {footer}
        </div>
      )}
    </div>
  );
}
