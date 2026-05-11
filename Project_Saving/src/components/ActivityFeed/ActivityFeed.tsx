import { ActivityTimelineRow } from '../ActivityTimelineRow/ActivityTimelineRow';
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
}

interface ActivityFeedProps {
  label?: string;
  items: ActivityFeedItem[];
}

export function ActivityFeed({ label = 'Activity Feed', items }: ActivityFeedProps) {
  return (
    <section>
      <SectionLabel tone="brand">{label}</SectionLabel>
      <div className="mt-3 rounded-3xl bg-surface shadow-soft px-4 divide-y divide-well">
        {items.map(item => (
          <ActivityTimelineRow key={item.id} {...item} />
        ))}
      </div>
    </section>
  );
}
