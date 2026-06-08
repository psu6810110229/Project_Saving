import { type ReactNode, useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PAGE_TRANSITION, REDUCED_MOTION_TRANSITION } from '../../lib/motion';
import { setPageTransitioning } from '../../lib/animationBudget';

interface PageTransitionProps {
  transitionKey: string;
  children: ReactNode;
}

const variants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 28 : -28,
    opacity: 0,
    zIndex: 2,
    pointerEvents: 'auto' as const,
  }),
  center: {
    x: 0,
    opacity: 1,
    zIndex: 2,
    pointerEvents: 'auto' as const,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -12 : 12,
    opacity: 0.7,
    zIndex: 1,
    pointerEvents: 'none' as const,
  }),
};

const reducedVariants = {
  enter: { opacity: 0, zIndex: 2, pointerEvents: 'auto' as const },
  center: { opacity: 1, zIndex: 2, pointerEvents: 'auto' as const },
  exit: { opacity: 0, zIndex: 1, pointerEvents: 'none' as const },
};

function currentHistoryIdx(): number {
  if (typeof window === 'undefined') return 0;
  const state = window.history.state as { idx?: number } | null;
  return state?.idx ?? 0;
}

export function PageTransition({ transitionKey, children }: PageTransitionProps) {
  // Derived state pattern: compute swipe direction from history index whenever
  // the route key changes. Storing in state (instead of a ref read during
  // render) keeps the react-hooks/refs lint happy and stays correct on re-renders.
  const [nav, setNav] = useState(() => ({
    key: transitionKey,
    idx: currentHistoryIdx(),
    direction: 1,
  }));

  let activeNav = nav;
  if (nav.key !== transitionKey) {
    const idx = currentHistoryIdx();
    const direction = idx >= nav.idx ? 1 : -1;
    activeNav = { key: transitionKey, idx, direction };
    setNav(activeNav);
    setPageTransitioning(true);
  }

  const reduceMotion = useReducedMotion();
  const pageRef = useRef<HTMLDivElement>(null);

  const setActiveWillChange = useCallback(() => {
    if (pageRef.current) pageRef.current.style.willChange = 'transform, opacity';
  }, []);

  const clearWillChange = useCallback((definition: string) => {
    if (definition === 'center') {
      if (pageRef.current) pageRef.current.style.willChange = 'auto';
      setPageTransitioning(false);
    }
  }, []);

  return (
    <div className="relative isolate overflow-hidden bg-bg h-full">
      <AnimatePresence initial={false} mode="popLayout" custom={activeNav.direction}>
        <motion.div
          key={transitionKey}
          ref={pageRef}
          custom={activeNav.direction}
          variants={reduceMotion ? reducedVariants : variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={reduceMotion ? REDUCED_MOTION_TRANSITION : PAGE_TRANSITION}
          onAnimationStart={setActiveWillChange}
          onAnimationComplete={clearWillChange}
          data-page-scroll
          className="relative w-full min-w-full h-full overflow-y-auto overscroll-contain bg-bg"
          style={{ willChange: 'auto' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

