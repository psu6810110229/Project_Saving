import { tripCountdown } from '../../lib/forecast';

export function CountdownCard() {
  const days = tripCountdown(new Date());

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs text-ink-muted uppercase tracking-widest">Japan trip</span>
      <div className="flex items-end gap-2">
        <span className="text-5xl font-bold text-ink leading-none">{days}</span>
        <span className="text-ink-muted text-sm mb-1">days away</span>
      </div>
      <span className="text-xs text-ink-dim">November 2027</span>
    </div>
  );
}
