import { type ReactNode, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PAGE_TRANSITION, REDUCED_MOTION_TRANSITION } from '../../lib/motion';

interface PageTransitionProps {
  transitionKey: string;
  children: ReactNode;
}

const EDGE_SHADOW = '0 0 44px rgba(42, 26, 14, 0.16)';

// Native-style push: the new page travels over the old page while the old page
// drifts slightly away, creating a small depth/parallax cue without moving the app chrome.
const variants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '96%' : '-96%',
    opacity: 0.98,
    scale: 0.995,
    boxShadow: EDGE_SHADOW,
    zIndex: 2,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    boxShadow: '0 0 0 rgba(42, 26, 14, 0)',
    zIndex: 2,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? '-14%' : '14%',
    opacity: 0.82,
    scale: 0.99,
    zIndex: 1,
  }),
};

const reducedVariants = {
  enter: { opacity: 0, zIndex: 2 },
  center: { opacity: 1, zIndex: 2 },
  exit: { opacity: 0, zIndex: 1 },
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
    activeNav = {
      key: transitionKey,
      idx,
      direction: idx >= nav.idx ? 1 : -1,
    };
    setNav(activeNav);
  }

  const reduceMotion = useReducedMotion();

  return (
    <div className="relative isolate overflow-x-hidden bg-bg">
      <AnimatePresence mode="popLayout" custom={activeNav.direction}>
        <motion.div
          key={transitionKey}
          custom={activeNav.direction}
          variants={reduceMotion ? reducedVariants : variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={reduceMotion ? REDUCED_MOTION_TRANSITION : PAGE_TRANSITION}
          className="relative w-full min-w-full min-h-[calc(100dvh-10.5rem)] bg-bg will-change-[transform,opacity]"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
