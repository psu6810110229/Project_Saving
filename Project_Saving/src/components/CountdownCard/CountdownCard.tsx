import { tripCountdown } from '../../lib/forecast';
import type { Goal } from '../../types';

interface Props {
  goal: Goal | null;
}

export function CountdownCard({ goal }: Props) {
  const days = tripCountdown(new Date(), goal?.end_date);
  
  const dateLabel = goal 
    ? new Date(goal.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'November 2027';

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-1 shadow-soft">
      <span className="text-xs text-ink-muted uppercase tracking-widest font-semibold">Japan trip</span>
      <div className="flex items-end gap-2">
        <span className="text-5xl font-bold text-ink leading-none">{days}</span>
        <span className="text-ink-muted text-sm mb-1 font-medium">days away</span>
      </div>
      <span className="text-xs text-ink-dim">{dateLabel}</span>
    </div>
  );
}
