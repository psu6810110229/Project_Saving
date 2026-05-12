import { useState } from 'react';
import { ActivityTimelineRow } from '../ActivityTimelineRow/ActivityTimelineRow';
import { Modal } from '../Modal/Modal';
import { SectionLabel } from '../SectionLabel/SectionLabel';

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
}

export function ActivityFeed({ label = 'Activity Feed', items }: ActivityFeedProps) {
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const displayUrl = slipUrl?.startsWith('attached:') ? null : slipUrl;

  return (
    <section>
      <SectionLabel tone="brand">{label}</SectionLabel>
      <div className="mt-3 rounded-3xl bg-surface shadow-soft px-4 divide-y divide-well">
        {items.map(item => (
          <ActivityTimelineRow
            key={item.id}
            {...item}
            onViewSlip={item.slipUrl ? () => setSlipUrl(item.slipUrl ?? null) : undefined}
          />
        ))}
      </div>
      <Modal open={Boolean(slipUrl)} title="Transfer Slip" onClose={() => setSlipUrl(null)}>
        {displayUrl ? (
          <img src={displayUrl} alt="Transfer slip" className="max-h-[70dvh] w-full rounded-2xl object-contain" />
        ) : (
          <p className="rounded-2xl bg-brand-50 px-4 py-3 font-mono text-sm text-brand-800">
            Slip reference saved: {slipUrl?.replace('attached:', '')}
          </p>
        )}
      </Modal>
    </section>
  );
}
