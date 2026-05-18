import { useState } from 'react';
import { ActivityTimelineRow } from '../ActivityTimelineRow/ActivityTimelineRow';
import { Modal } from '../Modal/Modal';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { SHOW_ATTACHED_SLIP } from '../../lib/flags';

interface ActivityFeedItem {
  id: string;
  actorName: string;
  actorFallback: string;
  actorAvatarUrl?: string | null;
  bucketName: string;
  amount: number;
  occurredAt: string;
  hasSlip?: boolean;
  slipUrl?: string | null;
}

interface ActivityFeedProps {
  label?: string;
  items: ActivityFeedItem[];
  /**
   * Optional "View more" action rendered as a footer link inside the
   * feed surface. When provided the feed will only render up to
   * `previewLimit` rows; the rest live behind the action (typically
   * an `ActivityHistoryModal`).
   */
  onViewMore?: () => void;
  /** Default 5; clamped to >= 1. */
  previewLimit?: number;
}

export function ActivityFeed({ label = 'Activity Feed', items, onViewMore, previewLimit = 5 }: ActivityFeedProps) {
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const displayUrl = slipUrl?.startsWith('attached:') ? null : slipUrl;
  const clampedLimit = Math.max(1, previewLimit);
  const previewed = onViewMore ? items.slice(0, clampedLimit) : items;
  const hiddenCount = onViewMore ? Math.max(0, items.length - clampedLimit) : 0;

  return (
    <section>
      <SectionLabel tone="brand">{label}</SectionLabel>
      <div className="mt-3 rounded-xl bg-surface shadow-soft px-4 divide-y divide-well">
        {previewed.map(item => (
          <ActivityTimelineRow
            key={item.id}
            {...item}
            onViewSlip={SHOW_ATTACHED_SLIP && item.slipUrl ? () => setSlipUrl(item.slipUrl ?? null) : undefined}
          />
        ))}
        {onViewMore && hiddenCount > 0 && (
          <button
            type="button"
            onClick={onViewMore}
            className="w-full py-3 font-mono text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            View more ({hiddenCount} more deposit{hiddenCount === 1 ? '' : 's'})
          </button>
        )}
      </div>
      {SHOW_ATTACHED_SLIP && (
        <Modal open={Boolean(slipUrl)} title="Transfer Slip" onClose={() => setSlipUrl(null)}>
          {displayUrl ? (
            <img src={displayUrl} alt="Transfer slip" className="max-h-[70dvh] w-full rounded-lg object-contain" />
          ) : (
            <p className="rounded-lg bg-brand-50 px-4 py-3 font-mono text-sm text-brand-800">
              Slip reference saved: {slipUrl?.replace('attached:', '')}
            </p>
          )}
        </Modal>
      )}
    </section>
  );
}
