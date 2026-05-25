import type { ReactNode } from 'react';
import { Spinner } from '../Spinner/Spinner';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

const THRESHOLD = 80;

function PullArrow({ rotated }: { rotated: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform duration-200 motion-reduce:transition-none"
      style={{ transform: rotated ? 'rotate(180deg)' : 'none' }}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

export function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const { scrollRef, pullDistance, state, contentStyle } = usePullToRefresh({
    onRefresh,
    threshold: THRESHOLD,
  });

  const indicatorOpacity = state === 'idle'
    ? 0
    : state === 'refreshing'
      ? 1
      : Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      ref={scrollRef}
      className={`relative h-full overflow-y-auto overscroll-y-contain ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center"
        style={{
          height: `${THRESHOLD}px`,
          transform: `translateY(${pullDistance - THRESHOLD}px)`,
          opacity: indicatorOpacity,
          transition: state === 'pulling' ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s',
        }}
      >
        <div className="flex items-center justify-center rounded-full bg-surface p-2 shadow-neuRaised text-ink-muted">
          {state === 'refreshing'
            ? <Spinner size="sm" tone="brand" />
            : <PullArrow rotated={state === 'triggered'} />
          }
        </div>
      </div>

      <div style={contentStyle}>
        {children}
      </div>
    </div>
  );
}
