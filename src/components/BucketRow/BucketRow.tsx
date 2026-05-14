import { useEffect, useRef, type ReactNode } from 'react';
import { IconChevronDown } from '../Icon/Icon';
import { IconBubble } from '../IconBubble/IconBubble';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';

/**
 * One Smart Bucket row in the dashboard list. Peach IconBubble + bucket
 * name + saved/target + slim progress bar. Tappable surface (the whole
 * row links into Bucket Detail in Step 7).
 */

interface BucketRowProps {
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
  onClick?: () => void;
  expanded?: boolean;
}

export function BucketRow({ icon, name, saved, target, onClick, expanded = false }: BucketRowProps) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const wasComplete = useRef(target > 0 && saved >= target);

  useEffect(() => {
    const isComplete = target > 0 && saved >= target;
    if (isComplete && !wasComplete.current && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
    wasComplete.current = isComplete;
  }, [saved, target]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-lg bg-surface shadow-soft p-3 text-left active:scale-[0.99] transition-transform"
    >
      <IconBubble tone="peach" size="md">{icon}</IconBubble>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-sm font-bold text-ink truncate">{name}</span>
          <span className="font-mono text-xs text-ink-muted shrink-0">
            {formatCurrency(saved)} / {formatCurrency(target)}
          </span>
        </div>
        <div className="mt-1.5">
          <ProgressBar key={saved} value={pct} tone="primary" size="sm" animate />
        </div>
      </div>
      <IconChevronDown
        size={16}
        className={`shrink-0 text-ink-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
      />
    </button>
  );
}
