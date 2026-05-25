import { memo, useEffect, useRef, type ReactNode } from 'react';
import { IconBubble } from '../IconBubble/IconBubble';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';
import Pressable from '../Pressable/Pressable';
import { useAnimatedNumbers } from '../../hooks/useAnimatedNumber';

interface BucketRowProps {
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
  onClick?: () => void;
  expanded?: boolean;
  status?: {
    kind: 'focus' | 'next' | 'done';
    label: string;
  };
}

const STATUS_STYLES: Record<'focus' | 'next' | 'done', string> = {
  focus: 'bg-brand-100 text-brand-700',
  next: 'bg-accent-100 text-accent-700',
  done: 'bg-green-100 text-green-700',
};

export const BucketRow = memo(function BucketRow({ icon, name, saved, target, onClick, status }: BucketRowProps) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const [animSaved, animTarget, animPct] = useAnimatedNumbers([saved, target, pct]);
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
      className="relative flex aspect-square w-full flex-col items-center rounded-2xl bg-surface px-4 pb-4 pt-7 text-center shadow-soft"
    >
      {status ? (
        <span className={`absolute right-3 top-3 rounded-pill px-2 py-0.5 font-mono text-[10px] font-bold leading-tight ${STATUS_STYLES[status.kind]}`}>
          {status.label}
        </span>
      ) : (
        <span className="absolute right-4 top-4 font-mono text-sm font-bold text-brand-500">
          {Math.round(animPct)}%
        </span>
      )}

      <IconBubble tone="peach" size="md" className="text-brand-500">{icon}</IconBubble>

      <div className="mt-3 w-full">
        <p className="truncate font-mono text-sm font-bold leading-tight text-ink">{name}</p>
        <p className="mt-1.5 font-mono text-xs leading-tight text-ink-muted">
          {formatCurrency(Math.round(animSaved))} / {formatCurrency(Math.round(animTarget))}
        </p>
      </div>

      <div className="mt-auto w-full pb-1 pt-3">
        <ProgressBar value={animPct} tone="primary" size="sm" className="bg-brand-50" />
      </div>
    </Pressable>
  );
});
