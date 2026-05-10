import { formatCurrency, formatRelativeTime } from '../../lib/format';
import { ReactionBar } from '../ReactionBar/ReactionBar';
import type { SavingsLog } from '../../types';
import type { ReactionPing } from '../../lib/reactions';

interface Props {
  log: SavingsLog;
  onSendPing: (ping: ReactionPing) => void;
}

export function LogItem({ log, onSendPing }: Props) {
  const initial = (log.display_name ?? '?')[0].toUpperCase();

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center text-white text-xs font-semibold shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium text-terracotta shrink-0">{formatCurrency(log.amount)}</span>
            {log.bucket_name && (
              <span className="text-xs bg-surface border border-border rounded-full px-2 py-0.5 text-ink-muted max-w-[8rem] truncate">
                {log.bucket_name}
              </span>
            )}
          </div>
          <span className="text-xs text-ink-dim shrink-0">{formatRelativeTime(log.created_at)}</span>
        </div>
        {log.note && (
          <p className="text-xs text-ink-muted mt-0.5 truncate">{log.note}</p>
        )}
        <p className="text-xs text-ink-dim mt-0.5">{log.display_name ?? '—'}</p>
        <ReactionBar logId={log.id} logUserId={log.user_id} onSendPing={onSendPing} />
      </div>
    </div>
  );
}
