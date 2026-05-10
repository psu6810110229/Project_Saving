import { localDateLabel } from '../../lib/format';
import { LogItem } from '../LogItem/LogItem';
import type { SavingsLog } from '../../types';
import type { ReactionPing } from '../../lib/reactions';

interface Props {
  logs: SavingsLog[];
  loading: boolean;
  onSendPing: (ping: ReactionPing) => void;
}

export function LogList({ logs, loading, onSendPing }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-6 h-6 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return <p className="text-sm text-ink-muted text-center py-6">No logs yet — start saving!</p>;
  }

  const groups = logs.reduce<Record<string, SavingsLog[]>>((acc, log) => {
    const label = localDateLabel(log.created_at);
    if (!acc[label]) acc[label] = [];
    acc[label].push(log);
    return acc;
  }, {});

  return (
    <div className="flex flex-col">
      {Object.entries(groups).map(([label, items]) => (
        <div key={label}>
          <p className="text-xs text-ink-dim uppercase tracking-widest py-2">{label}</p>
          <div className="divide-y divide-border">
            {items.map(log => (
              <LogItem key={log.id} log={log} onSendPing={onSendPing} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
