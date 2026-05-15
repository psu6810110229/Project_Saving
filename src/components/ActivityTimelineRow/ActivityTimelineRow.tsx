import { Avatar } from '../Avatar/Avatar';
import { Chip } from '../Chip/Chip';
import { IconSlip } from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';

/**
 * One row in the Activity Timeline on the Dashboard. Avatar + actor
 * name + relative time + bucket name, plus the deposit amount on the
 * right. Optional "Slip Attached" chip when the deposit included a slip
 * upload.
 */

interface ActivityTimelineRowProps {
  actorName: string;
  actorFallback: string;
  actorAvatarUrl?: string | null;
  bucketName: string;
  amount: number;
  /** ISO timestamp; rendered as a relative time. */
  occurredAt: string;
  hasSlip?: boolean;
  onViewSlip?: () => void;
}

export function ActivityTimelineRow({
  actorName,
  actorFallback,
  actorAvatarUrl,
  bucketName,
  amount,
  occurredAt,
  hasSlip = false,
  onViewSlip,
}: ActivityTimelineRowProps) {
  const { copy, formatRelativeTime } = useI18n();
  const d = copy.dashboard;

  return (
    <div className="flex items-start gap-3 py-3">
      <Avatar size="sm" fallback={actorFallback} imageUrl={actorAvatarUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-sm font-bold text-ink truncate">{actorName}</span>
          <span className="font-mono text-xs text-ink-muted shrink-0">{formatRelativeTime(occurredAt)}</span>
        </div>
        <div className="mt-0.5 font-mono text-xs text-ink-muted truncate">
          {d.depositedInto} <span className="text-brand-800">{bucketName}</span>
        </div>
        {hasSlip && (
          <div className="mt-1.5">
            <button type="button" onClick={onViewSlip} disabled={!onViewSlip}>
              <Chip tone="peach" icon={<IconSlip size={12} />}>{d.slipAttached}</Chip>
            </button>
          </div>
        )}
      </div>
      <div className="shrink-0 font-mono text-sm font-bold text-brand-800">
        +{formatCurrency(amount)}
      </div>
    </div>
  );
}
