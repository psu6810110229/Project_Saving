import { type ReactNode, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface PageTransitionProps {
  transitionKey: string;
  children: ReactNode;
}

const TRANSITION = { type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.28 } as const;

// New page slides in from the edge; old page slides away at 30% speed (iOS parallax feel).
const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%' }),
  center: { x: 0 },
  exit: (dir: number) => ({ x: dir > 0 ? '-30%' : '30%' }),
};

const reducedVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
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

  if (nav.key !== transitionKey) {
    const idx = currentHistoryIdx();
    setNav({
      key: transitionKey,
      idx,
      direction: idx >= nav.idx ? 1 : -1,
    });
  }

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="relative overflow-x-hidden">
      <AnimatePresence mode="popLayout" custom={nav.direction}>
        <motion.div
          key={transitionKey}
          custom={nav.direction}
          variants={reduceMotion ? reducedVariants : variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={reduceMotion ? { duration: 0.15 } : TRANSITION}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
