import type { ReactNode } from 'react';
import { Spinner } from '../Spinner/Spinner';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

const THRESHOLD = 80;
const SPRING_DURATION_MS = 300;
const SPRING_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

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

  const showIndicator = state !== 'idle';
  const indicatorOpacity = state === 'refreshing'
    ? 1
    : state === 'releasing'
      ? 0
      : Math.min(pullDistance / THRESHOLD, 1);

  const needsTransition = state === 'refreshing' || state === 'releasing';
  const indicatorTransition = needsTransition
    ? `height ${SPRING_DURATION_MS}ms ${SPRING_EASING}, opacity 0.2s`
    : 'none';

  return (
    <div
      ref={scrollRef}
      className={`relative h-full overflow-y-auto overscroll-y-contain ${className}`}
    >
      {showIndicator && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center overflow-hidden"
          style={{
            height: `${pullDistance}px`,
            opacity: indicatorOpacity,
            transition: indicatorTransition,
          }}
        >
          <div className="flex items-center justify-center rounded-full bg-surface p-2 shadow-neuRaised text-ink-muted">
            {state === 'refreshing'
              ? <Spinner size="sm" tone="brand" />
              : <PullArrow rotated={state === 'triggered'} />
            }
          </div>
        </div>
      )}

      <div style={contentStyle}>
        {children}
      </div>
    </div>
  );
}
