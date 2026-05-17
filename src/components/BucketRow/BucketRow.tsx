import { useEffect, useRef, type ReactNode } from 'react';
import { IconBubble } from '../IconBubble/IconBubble';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';
import Pressable from '../Pressable/Pressable';

interface BucketRowProps {
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
  onClick?: () => void;
  expanded?: boolean;
}

export function BucketRow({ icon, name, saved, target, onClick }: BucketRowProps) {
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
    <Pressable
      onClick={onClick}
      className="w-full flex flex-col items-center rounded-xl bg-surface shadow-soft p-3 text-center"
    >
      <div className="w-full flex justify-end mb-1">
        <span className="font-mono text-[10px] text-ink-dim">{Math.round(pct)}%</span>
      </div>

      <IconBubble tone="peach" size="md">{icon}</IconBubble>

      <div className="mt-2 w-full">
        <p className="font-mono text-sm font-bold text-ink truncate">{name}</p>
        <p className="font-mono text-xs text-ink-muted mt-0.5">
          {formatCurrency(saved)} / {formatCurrency(target)}
        </p>
      </div>

      <div className="mt-2 w-full">
        <ProgressBar key={saved} value={pct} tone="primary" size="sm" animate />
      </div>
    </Pressable>
  );
}
